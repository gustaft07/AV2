import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Situacao } from '../../shared/situacao';
import { MovimentacaoService } from './movimentacao.service';

export class MovimentacaoController {
  private service: MovimentacaoService;

  constructor(app: FastifyInstance) {
    this.service = new MovimentacaoService(app.prisma);
  }

  listar = async (
    req: FastifyRequest<{
      Querystring: {
        page: number; limit: number; equipamentoId?: string; tipo?: string; ator?: string; situacao?: Situacao;
      };
    }>,
    reply: FastifyReply,
  ) => reply.send(await this.service.listar(req.query));
}
