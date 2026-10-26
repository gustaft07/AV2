import { Prisma, type PrismaClient } from '@prisma/client';
import { ErroValidacao, type EstadoFisico, type StatusEquipamento } from '../../core/validation';
import { Movimentacao } from '../../domain/Movimentacao';
import type { Ator } from '../../shared/ator';
import { ConflictError, NotFoundError } from '../../shared/errors';
import { calcularPaginacao, respostaPaginada, type Paginacao } from '../../shared/pagination';
import { compativelComSituacao, filtroAtivo, type Situacao } from '../../shared/situacao';
import { LoteRepository } from '../lote/lote.repository';
import { sincronizarStatusDoLote } from '../lote/lote.sincronizacao';
import { MovimentacaoRepository } from '../movimentacao/movimentacao.repository';
import { EquipamentoRepository } from './equipamento.repository';

export interface FiltrosEquipamento extends Paginacao {
  status?: StatusEquipamento;
  estadoFisico?: EstadoFisico;
  loteId?: string;
  tipo?: string;
  busca?: string;
  situacao?: Situacao;
}

// READ COMMITTED: cada leitura enxerga o que já foi confirmado por outras transações (base da sincronização do lote)
const READ_COMMITTED = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted };

const descreve = (de: string, para: string, extra?: string) =>
  `${de} → ${para}${extra && extra.trim() ? ` | ${extra.trim()}` : ''}`;

export class EquipamentoService {
  constructor(
    private prisma: PrismaClient,
    private repo = new EquipamentoRepository(),
    private movRepo = new MovimentacaoRepository(),
    private loteRepo = new LoteRepository(),
  ) {}

  async listar(f: FiltrosEquipamento) {
    const where: Prisma.EquipamentoWhereInput = {};
    if (f.status) where.status = f.status;
    if (f.estadoFisico) where.estadoFisico = f.estadoFisico;
    if (f.loteId) where.loteId = f.loteId;
    if (f.tipo) where.tipo = { equals: f.tipo };
    if (f.busca) {
      where.OR = [
        { codigoBarrasInterno: { contains: f.busca } },
        { tipo: { contains: f.busca } },
      ];
    }
    // equipamento não tem soft delete próprio: é inativo quando o lote está inativo
    const ativo = filtroAtivo(f.situacao);
    if (ativo !== undefined) where.lote = { ativo };

    const { skip, take } = calcularPaginacao(f);
    const { data, total } = await this.repo.listar(this.prisma, where, skip, take);
    return respostaPaginada(data, total, f);
  }

  async obter(id: string, situacao: Situacao = 'ativos') {
    const e = await this.repo.findCompleto(this.prisma, id);
    if (!e || !compativelComSituacao(e.lote.ativo, situacao)) {
      throw new NotFoundError('Equipamento não encontrado');
    }
    return e;
  }

  async historicoMovimentacoes(id: string, p: Paginacao & { situacao?: Situacao }) {
    await this.obter(id, p.situacao);
    const { skip, take } = calcularPaginacao(p);
    const { data, total } = await this.movRepo.listar(this.prisma, { equipamentoId: id }, skip, take);
    return respostaPaginada(data, total, p);
  }

  /**
   * Alteração de estado físico usando a regra da AV1 (Equipamento.alterarEstadoFisico):
   * queda de 2+ categorias exige justificativa de pelo menos 5 caracteres.
   * Estado + histórico + movimentação são gravados juntos (tudo ou nada).
   */
  async alterarEstadoFisico(
    id: string,
    input: { novoEstado: EstadoFisico; justificativa?: string; versao: number },
    ator: Ator,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.repo.findBasico(tx, id);
      if (!row) throw new NotFoundError('Equipamento não encontrado');
      if (!row.lote.ativo) throw new ConflictError('Lote inativo: reative-o para alterar equipamentos');
      if (row.estadoFisico === input.novoEstado) {
        throw new ErroValidacao(`Equipamento já está no estado físico "${input.novoEstado}".`);
      }

      const equip = this.repo.paraDominio(row);
      equip.alterarEstadoFisico(input.novoEstado, input.justificativa); // lança ErroValidacao se violar a regra
      const entrada = equip.historicoEstado[equip.historicoEstado.length - 1];

      const afetadas = await this.repo.atualizarEstadoFisicoComVersao(tx, id, input.versao, equip.estadoFisico);
      if (afetadas === 0) {
        throw new ConflictError('Equipamento foi alterado por outra requisição. Recarregue e tente novamente.');
      }

      await this.repo.registrarHistorico(tx, id, {
        de: entrada.de,
        para: entrada.para,
        justificativa: entrada.justificativa?.trim() || undefined,
        em: new Date(entrada.em),
      });
      await this.movRepo.criar(tx, new Movimentacao({
        equipamentoId: id,
        tipo: 'alteracao_estado_fisico',
        ator: ator.login,
        observacao: descreve(entrada.de, entrada.para, entrada.justificativa),
      }));

      return this.repo.findCompleto(tx, id);
    });
  }

  /**
   * Alteração de status. "desmonte" só a partir de "triagem_completa" (regra da AV1).
   * Depois da troca, o status do LOTE é sincronizado: só muda quando TODOS os equipamentos
   * do lote tiverem o mesmo status (regra do professor).
   */
  async alterarStatus(
    id: string,
    input: { novoStatus: StatusEquipamento; versao: number; observacao?: string },
    ator: Ator,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.repo.findBasico(tx, id);
      if (!row) throw new NotFoundError('Equipamento não encontrado');
      if (!row.lote.ativo) throw new ConflictError('Lote inativo: reative-o para alterar equipamentos');

      const equip = this.repo.paraDominio(row);
      const anterior = equip.status;
      equip.alterarStatus(input.novoStatus); // lança ErroValidacao se a transição for inválida

      const afetadas = await this.repo.atualizarStatusComVersao(tx, id, input.versao, equip.status);
      if (afetadas === 0) {
        throw new ConflictError('Equipamento foi alterado por outra requisição. Recarregue e tente novamente.');
      }

      await this.movRepo.criar(tx, new Movimentacao({
        equipamentoId: id,
        tipo: 'alteracao_status',
        ator: ator.login,
        observacao: descreve(anterior, equip.status, input.observacao),
      }));

      await this.loteRepo.travar(tx, row.loteId);
      await sincronizarStatusDoLote(tx, row.loteId, this.loteRepo, this.repo);

      return this.repo.findCompleto(tx, id);
    }, READ_COMMITTED);
  }

  /**
   * DELETE FÍSICO direto (sem soft delete): remove o equipamento, seu histórico e suas movimentações.
   * A posição dele no lote não é reaproveitada. O status do lote é recalculado com os equipamentos restantes.
   */
  async remover(id: string) {
    await this.prisma.$transaction(async (tx) => {
      const row = await this.repo.findBasico(tx, id);
      if (!row) throw new NotFoundError('Equipamento não encontrado');

      await this.loteRepo.travar(tx, row.loteId);
      await this.repo.remover(tx, id);
      await sincronizarStatusDoLote(tx, row.loteId, this.loteRepo, this.repo);
    }, READ_COMMITTED);
  }
}
