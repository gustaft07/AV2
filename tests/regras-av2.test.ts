import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusUnico } from '../src/domain/statusLote';
import { compativelComSituacao, filtroAtivo } from '../src/shared/situacao';
import { PERMISSOES } from '../src/shared/permissoes';
import { Papel } from '../src/domain/Papel';

test('status do lote: só muda quando TODOS os equipamentos têm o mesmo status', () => {
  assert.equal(statusUnico(['triagem', 'triagem', 'triagem']), 'triagem');
  assert.equal(statusUnico(['triagem', 'recebido', 'triagem']), null); 
  assert.equal(statusUnico(['triagem']), 'triagem');
  assert.equal(statusUnico([]), null); 
});

test('soft delete: filtros de situação (ativos por padrão)', () => {
  assert.equal(filtroAtivo(), true);
  assert.equal(filtroAtivo('ativos'), true);
  assert.equal(filtroAtivo('inativos'), false);
  assert.equal(filtroAtivo('todos'), undefined);
  assert.equal(compativelComSituacao(true), true);
  assert.equal(compativelComSituacao(false), false); // inativo some da consulta padrão
  assert.equal(compativelComSituacao(false, 'todos'), true);
  assert.equal(compativelComSituacao(false, 'inativos'), true);
});

test('permissões: operadores não acessam recursos administrativos; admin acessa tudo', () => {
  const { OPERADOR_CADASTRO, GESTOR_ALMOXARIFADO, AUDITOR, ADMIN } = Papel;
  const grupos = Object.values(PERMISSOES) as readonly (readonly Papel[])[];

  // listagem de usuários: nenhum operador
  assert.equal(PERMISSOES.lerUsuarios.includes(OPERADOR_CADASTRO as never), false);
  assert.equal(PERMISSOES.lerUsuarios.includes(GESTOR_ALMOXARIFADO as never), false);
  assert.deepEqual([...PERMISSOES.gerirUsuarios], [ADMIN]);

  // cada operador só gerencia a sua área
  assert.equal(PERMISSOES.gerirCadastro.includes(GESTOR_ALMOXARIFADO as never), false);
  assert.equal(PERMISSOES.gerirAlmoxarifado.includes(OPERADOR_CADASTRO as never), false);
  assert.equal(PERMISSOES.lerAlmoxarifado.includes(OPERADOR_CADASTRO as never), false); // listagem bloqueada
  assert.equal(PERMISSOES.lerCadastro.includes(GESTOR_ALMOXARIFADO as never), false);

  // auditor: leitura, nunca escrita
  const escritas = [PERMISSOES.gerirUsuarios, PERMISSOES.gerirCadastro, PERMISSOES.gerirAlmoxarifado, PERMISSOES.exclusaoDefinitiva];
  for (const g of escritas) assert.equal((g as readonly Papel[]).includes(AUDITOR), false);

  // admin está em TODOS os grupos (acesso a todas as rotas)
  for (const g of grupos) assert.equal(g.includes(ADMIN), true);
});
