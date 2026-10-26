import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErroValidacao } from '../src/core/validation';
import { Equipamento } from '../src/domain/Equipamento';
import { FabricaEntidades } from '../src/domain/FabricaEntidades';
import { Papel } from '../src/domain/Papel';
import { verificarSenha } from '../src/core/crypto';

const novoEquip = () =>
  FabricaEntidades.criarEquipamento({ codigoBarras: 'EQ-1', loteId: 'L1', tipo: 'Notebook', estadoFisico: 'novo' });

test('equipamento nasce com status "recebido"', () => {
  assert.equal(novoEquip().status, 'recebido');
});

test('código de barras é gerado automaticamente e é igual ao id', () => {
  const e = FabricaEntidades.criarEquipamento({ loteId: 'L1', tipo: 'Notebook', estadoFisico: 'novo' });
  assert.equal(e.codigoBarras, e.id);
  assert.match(e.id, /^[0-9a-f-]{36}$/);
  const outro = FabricaEntidades.criarEquipamento({ loteId: 'L1', tipo: 'Notebook', estadoFisico: 'novo' });
  assert.notEqual(e.codigoBarras, outro.codigoBarras);
  assert.equal(novoEquip().codigoBarras, 'EQ-1');
});

test('rebaixar 2+ categorias exige justificativa (ErroValidacao -> 422 na API)', () => {
  const e = novoEquip();
  assert.throws(() => e.alterarEstadoFisico('usado_bom'), ErroValidacao);
  assert.throws(() => e.alterarEstadoFisico('usado_bom', 'ruim'), ErroValidacao);
  e.alterarEstadoFisico('usado_bom', 'Arranhões profundos e bateria viciada');
  assert.equal(e.estadoFisico, 'usado_bom');
  assert.equal(e.historicoEstado.length, 1);
  assert.equal(e.historicoEstado[0].de, 'novo');
});

test('fluxo de status: desmonte só após triagem_completa', () => {
  const e = novoEquip();
  assert.throws(() => e.alterarStatus('desmonte'), ErroValidacao); 
  assert.throws(() => e.alterarStatus('reciclagem'), ErroValidacao); 
  e.alterarStatus('triagem');
  e.alterarStatus('triagem_completa');
  e.alterarStatus('desmonte');
  e.alterarStatus('reciclagem');
  assert.equal(e.status, 'reciclagem');
  assert.throws(() => e.alterarStatus('triagem'), ErroValidacao); 
});

test('deJSON/paraJSON preservam os dados', () => {
  const e = novoEquip();
  const copia = Equipamento.deJSON(e.paraJSON());
  assert.deepEqual(copia.paraJSON(), e.paraJSON());
});

test('fábrica valida organização e lote', () => {
  assert.throws(
    () => FabricaEntidades.criarOrganizacao({ codigo: 'X', razaoSocial: 'Y', cnpj: '123', contratoColeta: '' }),
    ErroValidacao,
  );
  const agora = new Date().toISOString();
  assert.doesNotThrow(() =>
    FabricaEntidades.criarLote({ codigoLote: 'L', organizacaoCodigo: 'O', notaFiscal: 'NF', transportadora: 'T', dataEntrada: agora }),
  );
  assert.throws(
    () => FabricaEntidades.criarLote({ codigoLote: 'L', organizacaoCodigo: 'O', notaFiscal: '', transportadora: 'T' }),
    ErroValidacao,
  );
});

test('usuário: login válido e senha confere com o hash+sal da AV1', () => {
  const u = FabricaEntidades.criarUsuario({ login: 'maria.silva', senha: 'Segredo@123', papel: Papel.AUDITOR });
  assert.equal(verificarSenha('Segredo@123', u.hashSenha, u.saltSenha), true);
  assert.equal(verificarSenha('outra-senha', u.hashSenha, u.saltSenha), false);
  assert.throws(() => FabricaEntidades.criarUsuario({ login: 'a b', senha: 'x', papel: Papel.ADMIN }), ErroValidacao);
});
