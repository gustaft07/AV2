import type { Prisma } from '@prisma/client';
import type { Db } from '../../shared/db';
import type { Movimentacao } from '../../domain/Movimentacao';

const dados = (m: Movimentacao) => ({
  id: m.id,
  criadoEm: new Date(m.criadoEm),
  equipamentoId: m.equipamentoId,
  tipo: m.tipo,
  ator: m.ator,
  observacao: m.observacao,
});

export class MovimentacaoRepository {
  criar(db: Db, m: Movimentacao) {
    m.validar();
    return db.movimentacao.create({ data: dados(m) });
  }

  criarVarios(db: Db, movs: Movimentacao[]) {
    movs.forEach((m) => m.validar());
    return db.movimentacao.createMany({ data: movs.map(dados) });
  }

  async listar(db: Db, where: Prisma.MovimentacaoWhereInput, skip: number, take: number) {
    const data = await db.movimentacao.findMany({
      where, skip, take, orderBy: { criadoEm: 'desc' },
      include: { equipamento: { select: { id: true, codigoBarrasInterno: true, tipo: true } } },
    });
    const total = await db.movimentacao.count({ where });
    return { data, total };
  }
}
