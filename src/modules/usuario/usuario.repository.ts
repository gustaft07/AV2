import type { Prisma } from '@prisma/client';
import type { Db } from '../../shared/db';
import type { Usuario } from '../../domain/Usuario';

// Nunca devolver hashSenha/saltSenha pela API
const seguro = { id: true, criadoEm: true, login: true, papel: true, ativo: true, versao: true } as const;

export class UsuarioRepository {
  /** Persiste uma entidade de domínio da AV1. */
  criar(db: Db, u: Usuario) {
    return db.usuario.create({
      data: {
        id: u.id,
        criadoEm: new Date(u.criadoEm),
        login: u.login,
        hashSenha: u.hashSenha,
        saltSenha: u.saltSenha,
        papel: u.papel,
        ativo: u.ativo,
      },
      select: seguro,
    });
  }

  findById(db: Db, id: string) {
    return db.usuario.findUnique({ where: { id }, select: seguro });
  }

  async listar(db: Db, where: Prisma.UsuarioWhereInput, skip: number, take: number) {
    const data = await db.usuario.findMany({ where, select: seguro, skip, take, orderBy: { login: 'asc' } });
    const total = await db.usuario.count({ where });
    return { data, total };
  }

  async atualizarComVersao(db: Db, id: string, versao: number, data: Prisma.UsuarioUpdateManyMutationInput) {
    const { count } = await db.usuario.updateMany({
      where: { id, versao },
      data: { ...data, versao: { increment: 1 } },
    });
    return count;
  }

  /** Soft delete / reativação (sem checagem de versão: a operação é idempotente e incrementa a versão). */
  definirAtivo(db: Db, id: string, ativo: boolean) {
    return db.usuario.update({ where: { id }, data: { ativo, versao: { increment: 1 } }, select: seguro });
  }

  remover(db: Db, id: string) {
    return db.usuario.delete({ where: { id } });
  }
}
