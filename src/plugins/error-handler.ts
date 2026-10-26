import fp from 'fastify-plugin';
import { Prisma } from '@prisma/client';
import { AppError } from '../shared/errors';
import { ErroValidacao } from '../core/validation';

export default fp(async (app) => {
  app.setErrorHandler((error: any, req, reply) => {2
    if (error instanceof ErroValidacao) {
      return reply.code(422).send({ message: error.message });
    }

    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ message: error.message });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002': {
          const alvo = error.meta?.target as string[] | string | undefined;
          const campos = Array.isArray(alvo) ? alvo.join(', ') : alvo ?? 'campo único';
          return reply.code(409).send({ message: `Já existe registro com o mesmo valor em: ${campos}` });
        }
        case 'P2025':
          return reply.code(404).send({ message: 'Registro não encontrado' });
        case 'P2003':
          return reply.code(409).send({ message: 'Operação viola um vínculo com outro registro' });
      }
    }

    if (error.validation) {
      return reply.code(400).send({ message: 'Requisição inválida', detalhes: error.validation });
    }

    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ message: error.message });
    }

    req.log.error(error);
    return reply.code(500).send({ message: 'Erro interno do servidor' });
  });
});
