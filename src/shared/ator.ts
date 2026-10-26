import type { FastifyRequest } from 'fastify';
import type { Papel } from '../domain/Papel';

/** Usuário autenticado que está executando a operação. */
export interface Ator {
  usuarioId: string;
  login: string;
  papel: Papel;
}

export function atorDe(req: FastifyRequest): Ator {
  return { usuarioId: req.user.sub, login: req.user.login, papel: req.user.papel };
}
