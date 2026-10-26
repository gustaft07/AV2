import type { Prisma } from '@prisma/client';
import type { Db } from '../../shared/db';
import type { Lote } from '../../domain/Lote';
import type { StatusEquipamento } from '../../core/validation';

export class LoteRepository {
  /** Entidade de domínio -> linha. O domínio referencia a organização pelo código; o banco, pela FK. */
  criar(db: Db, l: Lote, organizacaoId: string) {
    return db.lote.create({
      data: {
        id: l.id,
        criadoEm: new Date(l.criadoEm),
        codigoLote: l.codigoLote,
        notaFiscal: l.notaFiscal,
        transportadora: l.transportadora,
        dataEntrada: new Date(l.dataEntrada),
        organizacaoId,
      },
    });
  }

  findById(db: Db, id: string) {
    return db.lote.findUnique({ where: { id }, include: { organizacao: { select: { id: true, ativo: true } } } });
  }

  findCompleto(db: Db, id: string) {
    return db.lote.findUnique({
      where: { id },
      include: {
        organizacao: { select: { id: true, codigo: true, razaoSocial: true, ativo: true } },
        equipamentos: { orderBy: { posicao: 'asc' } },
      },
    });
  }

  async listar(db: Db, where: Prisma.LoteWhereInput, skip: number, take: number) {
    const data = await db.lote.findMany({
      where, skip, take, orderBy: { dataEntrada: 'desc' },
      include: {
        organizacao: { select: { codigo: true, razaoSocial: true } },
        _count: { select: { equipamentos: true } },
      },
    });
    const total = await db.lote.count({ where });
    return { data, total };
  }

  async atualizarComVersao(db: Db, id: string, versao: number, data: Prisma.LoteUpdateManyMutationInput) {
    const { count } = await db.lote.updateMany({
      where: { id, versao },
      data: { ...data, versao: { increment: 1 } },
    });
    return count;
  }

  /**
   * Trava a linha do lote (SELECT ... FOR UPDATE) até o fim da transação.
   * Serializa operações que dependem do conjunto de equipamentos do lote
   * (próxima posição e sincronização do status), evitando corrida entre requisições.
   */
  async travar(db: Db, id: string): Promise<boolean> {
    const linhas = await db.$queryRaw<{ id: string }[]>`SELECT id FROM Lote WHERE id = ${id} FOR UPDATE`;
    return linhas.length > 0;
  }

  /** Status derivado dos equipamentos (regra "todos iguais"). */
  definirStatus(db: Db, id: string, status: StatusEquipamento) {
    return db.lote.update({ where: { id }, data: { status, versao: { increment: 1 } } });
  }

  definirAtivo(db: Db, id: string, ativo: boolean) {
    return db.lote.update({ where: { id }, data: { ativo, versao: { increment: 1 } } });
  }

  /** Soft delete em cadeia: inativa todos os lotes ativos da organização. Retorna quantos foram inativados. */
  async inativarPorOrganizacao(db: Db, organizacaoId: string) {
    const { count } = await db.lote.updateMany({
      where: { organizacaoId, ativo: true },
      data: { ativo: false, versao: { increment: 1 } },
    });
    return count;
  }

  remover(db: Db, id: string) {
    return db.lote.delete({ where: { id } }); // equipamentos, histórico e movimentações caem em cascata
  }
}
