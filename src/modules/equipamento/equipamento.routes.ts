import type { FastifyPluginAsync } from 'fastify';
import { EquipamentoController } from './equipamento.controller';
import { authorize } from '../../shared/authorize';
import { PERMISSOES } from '../../shared/permissoes';
import { ENUM_ESTADO_FISICO, ENUM_STATUS, seguranca, situacaoQuery, uuidParam } from '../../shared/schemas';
import { paginacaoQuery } from '../../shared/pagination';

const routes: FastifyPluginAsync = async (app) => {
  const c = new EquipamentoController(app);
  const tags = ['Equipamentos'];
  const leitura = [app.authenticate, authorize(PERMISSOES.lerAlmoxarifado)];
  const escrita = [app.authenticate, authorize(PERMISSOES.gerirAlmoxarifado)];

  // Equipamentos são cadastrados dentro de um lote: POST /lotes e POST /lotes/:id/equipamentos.
  // O código de barras (= id) e a posição no lote são gerados pelo sistema.

  app.get('/equipamentos', {
    onRequest: leitura,
    schema: {
      tags, summary: 'Lista equipamentos (de lotes ativos por padrão)', security: seguranca,
      querystring: {
        type: 'object',
        properties: {
          ...paginacaoQuery,
          ...situacaoQuery,
          status: { type: 'string', enum: ENUM_STATUS },
          estadoFisico: { type: 'string', enum: ENUM_ESTADO_FISICO },
          loteId: { type: 'string', format: 'uuid' },
          tipo: { type: 'string', maxLength: 60 },
          busca: { type: 'string', maxLength: 100, description: 'Código de barras (id) ou tipo' },
        },
      },
    },
  }, c.listar);

  app.get('/equipamentos/:id', {
    onRequest: leitura,
    schema: {
      tags, summary: 'Detalha equipamento com o histórico de estado físico', security: seguranca,
      params: uuidParam(), querystring: { type: 'object', properties: { ...situacaoQuery } },
    },
  }, c.obter);

  app.get('/equipamentos/:id/movimentacoes', {
    onRequest: leitura,
    schema: {
      tags, summary: 'Movimentações do equipamento', security: seguranca, params: uuidParam(),
      querystring: { type: 'object', properties: { ...paginacaoQuery, ...situacaoQuery } },
    },
  }, c.movimentacoes);

  app.patch('/equipamentos/:id/estado-fisico', {
    onRequest: escrita,
    schema: {
      tags,
      summary: 'Altera o estado físico. Queda de 2+ categorias exige justificativa (mín. 5 caracteres)',
      security: seguranca, params: uuidParam(),
      body: {
        type: 'object',
        required: ['novoEstado', 'versao'],
        properties: {
          novoEstado: { type: 'string', enum: ENUM_ESTADO_FISICO },
          justificativa: { type: 'string', maxLength: 500 },
          versao: { type: 'integer', minimum: 1 },
        },
      },
    },
  }, c.alterarEstadoFisico);

  app.patch('/equipamentos/:id/status', {
    onRequest: escrita,
    schema: {
      tags,
      summary: 'Altera o status ("desmonte" exige triagem_completa) e sincroniza o status do lote (só muda se TODOS forem iguais)',
      security: seguranca, params: uuidParam(),
      body: {
        type: 'object',
        required: ['novoStatus', 'versao'],
        properties: {
          novoStatus: { type: 'string', enum: ENUM_STATUS.filter((s) => s !== 'recebido') },
          observacao: { type: 'string', maxLength: 500 },
          versao: { type: 'integer', minimum: 1 },
        },
      },
    },
  }, c.alterarStatus);

  app.delete('/equipamentos/:id', {
    onRequest: escrita,
    schema: {
      tags, security: seguranca, params: uuidParam(),
      summary: 'DELETE FÍSICO direto (sem soft delete): remove também histórico e movimentações',
    },
  }, c.remover);
};

export default routes;
