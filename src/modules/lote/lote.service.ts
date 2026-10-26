import { Prisma, type PrismaClient } from '@prisma/client';
import { ErroValidacao, type EstadoFisico } from '../../core/validation';
import type { Equipamento } from '../../domain/Equipamento';
import { FabricaEntidades } from '../../domain/FabricaEntidades';
import { Movimentacao } from '../../domain/Movimentacao';
import type { Ator } from '../../shared/ator';
import { ConflictError, NotFoundError } from '../../shared/errors';
import { calcularPaginacao, respostaPaginada, type Paginacao } from '../../shared/pagination';
import { compativelComSituacao, filtroAtivo, type Situacao } from '../../shared/situacao';
import { EquipamentoRepository } from '../equipamento/equipamento.repository';
import { MovimentacaoRepository } from '../movimentacao/movimentacao.repository';
import { OrganizacaoRepository } from '../organizacao/organizacao.repository';
import { LoteRepository } from './lote.repository';
import { sincronizarStatusDoLote } from './lote.sincronizacao';

export interface NovoEquipamento {
  tipo: string;
  estadoFisico: EstadoFisico;
}

export interface CriarLoteInput {
  codigoLote: string;
  organizacaoCodigo: string;
  notaFiscal: string;
  transportadora: string;
  dataEntrada?: string;
  equipamentos?: NovoEquipamento[];
}

const READ_COMMITTED = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted };

function montarEquipamentos(itens: NovoEquipamento[], loteId: string): Equipamento[] {
  return itens.map((i) =>
    FabricaEntidades.criarEquipamento({ loteId, tipo: i.tipo.trim(), estadoFisico: i.estadoFisico }),
  );
}

export class LoteService {
  constructor(
    private prisma: PrismaClient,
    private repo = new LoteRepository(),
    private orgRepo = new OrganizacaoRepository(),
    private equipRepo = new EquipamentoRepository(),
    private movRepo = new MovimentacaoRepository(),
  ) {}

  private movimentacoesDeCadastro(equipamentos: Equipamento[], codigoLote: string, ator: Ator) {
    return equipamentos.map((e) => new Movimentacao({
      equipamentoId: e.id,
      tipo: 'cadastro',
      ator: ator.login,
      observacao: `Entrada no lote ${codigoLote}`,
    }));
  }

  async criar(input: CriarLoteInput, ator: Ator) {
    const lote = FabricaEntidades.criarLote({
      codigoLote: input.codigoLote.trim(),
      organizacaoCodigo: input.organizacaoCodigo.trim(),
      notaFiscal: input.notaFiscal.trim(),
      transportadora: input.transportadora.trim(),
      dataEntrada: input.dataEntrada,
    });
    const equipamentos = montarEquipamentos(input.equipamentos ?? [], lote.id);

    return this.prisma.$transaction(async (tx) => {
      const org = await this.orgRepo.findByCodigo(tx, lote.organizacaoCodigo);
      if (!org) throw new NotFoundError(`Organização "${lote.organizacaoCodigo}" não encontrada`);
      if (!org.ativo) {
        throw new ErroValidacao(`Organização "${org.codigo}" está inativa e não pode receber lotes.`);
      }
      if (!org.contrato) {
        throw new ErroValidacao(
          `Organização "${org.codigo}" não possui contrato ativo: cadastre o contrato antes de registrar lotes.`,
        );
      }

      await this.repo.criar(tx, lote, org.id);
      if (equipamentos.length > 0) {
        await this.equipRepo.criarVarios(tx, equipamentos.map((equipamento, i) => ({ equipamento, posicao: i + 1 })));
        await this.movRepo.criarVarios(tx, this.movimentacoesDeCadastro(equipamentos, lote.codigoLote, ator));
      }
      return this.repo.findCompleto(tx, lote.id);
    }, READ_COMMITTED);
  }

