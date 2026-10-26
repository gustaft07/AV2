import type { FastifyPluginAsync } from 'fastify';
import { LoteController } from './lote.controller';
import { authorize } from '../../shared/authorize';
import { PERMISSOES } from '../../shared/permissoes';
import { ENUM_STATUS, equipamentoNovoSchema, seguranca, situacaoQuery, uuidParam } from '../../shared/schemas';
import { paginacaoQuery } from '../../shared/pagination';

const routes: FastifyPluginAsync = async (app) => {
  const c = new LoteController(app);
  const tags = ['Lotes'];
  const leitura = [app.authenticate, authorize(PERMISSOES.lerAlmoxarifado)];
  const escrita = [app.authenticate, authorize(PERMISSOES.gerirAlmoxarifado)];
  const definitiva = [app.authenticate, authorize(PERMISSOES.exclusaoDefinitiva)];

  app.post('/lotes', {
    onRequest: escrita,
    schema: {
      tags,
      summary: 'Registra lote (e equipamentos opcionais) em uma transação. Exige organização ativa COM contrato. Código de barras e posição são automáticos',
      security: seguranca,
      body: {
        type: 'object',
        required: ['codigoLote', 'organizacaoCodigo', 'notaFiscal', 'transportadora'],
        properties: {
          codigoLote: { type: 'string', minLength: 1, maxLength: 40 },
          organizacaoCodigo: { type: 'string', minLength: 1, maxLength: 40, description: 'Código da organização (como na AV1)' },
          notaFiscal: { type: 'string', minLength: 1, maxLength: 60 },
          transportadora: { type: 'string', minLength: 1, maxLength: 120 },
          dataEntrada: { type: 'string', format: 'date-time', description: 'ISO 8601; não futura e até 90 dias atrás; padrão: agora' },
          equipamentos: { type: 'array', maxItems: 500, items: equipamentoNovoSchema },
        },
      },
    },
  }, c.criar);

  app.get('/lotes', {
    onRequest: leitura,
    schema: {
      tags, summary: 'Lista lotes (ativos por padrão)', security: seguranca,
      querystring: {
        type: 'object',
        properties: {
          ...paginacaoQuery,
          ...situacaoQuery,
          organizacaoCodigo: { type: 'string', maxLength: 40 },
          status: { type: 'string', enum: ENUM_STATUS, description: 'Status do lote (derivado dos equipamentos)' },
          busca: { type: 'string', maxLength: 100, description: 'Código do lote ou nota fiscal' },
        },
      },
    },
  }, c.listar);

  app.get('/lotes/:id', {
    onRequest: leitura,
    schema: {
      tags, summary: 'Detalha lote com organização e equipamentos ordenados por posição (inativo => 404, salvo ?situacao=todos)',
      security: seguranca, params: uuidParam(), querystring: { type: 'object', properties: { ...situacaoQuery } },
    },
  }, c.obter);

  app.post('/lotes/:id/equipamentos', {
    onRequest: escrita,
    schema: {
      tags, summary: 'Cadastra equipamentos no lote (status inicial: recebido; posição = próxima da sequência)', security: seguranca,
      params: uuidParam(),
      body: {
        type: 'object',
        required: ['equipamentos'],
        properties: { equipamentos: { type: 'array', minItems: 1, maxItems: 500, items: equipamentoNovoSchema } },
      },
    },
  }, c.adicionarEquipamentos);

  app.put('/lotes/:id', {
    onRequest: escrita,
    schema: {
      tags, summary: 'Atualiza nota fiscal/transportadora (o status do lote é derivado, não editável). Exige a versão atual',
      security: seguranca, params: uuidParam(),
      body: {
        type: 'object',
        required: ['versao'],
        properties: {
          notaFiscal: { type: 'string', minLength: 1, maxLength: 60 },
          transportadora: { type: 'string', minLength: 1, maxLength: 120 },
          versao: { type: 'integer', minimum: 1 },
        },
      },
    },
  }, c.atualizar);

  app.delete('/lotes/:id', {
    onRequest: escrita,
    schema: { tags, summary: 'SOFT DELETE: inativa o lote (equipamentos ficam inativos por herança)', security: seguranca, params: uuidParam() },
  }, c.inativar);

  app.patch('/lotes/:id/reativar', {
    onRequest: escrita,
    schema: { tags, summary: 'Reativa o lote (a organização precisa estar ativa)', security: seguranca, params: uuidParam() },
  }, c.reativar);

  app.delete('/lotes/:id/definitivo', {
    onRequest: definitiva,
    schema: {
      tags, security: seguranca, params: uuidParam(),
      summary: 'DELETE FÍSICO em cascata: equipamentos, histórico e movimentações (irreversível; somente admin)',
    },
  }, c.removerDefinitivo);
};

export default routes;
