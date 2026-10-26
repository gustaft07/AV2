import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { EstadoFisico, StatusEquipamento } from '../../core/validation';
import { atorDe } from '../../shared/ator';
import type { Situacao } from '../../shared/situacao';
import { EquipamentoService, type FiltrosEquipamento } from './equipamento.service';

type Id = { Params: { id: string } };

export class EquipamentoController {
  private service: EquipamentoService;

  constructor(app: FastifyInstance) {
    this.service = new EquipamentoService(app.prisma);
  }

  listar = async (req: FastifyRequest<{ Querystring: FiltrosEquipamento }>, reply: FastifyReply) =>
    reply.send(await this.service.listar(req.query));

  obter = async (req: FastifyRequest<Id & { Querystring: { situacao?: Situacao } }>, reply: FastifyReply) =>
    reply.send(await this.service.obter(req.params.id, req.query.situacao));

  movimentacoes = async (
    req: FastifyRequest<Id & { Querystring: { page: number; limit: number; situacao?: Situacao } }>,
    reply: FastifyReply,
  ) => reply.send(await this.service.historicoMovimentacoes(req.params.id, req.query));

  alterarEstadoFisico = async (
    req: FastifyRequest<Id & { Body: { novoEstado: EstadoFisico; justificativa?: string; versao: number } }>,
    reply: FastifyReply,
  ) => reply.send(await this.service.alterarEstadoFisico(req.params.id, req.body, atorDe(req)));

  alterarStatus = async (
    req: FastifyRequest<Id & { Body: { novoStatus: StatusEquipamento; versao: number; observacao?: string } }>,
    reply: FastifyReply,
  ) => reply.send(await this.service.alterarStatus(req.params.id, req.body, atorDe(req)));

  remover = async (req: FastifyRequest<Id>, reply: FastifyReply) => {
    await this.service.remover(req.params.id);
    return reply.code(204).send();
  };
}
