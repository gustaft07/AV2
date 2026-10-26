import { ESCALA_ESTADO_FISICO, STATUS_EQUIPAMENTO } from '../core/validation';
import { TODOS_OS_PAPEIS } from '../domain/Papel';
import { SITUACOES } from './situacao';

export const seguranca = [{ bearerAuth: [] }];

export const uuidParam = (nome = 'id') => ({
  type: 'object',
  required: [nome],
  properties: { [nome]: { type: 'string', format: 'uuid' } },
});

export const ENUM_PAPEL: string[] = [...TODOS_OS_PAPEIS];
export const ENUM_ESTADO_FISICO: string[] = [...ESCALA_ESTADO_FISICO];
export const ENUM_STATUS: string[] = [...STATUS_EQUIPAMENTO];

export const situacaoQuery = {
  situacao: {
    type: 'string',
    enum: SITUACOES,
    default: 'ativos',
    description: 'Soft delete: ativos (padrão), inativos ou todos',
  },
} as const;

/** Equipamento novo: código de barras e posição no lote são gerados pelo sistema. */
export const equipamentoNovoSchema = {
  type: 'object',
  required: ['tipo', 'estadoFisico'],
  additionalProperties: false, // campos extras (ex.: um codigoBarrasInterno enviado por engano) são ignorados
  properties: {
    tipo: { type: 'string', minLength: 1, maxLength: 60 },
    estadoFisico: { type: 'string', enum: ENUM_ESTADO_FISICO },
  },
} as const;
