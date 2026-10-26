import { PrismaClient } from '@prisma/client';
import { FabricaEntidades } from '../src/domain/FabricaEntidades';
import { Movimentacao } from '../src/domain/Movimentacao';
import { Papel } from '../src/domain/Papel';
import { statusUnico } from '../src/domain/statusLote';
import type { EstadoFisico, StatusEquipamento } from '../src/core/validation';

const prisma = new PrismaClient();
const DIA_MS = 24 * 60 * 60 * 1000;
const haDias = (n: number) => new Date(Date.now() - n * DIA_MS).toISOString(); // respeita a regra dos 90 dias

async function main() {
  // limpeza (as exclusões em cascata do banco cuidam dos filhos)
  await prisma.organizacao.deleteMany();
  await prisma.usuario.deleteMany();

  // ---- usuários: um por papel + um inativo (soft delete) ----
  const contas: { login: string; senha: string; papel: Papel; ativo?: boolean }[] = [
    { login: 'admin', senha: 'Admin@123', papel: Papel.ADMIN },
    { login: 'cadastro', senha: 'Cadastro@123', papel: Papel.OPERADOR_CADASTRO },
    { login: 'almoxarifado', senha: 'Almox@123', papel: Papel.GESTOR_ALMOXARIFADO },
    { login: 'auditor', senha: 'Auditor@123', papel: Papel.AUDITOR },
    { login: 'ex.operador', senha: 'Antigo@1234', papel: Papel.OPERADOR_CADASTRO, ativo: false },
  ];
  for (const c of contas) {
    const u = FabricaEntidades.criarUsuario(c); // hash + sal como no CLI
    await prisma.usuario.create({
      data: {
        id: u.id, criadoEm: new Date(u.criadoEm), login: u.login,
        hashSenha: u.hashSenha, saltSenha: u.saltSenha, papel: u.papel, ativo: c.ativo ?? true,
      },
    });
  }

  // ---- organizações (CNPJs válidos) ----
  const criarOrg = async (
    d: Parameters<typeof FabricaEntidades.criarOrganizacao>[0],
    ativo = true,
  ) => {
    const o = FabricaEntidades.criarOrganizacao(d);
    return prisma.organizacao.create({
      data: {
        id: o.id, criadoEm: new Date(o.criadoEm), codigo: o.codigo, razaoSocial: o.razaoSocial,
        cnpj: o.cnpj, prazoArmazenamentoDias: o.prazoArmazenamentoDias, ativo,
        contrato: o.contratoColeta ? { create: { numero: o.contratoColeta } } : undefined,
      },
    });
  };
  const eco = await criarOrg({ codigo: 'ECO001', razaoSocial: 'EcoTech Ltda', cnpj: '11222333000181', contratoColeta: 'CT-2026-001' });
  const recicla = await criarOrg({ codigo: 'RCM002', razaoSocial: 'Recicla Mais S/A', cnpj: '11444777000161', contratoColeta: 'CT-2026-014', prazoArmazenamentoDias: 30 });
  await criarOrg({ codigo: 'SEM003', razaoSocial: 'Sem Contrato ME', cnpj: '45723174000110', contratoColeta: '' }); // sem contrato: NÃO pode receber lotes
  const inativa = await criarOrg({ codigo: 'INA004', razaoSocial: 'Inativa Ltda', cnpj: '34028316000103', contratoColeta: 'CT-2025-099' }, false);

  // ---- lotes + equipamentos ----
  // Código de barras = id (automático) e posição sequencial (1, 2, 3...). O status do lote segue a regra "todos iguais".
  const criarLote = async (
    organizacaoId: string,
    d: Parameters<typeof FabricaEntidades.criarLote>[0],
    itens: { tipo: string; estado: EstadoFisico; status?: StatusEquipamento }[],
    ativo = true,
  ) => {
    const l = FabricaEntidades.criarLote(d);
    const equips = itens.map((i) => {
      const e = FabricaEntidades.criarEquipamento({ loteId: l.id, tipo: i.tipo, estadoFisico: i.estado });
      if (i.status) e.status = i.status;
      return e;
    });
    await prisma.lote.create({
      data: {
        id: l.id, criadoEm: new Date(l.criadoEm), codigoLote: l.codigoLote, notaFiscal: l.notaFiscal,
        transportadora: l.transportadora, dataEntrada: new Date(l.dataEntrada), organizacaoId, ativo,
        status: statusUnico(equips.map((e) => e.status)) ?? 'recebido',
      },
    });
    await prisma.equipamento.createMany({
      data: equips.map((e, i) => ({
        id: e.id, criadoEm: new Date(e.criadoEm), codigoBarrasInterno: e.id, posicao: i + 1,
        tipo: e.tipo, estadoFisico: e.estadoFisico, status: e.status, loteId: l.id,
      })),
    });
    const movs = equips.map((e) => new Movimentacao({
      equipamentoId: e.id, tipo: 'cadastro', ator: 'almoxarifado', observacao: `Entrada no lote ${l.codigoLote}`,
    }));
    await prisma.movimentacao.createMany({
      data: movs.map((m) => ({
        id: m.id, criadoEm: new Date(m.criadoEm), equipamentoId: m.equipamentoId,
        tipo: m.tipo, ator: m.ator, observacao: m.observacao,
      })),
    });
    return equips;
  };

  // LT-0001: equipamentos em status diferentes => o status do lote permanece "recebido"
  const [, , impressora] = await criarLote(
    eco.id,
    { codigoLote: 'LT-0001', organizacaoCodigo: 'ECO001', notaFiscal: 'NF-1001', transportadora: 'TransLog', dataEntrada: haDias(10) },
    [
      { tipo: 'Notebook', estado: 'novo' },
      { tipo: 'Monitor', estado: 'usado_bom', status: 'triagem' },
      { tipo: 'Impressora', estado: 'usado_ruim', status: 'triagem_completa' },
      { tipo: 'Celular', estado: 'sucata', status: 'desmonte' },
    ],
  );

  // histórico coerente com a impressora: caiu de usado_bom para usado_ruim (2 categorias) com justificativa
  await prisma.historicoEstado.create({
    data: { equipamentoId: impressora.id, de: 'usado_bom', para: 'usado_ruim', justificativa: 'Cabeçote danificado e carcaça trincada' },
  });
  await prisma.movimentacao.create({
    data: {
      equipamentoId: impressora.id, tipo: 'alteracao_estado_fisico', ator: 'almoxarifado',
      observacao: 'usado_bom → usado_ruim | Cabeçote danificado e carcaça trincada',
    },
  });

  // LT-0002: todos os equipamentos em "triagem" => lote em "triagem"; organização de prazo curto (30 dias) => vencido
  await criarLote(
    recicla.id,
    { codigoLote: 'LT-0002', organizacaoCodigo: 'RCM002', notaFiscal: 'NF-2002', transportadora: 'RapidoCargo', dataEntrada: haDias(45) },
    [
      { tipo: 'Servidor', estado: 'usado_regular', status: 'triagem' },
      { tipo: 'Switch', estado: 'usado_bom', status: 'triagem' },
    ],
  );

  // LT-0003: lote inativo de organização inativa (soft delete em cadeia)
  await criarLote(
    inativa.id,
    { codigoLote: 'LT-0003', organizacaoCodigo: 'INA004', notaFiscal: 'NF-3003', transportadora: 'TransLog', dataEntrada: haDias(20) },
    [{ tipo: 'Roteador', estado: 'seminovo' }],
    false,
  );

  console.log('Seed concluído. Logins ativos: admin, cadastro, almoxarifado, auditor (ex.operador está inativo).');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
