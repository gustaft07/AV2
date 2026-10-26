import type { Prisma, PrismaClient } from '@prisma/client';
import { FabricaEntidades } from '../../domain/FabricaEntidades';
import { normalizarCnpj } from '../../shared/cnpj';
import { ConflictError, NotFoundError } from '../../shared/errors';
import { calcularPaginacao, respostaPaginada, type Paginacao } from '../../shared/pagination';
import { compativelComSituacao, filtroAtivo, type Situacao } from '../../shared/situacao';
import { LoteRepository } from '../lote/lote.repository';
import { OrganizacaoRepository } from './organizacao.repository';

export interface CriarOrganizacaoInput {
  codigo: string;
  razaoSocial: string;
  cnpj: string;
  contratoColeta?: string;
  prazoArmazenamentoDias?: number;
}

export interface AtualizarOrganizacaoInput {
  razaoSocial?: string;
  prazoArmazenamentoDias?: number;
  contratoColeta?: string;
  versao: number;
}

export class OrganizacaoService {
  constructor(
    private prisma: PrismaClient,
    private repo = new OrganizacaoRepository(),
    private loteRepo = new LoteRepository(),
  ) {}

  async criar(input: CriarOrganizacaoInput) {
    // validações da AV1 (código e razão social obrigatórios, CNPJ válido) via fábrica
    const org = FabricaEntidades.criarOrganizacao({
      codigo: input.codigo.trim(),
      razaoSocial: input.razaoSocial.trim(),
      cnpj: normalizarCnpj(input.cnpj),
      contratoColeta: input.contratoColeta?.trim() ?? '',
      prazoArmazenamentoDias: input.prazoArmazenamentoDias,
    });
    return this.repo.criar(this.prisma, org); // código/CNPJ/contrato duplicados -> 409 (UNIQUE)
  }

  async listar(f: Paginacao & { busca?: string; situacao?: Situacao }) {
    const where: Prisma.OrganizacaoWhereInput = {};
    const ativo = filtroAtivo(f.situacao);
    if (ativo !== undefined) where.ativo = ativo;
    if (f.busca) {
      const termo = f.busca.trim();
      where.OR = [
        { codigo: { contains: termo } },
        { razaoSocial: { contains: termo } },
        { cnpj: { contains: normalizarCnpj(termo) || termo } },
      ];
    }
    const { skip, take } = calcularPaginacao(f);
    const { data, total } = await this.repo.listar(this.prisma, where, skip, take);
    return respostaPaginada(data, total, f);
  }

  /** Registros inativos "não existem" para a consulta padrão (404) — use ?situacao=todos para vê-los. */
  async obter(id: string, situacao: Situacao = 'ativos') {
    const org = await this.repo.findById(this.prisma, id);
    if (!org || !compativelComSituacao(org.ativo, situacao)) {
      throw new NotFoundError('Organização não encontrada');
    }
    return org;
  }

  async atualizar(id: string, input: AtualizarOrganizacaoInput) {
    return this.prisma.$transaction(async (tx) => {
      const atual = await this.repo.findById(tx, id);
      if (!atual) throw new NotFoundError('Organização não encontrada');
      if (!atual.ativo) throw new ConflictError('Organização inativa: reative-a antes de alterar');

      const razaoSocial = input.razaoSocial?.trim() ?? atual.razaoSocial;
      const prazo = input.prazoArmazenamentoDias ?? atual.prazoArmazenamentoDias;
      const contratoColeta = input.contratoColeta?.trim() ?? atual.contrato?.numero ?? '';

      // revalida o resultado pelas regras do domínio
      FabricaEntidades.criarOrganizacao({
        codigo: atual.codigo, razaoSocial, cnpj: atual.cnpj, contratoColeta, prazoArmazenamentoDias: prazo,
      });

      const afetadas = await this.repo.atualizarComVersao(tx, id, input.versao, {
        razaoSocial, prazoArmazenamentoDias: prazo,
      });
      if (afetadas === 0) {
        throw new ConflictError('Organização foi alterada por outra requisição. Recarregue e tente novamente.');
      }
      if (input.contratoColeta !== undefined && contratoColeta) {
        await this.repo.salvarContrato(tx, id, contratoColeta);
      }
      return this.repo.findById(tx, id);
    });
  }

  /**
   * SOFT DELETE em cadeia: inativa a organização e todos os seus lotes.
   * Os equipamentos ficam inativos por herança (não têm soft delete próprio).
   * Não há restrição por contrato ativo: a organização pode ser inativada mesmo com contrato.
   */
  async inativar(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const atual = await this.repo.findById(tx, id);
      if (!atual) throw new NotFoundError('Organização não encontrada');
      if (!atual.ativo) throw new ConflictError('Organização já está inativa');

      const organizacao = await this.repo.definirAtivo(tx, id, false);
      const lotesInativados = await this.loteRepo.inativarPorOrganizacao(tx, id);
      return { organizacao, lotesInativados };
    });
  }

  /** Reativa somente a organização; lotes inativados em cadeia precisam ser reativados um a um. */
  async reativar(id: string) {
    const atual = await this.repo.findById(this.prisma, id);
    if (!atual) throw new NotFoundError('Organização não encontrada');
    if (atual.ativo) throw new ConflictError('Organização já está ativa');
    return this.repo.definirAtivo(this.prisma, id, true);
  }

  /** DELETE FÍSICO (delete padrão), em cascata: contrato, lotes, equipamentos, histórico e movimentações. */
  async removerDefinitivo(id: string) {
    const atual = await this.repo.findById(this.prisma, id);
    if (!atual) throw new NotFoundError('Organização não encontrada');
    await this.repo.remover(this.prisma, id);
  }

  /** DELETE FÍSICO direto do contrato. Sem contrato, a organização deixa de poder receber novos lotes. */
  async removerContrato(id: string) {
    const atual = await this.repo.findById(this.prisma, id);
    if (!atual) throw new NotFoundError('Organização não encontrada');
    if (!atual.contrato) throw new NotFoundError('Organização não possui contrato');
    await this.repo.removerContrato(this.prisma, id);
  }
}
