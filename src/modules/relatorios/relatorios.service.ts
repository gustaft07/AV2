import type { PrismaClient } from '@prisma/client';
import { STATUS_FINAIS } from '../../domain/transicoesStatus';

const DIA_MS = 24 * 60 * 60 * 1000;

export class RelatoriosService {
  constructor(private prisma: PrismaClient) {}

  /** Considera apenas dados ATIVOS (soft delete): lotes ativos e os equipamentos desses lotes. */
  async resumo() {
    const doLoteAtivo = { lote: { ativo: true } };
    const [organizacoes, lotes, equipamentos, lotesPorStatus, porStatus, porEstado] = await Promise.all([
      this.prisma.organizacao.count({ where: { ativo: true } }),
      this.prisma.lote.count({ where: { ativo: true } }),
      this.prisma.equipamento.count({ where: doLoteAtivo }),
      this.prisma.lote.groupBy({ by: ['status'], where: { ativo: true }, _count: { _all: true } }),
      this.prisma.equipamento.groupBy({ by: ['status'], where: doLoteAtivo, _count: { _all: true } }),
      this.prisma.equipamento.groupBy({ by: ['estadoFisico'], where: doLoteAtivo, _count: { _all: true } }),
    ]);
    return {
      totais: { organizacoes, lotes, equipamentos },
      lotesPorStatus: Object.fromEntries(lotesPorStatus.map((g) => [g.status, g._count._all])),
      equipamentosPorStatus: Object.fromEntries(porStatus.map((g) => [g.status, g._count._all])),
      equipamentosPorEstadoFisico: Object.fromEntries(porEstado.map((g) => [g.estadoFisico, g._count._all])),
    };
  }

  /**
   * Lotes ativos (de organizações ativas) que ainda têm equipamentos sem destinação final
   * (reciclagem, descarte_seguro ou revenda), comparando data de entrada + prazoArmazenamentoDias com hoje.
   */
  async prazoArmazenamento(somenteVencidos: boolean) {
    const agora = Date.now();
    const lotes = await this.prisma.lote.findMany({
      where: { ativo: true, organizacao: { ativo: true } },
      take: 1000,
      orderBy: { dataEntrada: 'asc' },
      include: {
        organizacao: { select: { codigo: true, razaoSocial: true, prazoArmazenamentoDias: true } },
        equipamentos: { select: { status: true } },
      },
    });

    const linhas = lotes
      .map((l) => {
        const pendentes = l.equipamentos.filter((e) => !STATUS_FINAIS.includes(e.status)).length;
        const limite = l.dataEntrada.getTime() + l.organizacao.prazoArmazenamentoDias * DIA_MS;
        return {
          loteId: l.id,
          codigoLote: l.codigoLote,
          statusLote: l.status,
          organizacao: { codigo: l.organizacao.codigo, razaoSocial: l.organizacao.razaoSocial },
          dataEntrada: l.dataEntrada,
          prazoArmazenamentoDias: l.organizacao.prazoArmazenamentoDias,
          dataLimite: new Date(limite),
          diasParaVencer: Math.ceil((limite - agora) / DIA_MS),
          vencido: limite < agora,
          equipamentosPendentes: pendentes,
        };
      })
      .filter((l) => l.equipamentosPendentes > 0 && (!somenteVencidos || l.vencido));

    return { geradoEm: new Date(agora), total: linhas.length, lotes: linhas };
  }
}
