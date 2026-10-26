import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ErroValidacao, exigeJustificativa, validarCNPJ, validarDataEntradaLote, validarTransicaoParaDesmonte,
} from '../src/core/validation';
import { normalizarCnpj } from '../src/shared/cnpj';

test('CNPJ: válidos, inválidos e normalização', () => {
  assert.equal(validarCNPJ('11222333000181'), true);
  assert.equal(validarCNPJ('11.222.333/0001-81'), true);
  assert.equal(validarCNPJ('11222333000182'), false);
  assert.equal(validarCNPJ('00000000000000'), false);
  assert.equal(normalizarCnpj('11.222.333/0001-81'), '11222333000181');
});

test('data de entrada: não pode ser futura nem ter mais de 90 dias', () => {
  const agora = new Date('2026-06-01T12:00:00Z');
  assert.doesNotThrow(() => validarDataEntradaLote('2026-05-25T00:00:00Z', agora));
  assert.throws(() => validarDataEntradaLote('2026-06-02T00:00:00Z', agora), ErroValidacao);
  assert.throws(() => validarDataEntradaLote('2026-01-01T00:00:00Z', agora), ErroValidacao);
  assert.throws(() => validarDataEntradaLote('nao-e-data', agora), ErroValidacao);
});

test('justificativa só é exigida ao rebaixar 2+ categorias', () => {
  assert.equal(exigeJustificativa('novo', 'seminovo'), false);
  assert.equal(exigeJustificativa('novo', 'usado_bom'), true);
  assert.equal(exigeJustificativa('usado_ruim', 'novo'), false);
});

test('desmonte só a partir de triagem_completa', () => {
  assert.doesNotThrow(() => validarTransicaoParaDesmonte('triagem_completa'));
  assert.throws(() => validarTransicaoParaDesmonte('triagem'), ErroValidacao);
  assert.throws(() => validarTransicaoParaDesmonte('recebido'), ErroValidacao);
});
