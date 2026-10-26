import type { Prisma, PrismaClient } from '@prisma/client';
import { calcularPaginacao, respostaPaginada, type Paginacao } from '../../shared/pagination';
import { filtroAtivo, type Situacao } from '../../shared/situacao';
import { MovimentacaoRepository } from './movimentacao.repository';

export class MovimentacaoService {
  constructor(
    private prisma: PrismaClient,
    private repo = new MovimentacaoRepository(),
  ) {}

  async listar(f: Paginacao & { equipamentoId?: string; tipo?: string; ator?: string; situacao?: Situacao }) {
    const where: Prisma.MovimentacaoWhereInput = {};
    if (f.equipamentoId) where.equipamentoId = f.equipamentoId;
    if (f.tipo) where.tipo = f.tipo;
    if (f.ator) where.ator = f.ator;
    const ativo = filtroAtivo(f.situacao);
    if (ativo !== undefined) where.equipamento = { lote: { ativo } };

    const { skip, take } = calcularPaginacao(f);
    const { data, total } = await this.repo.listar(this.prisma, where, skip, take);
    return respostaPaginada(data, total, f);
  }
}
