import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Papel } from '../domain/Papel';
import { ForbiddenError } from './errors';

export const authorize =
  (papeis: readonly Papel[]) =>
  async (req: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!papeis.includes(req.user.papel)) {
      throw new ForbiddenError('Seu perfil não tem permissão para esta operação');
    }
  };
