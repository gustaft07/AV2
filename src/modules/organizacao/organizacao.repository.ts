import type { Prisma } from '@prisma/client';
import type { Db } from '../../shared/db';
import type { Organizacao } from '../../domain/Organizacao';

export class OrganizacaoRepository {
  criar(db: Db, o: Organizacao) {
    return db.organizacao.create({
      data: {
        id: o.id,
        criadoEm: new Date(o.criadoEm),
        codigo: o.codigo,
        razaoSocial: o.razaoSocial,
        cnpj: o.cnpj,
        prazoArmazenamentoDias: o.prazoArmazenamentoDias,
        contrato: o.contratoColeta ? { create: { numero: o.contratoColeta } } : undefined,
      },
      include: { contrato: true },
    });
  }

  findById(db: Db, id: string) {
    return db.organizacao.findUnique({ where: { id }, include: { contrato: true } });
  }

  findByCodigo(db: Db, codigo: string) {
    return db.organizacao.findUnique({ where: { codigo }, include: { contrato: true } });
  }

  async listar(db: Db, where: Prisma.OrganizacaoWhereInput, skip: number, take: number) {
    const data = await db.organizacao.findMany({
      where, skip, take, orderBy: { razaoSocial: 'asc' }, include: { contrato: true },
    });
    const total = await db.organizacao.count({ where });
    return { data, total };
  }

  async atualizarComVersao(db: Db, id: string, versao: number, data: Prisma.OrganizacaoUpdateManyMutationInput) {
    const { count } = await db.organizacao.updateMany({
      where: { id, versao },
      data: { ...data, versao: { increment: 1 } },
    });
    return count;
  }

  definirAtivo(db: Db, id: string, ativo: boolean) {
    return db.organizacao.update({
      where: { id }, data: { ativo, versao: { increment: 1 } }, include: { contrato: true },
    });
  }

  salvarContrato(db: Db, organizacaoId: string, numero: string) {
    return db.contrato.upsert({
      where: { organizacaoId },
      create: { organizacaoId, numero },
      update: { numero },
    });
  }

  removerContrato(db: Db, organizacaoId: string) {
    return db.contrato.delete({ where: { organizacaoId } });
  }

  remover(db: Db, id: string) {
    return db.organizacao.delete({ where: { id } }); 
  }
}