  async listar(f: Paginacao & { organizacaoCodigo?: string; busca?: string; status?: string; situacao?: Situacao }) {
    const where: Prisma.LoteWhereInput = {};
    const ativo = filtroAtivo(f.situacao);
    if (ativo !== undefined) where.ativo = ativo;
    if (f.status) where.status = f.status as Prisma.LoteWhereInput['status'];
    if (f.organizacaoCodigo) where.organizacao = { codigo: f.organizacaoCodigo };
    if (f.busca) {
      where.OR = [
        { codigoLote: { contains: f.busca } },
        { notaFiscal: { contains: f.busca } },
      ];
    }
    const { skip, take } = calcularPaginacao(f);
    const { data, total } = await this.repo.listar(this.prisma, where, skip, take);
    return respostaPaginada(data, total, f);
  }

  async obter(id: string, situacao: Situacao = 'ativos') {
    const lote = await this.repo.findCompleto(this.prisma, id);
    if (!lote || !compativelComSituacao(lote.ativo, situacao)) throw new NotFoundError('Lote não encontrado');
    return lote;
  }

  async adicionarEquipamentos(id: string, itens: NovoEquipamento[], ator: Ator) {
    const equipamentos = montarEquipamentos(itens, id);

    return this.prisma.$transaction(async (tx) => {
      if (!(await this.repo.travar(tx, id))) throw new NotFoundError('Lote não encontrado');
      const lote = await this.repo.findById(tx, id);
      if (!lote) throw new NotFoundError('Lote não encontrado');
      if (!lote.ativo) throw new ConflictError('Lote inativo: reative-o para cadastrar equipamentos');

      const primeira = await this.equipRepo.proximaPosicao(tx, id);
      await this.equipRepo.criarVarios(
        tx, equipamentos.map((equipamento, i) => ({ equipamento, posicao: primeira + i })),
      );
      await this.movRepo.criarVarios(tx, this.movimentacoesDeCadastro(equipamentos, lote.codigoLote, ator));
      await sincronizarStatusDoLote(tx, id, this.repo, this.equipRepo);
      return this.repo.findCompleto(tx, id);
    }, READ_COMMITTED);
  }

  async atualizar(id: string, input: { notaFiscal?: string; transportadora?: string; versao: number }) {
    const atual = await this.repo.findById(this.prisma, id);
    if (!atual) throw new NotFoundError('Lote não encontrado');
    if (!atual.ativo) throw new ConflictError('Lote inativo: reative-o antes de alterar');

    const data: Prisma.LoteUpdateManyMutationInput = {};
    if (input.notaFiscal !== undefined) data.notaFiscal = input.notaFiscal.trim();
    if (input.transportadora !== undefined) data.transportadora = input.transportadora.trim();

    const afetadas = await this.repo.atualizarComVersao(this.prisma, id, input.versao, data);
    if (afetadas === 0) {
      throw new ConflictError('Lote foi alterado por outra requisição. Recarregue e tente novamente.');
    }
    return this.repo.findCompleto(this.prisma, id);
  }

  async inativar(id: string) {
    const atual = await this.repo.findById(this.prisma, id);
    if (!atual) throw new NotFoundError('Lote não encontrado');
    if (!atual.ativo) throw new ConflictError('Lote já está inativo');
    return this.repo.definirAtivo(this.prisma, id, false);
  }
  async reativar(id: string) {
    const atual = await this.repo.findById(this.prisma, id);
    if (!atual) throw new NotFoundError('Lote não encontrado');
    if (atual.ativo) throw new ConflictError('Lote já está ativo');
    if (!atual.organizacao.ativo) {
      throw new ErroValidacao('A organização do lote está inativa: reative a organização primeiro.');
    }
    return this.repo.definirAtivo(this.prisma, id, true);
  }

  async removerDefinitivo(id: string) {
    const atual = await this.repo.findById(this.prisma, id);
    if (!atual) throw new NotFoundError('Lote não encontrado');
    await this.repo.remover(this.prisma, id);
  }
}
