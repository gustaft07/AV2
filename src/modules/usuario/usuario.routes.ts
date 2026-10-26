import type { FastifyPluginAsync } from 'fastify';
import { UsuarioController } from './usuario.controller';
import { authorize } from '../../shared/authorize';
import { PERMISSOES } from '../../shared/permissoes';
import { ENUM_PAPEL, seguranca, situacaoQuery, uuidParam } from '../../shared/schemas';
import { paginacaoQuery } from '../../shared/pagination';

const routes: FastifyPluginAsync = async (app) => {
  const c = new UsuarioController(app);
  const tags = ['Usuários'];
  const leitura = [app.authenticate, authorize(PERMISSOES.lerUsuarios)];
  const escrita = [app.authenticate, authorize(PERMISSOES.gerirUsuarios)];
  const definitiva = [app.authenticate, authorize(PERMISSOES.exclusaoDefinitiva)];

  app.post('/usuarios', {
    onRequest: escrita,
    schema: {
      tags, summary: 'Cria conta de acesso (login 3+ caracteres: letras, números, . _ -)', security: seguranca,
      body: {
        type: 'object',
        required: ['login', 'senha', 'papel'],
        properties: {
          login: { type: 'string', minLength: 3, maxLength: 50, pattern: '^[a-zA-Z0-9._-]+$' },
          senha: { type: 'string', minLength: 8, maxLength: 128 },
          papel: { type: 'string', enum: ENUM_PAPEL },
        },
      },
    },
  }, c.criar);

  app.get('/usuarios', {
    onRequest: leitura,
    schema: {
      tags, summary: 'Lista usuários (sem hash/sal). Recurso administrativo: operadores não têm acesso', security: seguranca,
      querystring: { type: 'object', properties: { ...paginacaoQuery, ...situacaoQuery } },
    },
  }, c.listar);

  app.patch('/usuarios/:id', {
    onRequest: escrita,
    schema: {
      tags, summary: 'Altera papel ou senha. Exige a versão atual', security: seguranca, params: uuidParam(),
      body: {
        type: 'object',
        required: ['versao'],
        properties: {
          papel: { type: 'string', enum: ENUM_PAPEL },
          senha: { type: 'string', minLength: 8, maxLength: 128 },
          versao: { type: 'integer', minimum: 1 },
        },
      },
    },
  }, c.atualizar);

  app.delete('/usuarios/:id', {
    onRequest: escrita,
    schema: { tags, summary: 'SOFT DELETE: inativa o usuário (não autentica mais). Reversível', security: seguranca, params: uuidParam() },
  }, c.inativar);

  app.patch('/usuarios/:id/reativar', {
    onRequest: escrita,
    schema: { tags, summary: 'Reativa um usuário inativo', security: seguranca, params: uuidParam() },
  }, c.reativar);

  app.delete('/usuarios/:id/definitivo', {
    onRequest: definitiva,
    schema: { tags, summary: 'DELETE FÍSICO do usuário (irreversível; somente admin)', security: seguranca, params: uuidParam() },
  }, c.removerDefinitivo);
};

export default routes;
