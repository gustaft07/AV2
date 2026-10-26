import type { FastifyPluginAsync } from 'fastify';
import { MovimentacaoController } from './movimentacao.controller';
import { authorize } from '../../shared/authorize';
import { PERMISSOES } from '../../shared/permissoes';
import { seguranca, situacaoQuery } from '../../shared/schemas';
import { paginacaoQuery } from '../../shared/pagination';

const routes: FastifyPluginAsync = async (app) => {
  const c = new MovimentacaoController(app);

  // Movimentações são imutáveis: nascem como efeito de cadastro/alteração de equipamento (trilha de auditoria).
  app.get('/movimentacoes', {
    onRequest: [app.authenticate, authorize(PERMISSOES.lerAlmoxarifado)],
    schema: {
      tags: ['Movimentações'],
      summary: 'Trilha de movimentações (cadastro, alteração de estado físico, alteração de status)',
      security: seguranca,
      querystring: {
        type: 'object',
        properties: {
          ...paginacaoQuery,
          ...situacaoQuery,
          equipamentoId: { type: 'string', format: 'uuid' },
          tipo: { type: 'string', maxLength: 60 },
          ator: { type: 'string', maxLength: 50, description: 'Login de quem executou' },
        },
      },
    },
  }, c.listar);
};

export default routes;
