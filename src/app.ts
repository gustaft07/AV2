import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import prismaPlugin from './plugins/prisma';
import jwtPlugin from './plugins/jwt';
import errorHandler from './plugins/error-handler';
import authRoutes from './modules/auth/auth.routes';
import usuarioRoutes from './modules/usuario/usuario.routes';
import organizacaoRoutes from './modules/organizacao/organizacao.routes';
import loteRoutes from './modules/lote/lote.routes';
import equipamentoRoutes from './modules/equipamento/equipamento.routes';
import movimentacaoRoutes from './modules/movimentacao/movimentacao.routes';
import relatoriosRoutes from './modules/relatorios/relatorios.routes';

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(errorHandler);

  // DELETE/PATCH sem corpo (inativar, reativar, excluir) costumam chegar com "content-type: application/json"
  // vindo de clientes e scripts de teste; o Fastify responderia 400 (corpo vazio). Descartamos o header nesse caso.
  app.addHook('onRequest', async (req) => {
    const tamanho = req.headers['content-length'];
    const semCorpo = tamanho === '0' || (tamanho === undefined && !req.headers['transfer-encoding']);
    if (req.headers['content-type'] && semCorpo) delete req.headers['content-type'];
  });

  // A documentação precisa ser registrada ANTES das rotas para que elas sejam capturadas.
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'greencode API',
        description: 'API de logística reversa de eletrônicos (AV2) — evolução do CLI da AV1',
        version: '2.0.0',
      },
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
      tags: [
        { name: 'Auth' }, { name: 'Usuários' }, { name: 'Organizações' }, { name: 'Lotes' },
        { name: 'Equipamentos' }, { name: 'Movimentações' }, { name: 'Relatórios' },
      ],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(prismaPlugin);
  await app.register(jwtPlugin);

  app.get('/health', { schema: { hide: true } }, async () => ({ status: 'ok' }));

  await app.register(authRoutes);
  await app.register(usuarioRoutes);
  await app.register(organizacaoRoutes);
  await app.register(loteRoutes);
  await app.register(equipamentoRoutes);
  await app.register(movimentacaoRoutes);
  await app.register(relatoriosRoutes);

  return app;
}
