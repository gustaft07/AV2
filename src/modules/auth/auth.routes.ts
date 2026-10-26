import type { FastifyPluginAsync } from 'fastify';
import { AuthController } from './auth.controller';
import { seguranca } from '../../shared/schemas';

const routes: FastifyPluginAsync = async (app) => {
  const controller = new AuthController(app);

  app.post('/auth/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Autentica por login e senha e devolve um token JWT (expira em 1h)',
      body: {
        type: 'object',
        required: ['login', 'senha'],
        properties: {
          login: { type: 'string', minLength: 1 },
          senha: { type: 'string', minLength: 1 },
        },
      },
    },
  }, controller.login);

  app.get('/auth/me', {
    onRequest: [app.authenticate],
    schema: { tags: ['Auth'], summary: 'Dados do usuário autenticado (payload do token)', security: seguranca },
  }, controller.me);
};

export default routes;
