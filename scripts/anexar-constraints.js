#!/usr/bin/env node
/**
 * Anexa prisma/constraints.sql ao migration.sql da migration inicial (pasta *_init mais recente).
 * Funciona igual em Windows, Linux e macOS (sem depender de cat/PowerShell, que divergem em codificação).
 *
 * Uso (ANTES de aplicar a migration):
 *   npx prisma migrate dev --create-only --name init
 *   npm run db:constraints
 *   npx prisma migrate dev
 */
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const pastaMigracoes = path.join(raiz, 'prisma', 'migrations');
const arquivoConstraints = path.join(raiz, 'prisma', 'constraints.sql');
const MARCADOR = 'organizacao_cnpj_formato_chk'; // nome de uma constraint, para detectar anexo anterior

function falhar(msg) {
  console.error('ERRO: ' + msg);
  process.exit(1);
}

if (!fs.existsSync(pastaMigracoes)) {
  falhar('prisma/migrations não existe. Rode antes: npx prisma migrate dev --create-only --name init');
}

const pastasInit = fs
  .readdirSync(pastaMigracoes)
  .filter((n) => /_init$/.test(n) && fs.statSync(path.join(pastaMigracoes, n)).isDirectory())
  .sort();

if (pastasInit.length === 0) {
  falhar('nenhuma migration "*_init" encontrada. Rode: npx prisma migrate dev --create-only --name init');
}

const alvo = path.join(pastaMigracoes, pastasInit[pastasInit.length - 1], 'migration.sql');
const atual = fs.readFileSync(alvo, 'utf8');

if (atual.includes(MARCADOR)) {
  console.log('As constraints já estão em ' + path.relative(raiz, alvo) + '. Nada a fazer.');
  process.exit(0);
}

const extra = fs.readFileSync(arquivoConstraints, 'utf8').replace(/\r\n/g, '\n');
fs.appendFileSync(alvo, '\n\n' + extra, 'utf8');
console.log('Constraints anexadas em ' + path.relative(raiz, alvo));
console.log('Agora aplique: npx prisma migrate dev');
