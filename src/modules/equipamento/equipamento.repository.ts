import type { Prisma } from '@prisma/client';
import type { Db } from '../../shared/db';
import { Equipamento } from '../../domain/Equipamento';
import type { EstadoFisico, StatusEquipamento } from '../../core/validation';

export class EquipamentoRepository {
  criarVarios(db: Db, itens: { equipamento: Equipamento; posicao: number }[]) {
    return db.equipamento.createMany({
      data: itens.map(({ equipamento: e, posicao }) => ({
        id: e.id,
        criadoEm: new Date(e.criadoEm),
        codigoBarrasInterno: e.id, 
        posicao,
        tipo: e.tipo,
        estadoFisico: e.estadoFisico,
        status: e.status,
        loteId: e.loteId,
      })),
    });
  }

  async proximaPosicao(db: Db, loteId: string): Promise<number> {
    const r = await db.equipamento.aggregate({ where: { loteId }, _max: { posicao: true } });
    return (r._max.posicao ?? 0) + 1;
  }

  async statusDosEquipamentos(db: Db, loteId: string): Promise<StatusEquipamento[]> {
    const linhas = await db.equipamento.findMany({ where: { loteId }, select: { status: true } });
    return linhas.map((l) => l.status);
  }

  paraDominio(row: {
    id: string; criadoEm: Date; codigoBarrasInterno: string; loteId: string; tipo: string;
    estadoFisico: EstadoFisico; status: StatusEquipamento;
  }): Equipamento {
    return Equipamento.deJSON({
      id: row.id,
      criadoEm: row.criadoEm.toISOString(),
      codigoBarras: row.codigoBarrasInterno,
      loteId: row.loteId,
      tipo: row.tipo,
      estadoFisico: row.estadoFisico,
      status: row.status,
      historicoEstado: [],
    });
  }

  findBasico(db: Db, id: string) {
    return db.equipamento.findUnique({
      where: { id },
      include: { lote: { select: { id: true, ativo: true, status: true } } },
    });
  }

  findCompleto(db: Db, id: string) {
    return db.equipamento.findUnique({
      where: { id },
      include: {
        lote: { select: { id: true, codigoLote: true, ativo: true, organizacaoId: true } },
        historicoEstado: { orderBy: { em: 'asc' } },
      },
    });
  }

  async listar(db: Db, where: Prisma.EquipamentoWhereInput, skip: number, take: number) {
    const data = await db.equipamento.findMany({
      where, skip, take,
      orderBy: [{ loteId: 'asc' }, { posicao: 'asc' }],
      include: { lote: { select: { codigoLote: true, ativo: true } } },
    });
    const total = await db.equipamento.count({ where });
    return { data, total };
  }

  async atualizarEstadoFisicoComVersao(db: Db, id: string, versao: number, estado: EstadoFisico) {
    const { count } = await db.equipamento.updateMany({
      where: { id, versao },
      data: { estadoFisico: estado, versao: { increment: 1 } },
    });
    return count;
  }

  async atualizarStatusComVersao(db: Db, id: string, versao: number, status: StatusEquipamento) {
    const { count } = await db.equipamento.updateMany({
      where: { id, versao },
      data: { status, versao: { increment: 1 } },
    });
    return count;
  }

  registrarHistorico(
    db: Db,
    equipamentoId: string,
    h: { de: EstadoFisico; para: EstadoFisico; justificativa?: string; em: Date },
  ) {
    return db.historicoEstado.create({ data: { equipamentoId, ...h } });
  }

  remover(db: Db, id: string) {
    return db.equipamento.delete({ where: { id } });
  }
}
