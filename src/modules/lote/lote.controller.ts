import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { atorDe } from '../../shared/ator';
import type { Situacao } from '../../shared/situacao';
import { LoteService, type CriarLoteInput, type NovoEquipamento } from './lote.service';

type Id = { Params: { id: string } };

export class LoteController {
  private service: LoteService;

  constructor(app: FastifyInstance) {
    this.service = new LoteService(app.prisma);
  }

  criar = async (req: FastifyRequest<{ Body: CriarLoteInput }>, reply: FastifyReply) =>
    reply.code(201).send(await this.service.criar(req.body, atorDe(req)));

  listar = async (
    req: FastifyRequest<{
      Querystring: {
        page: number; limit: number; organizacaoCodigo?: string; busca?: string; status?: string; situacao?: Situacao;
      };
    }>,
    reply: FastifyReply,
  ) => reply.send(await this.service.listar(req.query));

  obter = async (req: FastifyRequest<Id & { Querystring: { situacao?: Situacao } }>, reply: FastifyReply) =>
    reply.send(await this.service.obter(req.params.id, req.query.situacao));

  adicionarEquipamentos = async (
    req: FastifyRequest<Id & { Body: { equipamentos: NovoEquipamento[] } }>,
    reply: FastifyReply,
  ) => reply.code(201).send(await this.service.adicionarEquipamentos(req.params.id, req.body.equipamentos, atorDe(req)));

  atualizar = async (
    req: FastifyRequest<Id & { Body: { notaFiscal?: string; transportadora?: string; versao: number } }>,
    reply: FastifyReply,
  ) => reply.send(await this.service.atualizar(req.params.id, req.body));

  inativar = async (req: FastifyRequest<Id>, reply: FastifyReply) =>
    reply.send(await this.service.inativar(req.params.id));

  reativar = async (req: FastifyRequest<Id>, reply: FastifyReply) =>
    reply.send(await this.service.reativar(req.params.id));

  removerDefinitivo = async (req: FastifyRequest<Id>, reply: FastifyReply) => {
    await this.service.removerDefinitivo(req.params.id);
    return reply.code(204).send();
  };
}
