import fp from 'fastify-plugin';
import { Prisma } from '@prisma/client';
import { AppError } from '../shared/errors';
import { ErroValidacao } from '../core/validation';

export default fp(async (app) => {
  app.setErrorHandler((error: any, req, reply) => {
    // regras de domínio da AV1 (CNPJ, data de entrada, justificativa, desmonte...) -> 422
    if (error instanceof ErroValidacao) {
      return reply.code(422).send({ message: error.message });
    }

    // erros HTTP de negócio
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ message: error.message });
    }

    // erros conhecidos do Prisma
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

    // validação do JSON Schema (Fastify/Ajv)
    if (error.validation) {
      return reply.code(400).send({ message: 'Requisição inválida', detalhes: error.validation });
    }

    // outros erros 4xx gerados pelo próprio Fastify (ex.: JSON malformado)
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ message: error.message });
    }

    req.log.error(error);
    return reply.code(500).send({ message: 'Erro interno do servidor' });
  });
});
