import type { PrismaClient } from '@prisma/client';

export class AuthRepository {
  constructor(private prisma: PrismaClient) {}

  findByLogin(login: string) {
    return this.prisma.usuario.findUnique({ where: { login } });
  }
}
