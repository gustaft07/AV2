import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { atorDe } from '../../shared/ator';
import type { Situacao } from '../../shared/situacao';
import { UsuarioService, type AtualizarUsuarioInput, type CriarUsuarioInput } from './usuario.service';

type Id = { Params: { id: string } };

export class UsuarioController {
  private service: UsuarioService;

  constructor(app: FastifyInstance) {
    this.service = new UsuarioService(app.prisma);
  }

  criar = async (req: FastifyRequest<{ Body: CriarUsuarioInput }>, reply: FastifyReply) =>
    reply.code(201).send(await this.service.criar(req.body));

  listar = async (
    req: FastifyRequest<{ Querystring: { page: number; limit: number; situacao?: Situacao } }>,
    reply: FastifyReply,
  ) => reply.send(await this.service.listar(req.query));

  atualizar = async (req: FastifyRequest<Id & { Body: AtualizarUsuarioInput }>, reply: FastifyReply) =>
    reply.send(await this.service.atualizar(req.params.id, req.body, atorDe(req)));

  inativar = async (req: FastifyRequest<Id>, reply: FastifyReply) =>
    reply.send(await this.service.inativar(req.params.id, atorDe(req)));

  reativar = async (req: FastifyRequest<Id>, reply: FastifyReply) =>
    reply.send(await this.service.reativar(req.params.id));

  removerDefinitivo = async (req: FastifyRequest<Id>, reply: FastifyReply) => {
    await this.service.removerDefinitivo(req.params.id, atorDe(req));
    return reply.code(204).send();
  };
}
