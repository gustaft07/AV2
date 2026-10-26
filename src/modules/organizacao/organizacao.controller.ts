import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Situacao } from '../../shared/situacao';
import {
  OrganizacaoService,
  type AtualizarOrganizacaoInput,
  type CriarOrganizacaoInput,
} from './organizacao.service';

type Id = { Params: { id: string } };

export class OrganizacaoController {
  private service: OrganizacaoService;

  constructor(app: FastifyInstance) {
    this.service = new OrganizacaoService(app.prisma);
  }

  criar = async (req: FastifyRequest<{ Body: CriarOrganizacaoInput }>, reply: FastifyReply) =>
    reply.code(201).send(await this.service.criar(req.body));

  listar = async (
    req: FastifyRequest<{ Querystring: { page: number; limit: number; busca?: string; situacao?: Situacao } }>,
    reply: FastifyReply,
  ) => reply.send(await this.service.listar(req.query));

  obter = async (req: FastifyRequest<Id & { Querystring: { situacao?: Situacao } }>, reply: FastifyReply) =>
    reply.send(await this.service.obter(req.params.id, req.query.situacao));

  atualizar = async (req: FastifyRequest<Id & { Body: AtualizarOrganizacaoInput }>, reply: FastifyReply) =>
    reply.send(await this.service.atualizar(req.params.id, req.body));

  inativar = async (req: FastifyRequest<Id>, reply: FastifyReply) =>
    reply.send(await this.service.inativar(req.params.id));

  reativar = async (req: FastifyRequest<Id>, reply: FastifyReply) =>
    reply.send(await this.service.reativar(req.params.id));

  removerDefinitivo = async (req: FastifyRequest<Id>, reply: FastifyReply) => {
    await this.service.removerDefinitivo(req.params.id);
    return reply.code(204).send();
  };

  removerContrato = async (req: FastifyRequest<Id>, reply: FastifyReply) => {
    await this.service.removerContrato(req.params.id);
    return reply.code(204).send();
  };
}
