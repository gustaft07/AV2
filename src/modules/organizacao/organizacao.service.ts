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
    const org = FabricaEntidades.criarOrganizacao({
      codigo: input.codigo.trim(),
      razaoSocial: input.razaoSocial.trim(),
      cnpj: normalizarCnpj(input.cnpj),
      contratoColeta: input.contratoColeta?.trim() ?? '',
      prazoArmazenamentoDias: input.prazoArmazenamentoDias,
    });
    return this.repo.criar(this.prisma, org); 
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

  async reativar(id: string) {
    const atual = await this.repo.findById(this.prisma, id);
    if (!atual) throw new NotFoundError('Organização não encontrada');
    if (atual.ativo) throw new ConflictError('Organização já está ativa');
    return this.repo.definirAtivo(this.prisma, id, true);
  }

  async removerDefinitivo(id: string) {
    const atual = await this.repo.findById(this.prisma, id);
    if (!atual) throw new NotFoundError('Organização não encontrada');
    await this.repo.remover(this.prisma, id);
  }

  async removerContrato(id: string) {
    const atual = await this.repo.findById(this.prisma, id);
    if (!atual) throw new NotFoundError('Organização não encontrada');
    if (!atual.contrato) throw new NotFoundError('Organização não possui contrato');
    await this.repo.removerContrato(this.prisma, id);
  }
}
