import type { FastifyPluginAsync } from 'fastify';
import { OrganizacaoController } from './organizacao.controller';
import { authorize } from '../../shared/authorize';
import { PERMISSOES } from '../../shared/permissoes';
import { seguranca, situacaoQuery, uuidParam } from '../../shared/schemas';
import { paginacaoQuery } from '../../shared/pagination';

const routes: FastifyPluginAsync = async (app) => {
  const c = new OrganizacaoController(app);
  const tags = ['Organizações'];
  const leitura = [app.authenticate, authorize(PERMISSOES.lerCadastro)];
  const escrita = [app.authenticate, authorize(PERMISSOES.gerirCadastro)];
  const definitiva = [app.authenticate, authorize(PERMISSOES.exclusaoDefinitiva)];

  app.post('/organizacoes', {
    onRequest: escrita,
    schema: {
      tags, summary: 'Cadastra organização (CNPJ validado). contratoColeta opcional cria o Contrato', security: seguranca,
      body: {
        type: 'object',
        required: ['codigo', 'razaoSocial', 'cnpj'],
        properties: {
          codigo: { type: 'string', minLength: 1, maxLength: 40 },
          razaoSocial: { type: 'string', minLength: 1, maxLength: 200 },
          cnpj: { type: 'string', pattern: '^[0-9./-]{14,18}$', description: 'Com ou sem máscara' },
          contratoColeta: { type: 'string', minLength: 1, maxLength: 60 },
          prazoArmazenamentoDias: { type: 'integer', minimum: 1, maximum: 3650, default: 90 },
        },
      },
    },
  }, c.criar);

  app.get('/organizacoes', {
    onRequest: leitura,
    schema: {
      tags, summary: 'Lista organizações (ativas por padrão)', security: seguranca,
      querystring: {
        type: 'object',
        properties: { ...paginacaoQuery, ...situacaoQuery, busca: { type: 'string', maxLength: 100 } },
      },
    },
  }, c.listar);

  app.get('/organizacoes/:id', {
    onRequest: leitura,
    schema: {
      tags, summary: 'Detalha organização com contrato (inativa => 404, salvo ?situacao=todos)', security: seguranca,
      params: uuidParam(), querystring: { type: 'object', properties: { ...situacaoQuery } },
    },
  }, c.obter);

  app.put('/organizacoes/:id', {
    onRequest: escrita,
    schema: {
      tags, summary: 'Atualiza razão social, prazo de armazenamento e contrato de coleta. Exige a versão atual',
      security: seguranca, params: uuidParam(),
      body: {
        type: 'object',
        required: ['versao'],
        properties: {
          razaoSocial: { type: 'string', minLength: 1, maxLength: 200 },
          prazoArmazenamentoDias: { type: 'integer', minimum: 1, maximum: 3650 },
          contratoColeta: { type: 'string', minLength: 1, maxLength: 60 },
          versao: { type: 'integer', minimum: 1 },
        },
      },
    },
  }, c.atualizar);

  app.delete('/organizacoes/:id', {
    onRequest: escrita,
    schema: {
      tags, security: seguranca, params: uuidParam(),
      summary: 'SOFT DELETE em cadeia: inativa a organização e todos os seus lotes (equipamentos ficam inativos por herança)',
    },
  }, c.inativar);

  app.patch('/organizacoes/:id/reativar', {
    onRequest: escrita,
    schema: { tags, summary: 'Reativa a organização (lotes inativados em cadeia permanecem inativos)', security: seguranca, params: uuidParam() },
  }, c.reativar);

  app.delete('/organizacoes/:id/definitivo', {
    onRequest: definitiva,
    schema: {
      tags, security: seguranca, params: uuidParam(),
      summary: 'DELETE FÍSICO em cascata: contrato, lotes, equipamentos, histórico e movimentações (irreversível; somente admin)',
    },
  }, c.removerDefinitivo);

  app.delete('/organizacoes/:id/contrato', {
    onRequest: escrita,
    schema: {
      tags, security: seguranca, params: uuidParam(),
      summary: 'DELETE FÍSICO direto do contrato. Sem contrato, a organização não recebe novos lotes',
    },
  }, c.removerContrato);
};

export default routes;
