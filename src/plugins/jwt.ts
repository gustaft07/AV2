import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Papel } from '../domain/Papel';
import { env } from '../config/env';
import { UnauthorizedError } from '../shared/errors';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; login: string; papel: Papel };
    user: { sub: string; login: string; papel: Papel };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async (app) => {
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: '1h' },
  });

  app.decorate('authenticate', async (req: FastifyRequest, _reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      throw new UnauthorizedError('Token ausente ou inválido');
    }

    const usuario = await app.prisma.usuario.findUnique({
      where: { id: req.user.sub },
      select: { ativo: true, papel: true },
    });
    if (!usuario || !usuario.ativo) throw new UnauthorizedError('Usuário inativo ou inexistente');
    req.user.papel = usuario.papel as Papel;
  });
});
