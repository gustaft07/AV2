import type { FastifyPluginAsync } from 'fastify';
import { authorize } from '../../shared/authorize';
import { PERMISSOES } from '../../shared/permissoes';
import { seguranca } from '../../shared/schemas';
import { RelatoriosService } from './relatorios.service';

const routes: FastifyPluginAsync = async (app) => {
  const service = new RelatoriosService(app.prisma);
  const tags = ['Relatórios'];
  const guarda = [app.authenticate, authorize(PERMISSOES.relatorios)];

  app.get('/relatorios/resumo', {
    onRequest: guarda,
    schema: { tags, summary: 'Totais e distribuição por status do lote, status do equipamento e estado físico (somente dados ativos)', security: seguranca },
  }, async () => service.resumo());

  app.get('/relatorios/prazo-armazenamento', {
    onRequest: guarda,
    schema: {
      tags, security: seguranca,
      summary: 'Lotes ativos com equipamentos sem destinação final x prazo de armazenamento da organização',
      querystring: { type: 'object', properties: { somenteVencidos: { type: 'boolean', default: false } } },
    },
  }, async (req) => service.prazoArmazenamento((req.query as { somenteVencidos?: boolean }).somenteVencidos ?? false));
};

export default routes;
