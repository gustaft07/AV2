# greencode — API de Logística Reversa de Eletrônicos (AV2)

API RESTful monolítica que evolui o CLI **greencode** (AV1) para um servidor HTTP com banco relacional **MySQL**.
O domínio, as validações e a criptografia de senha da AV1 foram **reaproveitados**; esta versão acrescenta persistência,
autenticação JWT, controle de acesso por perfil, **soft delete em cadeia**, status de lote derivado dos equipamentos e
documentação interativa (Swagger).

## Sumário

1. [Visão geral do sistema](#1-visão-geral-do-sistema)
2. [Pré-requisitos de ambiente](#2-pré-requisitos-de-ambiente)
3. [Configuração de variáveis de ambiente](#3-configuração-de-variáveis-de-ambiente)
4. [Instalação e configuração inicial](#4-instalação-e-configuração-inicial)
5. [Como executar o projeto](#5-como-executar-o-projeto)
6. [Documentação da API e autenticação](#6-documentação-da-api-e-autenticação)
7. [Guia de permissões e regras de negócio](#7-guia-de-permissões-e-regras-de-negócio)
8. [Testes](#8-testes)
9. [Docker (opcional)](#9-docker-opcional)
10. [Solução de problemas](#10-solução-de-problemas)
11. [Estrutura do repositório](#11-estrutura-do-repositório)

---

## 1. Visão geral do sistema

### Arquitetura

Monólito em camadas, organizado por módulo de domínio. Cada módulo segue o padrão **Controller → Service → Repository**:

```
Requisição HTTP
      │
      ▼
┌─────────────┐   interpreta parâmetros, chama o service, devolve a resposta
│ Controller  │
└─────┬───────┘
      ▼
┌─────────────┐   regras de negócio, validações, transações ($transaction),
│  Service    │   controle de concorrência (lock otimista e trava de lote)
└─────┬───────┘
      ▼
┌─────────────┐   único ponto de acesso ao Prisma; converte linhas do banco
│ Repository  │   em entidades de domínio e vice-versa
└─────┬───────┘
      ▼
    MySQL
```

A **camada de domínio** (`src/core` e `src/domain`) vem da AV1: entidades (`Usuario`, `Organizacao`, `Lote`,
`Equipamento`, `Movimentacao`), a `FabricaEntidades`, as validações (`validarCNPJ`, `validarDataEntradaLote`, regras de
estado físico e de desmonte) e a criptografia de senha (`hashSenha`/`verificarSenha`).

### Tecnologias

| Camada | Tecnologia |
|---|---|
| Runtime / linguagem | Node.js 20+ · TypeScript |
| Servidor HTTP | Fastify 5 (validação por JSON Schema, plugins) |
| Persistência | Prisma ORM 6 · **MySQL 8** (InnoDB) |
| Autenticação | JWT (`@fastify/jwt`), senha com hash + sal (módulo `crypto` do Node) |
| Documentação | Swagger / OpenAPI (`@fastify/swagger` + `@fastify/swagger-ui`) |
| Testes | `node:test` executado via `tsx` |

### Funcionalidades

- Cadastro de **organizações** e de seus **contratos de coleta**.
- Registro de **lotes** (somente em organizações ativas **com contrato**) e de seus **equipamentos**, em uma transação.
- **Código de barras** (= id do equipamento) e **posição no lote** gerados automaticamente.
- **Status do lote derivado**: só muda quando todos os equipamentos têm o mesmo status.
- **Soft delete em cadeia** (usuário, organização, lote) e **delete físico** (equipamento, contrato).
- Controle de **estado físico** (justificativa obrigatória em quedas bruscas) e de **status** do equipamento.
- **Trilha de movimentações** imutável, histórico de estado físico e **relatórios**.
- **Perfis de acesso** com rotas e listagens bloqueadas por papel.
- **Lock otimista** (`versao`) em todas as atualizações e **graceful shutdown**.

---

## 2. Pré-requisitos de ambiente

| Componente | Versão | Observações |
|---|---|---|
| **Node.js** | **20 LTS ou superior** (22 LTS recomendado) | `npm` já vem junto |
| **MySQL** | **8.0.16 ou superior** (8.0 / 8.4) | **Obrigatório 8.0.16+**: antes disso o `CHECK` é aceito mas ignorado |
| **Git** | qualquer recente | para clonar o repositório |
| Docker | opcional | apenas para subir o MySQL sem instalá-lo (ver [seção 9](#9-docker-opcional)) |

### Sistemas operacionais suportados

O sistema foi concebido para ser comercializado com facilidade nas plataformas abaixo, por isso **não usa nenhuma
dependência com compilação nativa** (a criptografia usa o módulo `crypto` nativo do Node e o executor é o `tsx`):

| Sistema | Versão alvo |
|---|---|
| Windows | 10 ou superior |
| Linux | Ubuntu 24.04.03 ou superior e distribuições derivadas do Ubuntu |

### Instalando os pré-requisitos

**Ubuntu 24.04+ (e derivadas)**

```bash
# Node.js 22 LTS (via NodeSource)
sudo apt update && sudo apt install -y curl ca-certificates
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# MySQL (o Ubuntu 24.04 traz o MySQL 8.0 nos repositórios)
sudo apt install -y mysql-server
sudo systemctl enable --now mysql

node -v && npm -v && mysql --version
```

**Windows 10+**

1. Instale o Node.js LTS em <https://nodejs.org> (instalador `.msi`, mantenha a opção "Add to PATH").
2. Instale o **MySQL Community Server 8.x** com o *MySQL Installer* (<https://dev.mysql.com/downloads/installer/>),
   anote a senha do usuário `root` e mantenha a porta `3306`.
3. Abra um **novo** terminal (PowerShell ou Git Bash) e confira:

```powershell
node -v
npm -v
mysql --version
```

> Se o PowerShell bloquear scripts do `npm` ("a execução de scripts foi desabilitada neste sistema"), rode uma vez:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

### Criando o banco de dados

O Prisma precisa de um usuário com permissão de criar bancos, porque o comando `prisma migrate dev` usa um banco
temporário ("shadow database"). Em **desenvolvimento**, o jeito mais simples é conceder privilégios amplos ao usuário.

**Ubuntu / Linux**

```bash
sudo mysql <<'SQL'
CREATE DATABASE greencode CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'greencode'@'localhost' IDENTIFIED BY 'greencode';
GRANT ALL PRIVILEGES ON *.* TO 'greencode'@'localhost';
FLUSH PRIVILEGES;
SQL
```

**Windows (PowerShell)** — informe a senha do `root` quando solicitado:

```powershell
mysql -u root -p -e "CREATE DATABASE greencode CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; CREATE USER 'greencode'@'localhost' IDENTIFIED BY 'greencode'; GRANT ALL PRIVILEGES ON *.* TO 'greencode'@'localhost'; FLUSH PRIVILEGES;"
```

> Usando o Docker ([seção 9](#9-docker-opcional)), este passo é desnecessário: o container já cria o banco.
> Em **produção**, use um usuário restrito ao banco `greencode` e o comando `prisma migrate deploy`, que não precisa de shadow database.

---

## 3. Configuração de variáveis de ambiente

O projeto lê as variáveis de um arquivo `.env` na raiz. Copie o modelo e ajuste os valores:

```bash
cp .env.example .env          # Linux / macOS / Git Bash
copy .env.example .env        # Windows (cmd)
Copy-Item .env.example .env   # Windows (PowerShell)
```

Conteúdo do `.env.example`:

```env
# Porta em que o servidor HTTP escuta
PORT=3000

# String de conexão com o MySQL.
# Com o docker-compose do projeto, o usuário é "root" e a senha "greencode".
# Com o MySQL instalado localmente (seção 2), use: mysql://greencode:greencode@localhost:3306/greencode
DATABASE_URL="mysql://root:greencode@localhost:3306/greencode"

# Segredo usado para assinar e validar os tokens JWT
JWT_SECRET="troque-por-um-segredo-longo-e-aleatorio"
```

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `PORT` | não | `3000` | Porta do servidor. O servidor escuta em todas as interfaces (`0.0.0.0`). |
| `DATABASE_URL` | **sim** | — | URL no formato `mysql://USUARIO:SENHA@HOST:PORTA/BANCO`. Se a senha tiver caracteres especiais (`@`, `/`, `:`, `#`), codifique-os (ex.: `@` → `%40`). |
| `JWT_SECRET` | **sim** | — | Chave secreta dos tokens. Use um valor longo e imprevisível. Quem a conhece consegue forjar tokens válidos. |

A aplicação **não inicia** se `DATABASE_URL` ou `JWT_SECRET` estiverem ausentes.

Para gerar um segredo forte:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> Nunca versione o arquivo `.env` (ele já está no `.gitignore`). O tempo de expiração do token (1 hora) é definido em `src/plugins/jwt.ts`.

---

## 4. Instalação e configuração inicial

Execute os passos abaixo, **na raiz do projeto**, nesta ordem. Os comandos são os mesmos em Windows e Linux.

### Passo 1 — Instalar as dependências

```bash
npm install
```

O `@prisma/client` normalmente gera o cliente do Prisma automaticamente. Se o TypeScript reclamar de tipos do
Prisma ausentes, gere manualmente: `npx prisma generate`.

### Passo 2 — Criar a migration inicial (sem aplicá-la ainda)

```bash
npx prisma migrate dev --create-only --name init
```

Isso gera `prisma/migrations/<data>_init/migration.sql` a partir do `schema.prisma`.

### Passo 3 — Anexar as constraints do banco

O Prisma não declara `CHECK` no `schema.prisma`. As regras extras de integridade (CNPJ com 14 dígitos, formato do login,
prazo positivo, regra da justificativa do histórico, **código de barras igual ao id** e posição ≥ 1) ficam em
`prisma/constraints.sql`. O script abaixo as anexa à migration, igual em qualquer sistema operacional:

```bash
npm run db:constraints
```

O script é idempotente (rodar duas vezes não duplica) e **deve ser executado antes** de aplicar a migration.

### Passo 4 — Aplicar a migration

```bash
npx prisma migrate dev
```

### Passo 5 — Popular o banco com dados de teste (seed)

```bash
npx prisma db seed
```

> ⚠️ **O seed apaga todas as organizações (e, em cascata, contratos, lotes, equipamentos e movimentações) e todos os
> usuários** antes de inserir os dados de teste. **Nunca execute em produção.**

#### O que o seed cria

**Usuários (um por perfil, mais um inativo):**

| Login | Senha | Perfil | Situação |
|---|---|---|---|
| `admin` | `Admin@123` | `admin` | ativo |
| `cadastro` | `Cadastro@123` | `operador_cadastro` | ativo |
| `almoxarifado` | `Almox@123` | `gestor_almoxarifado` | ativo |
| `auditor` | `Auditor@123` | `auditor` | ativo |
| `ex.operador` | `Antigo@1234` | `operador_cadastro` | **inativo** (não autentica) |

**Organizações:**

| Código | Razão social | CNPJ | Contrato | Prazo | Situação | Pode receber lotes? |
|---|---|---|---|---|---|---|
| `ECO001` | EcoTech Ltda | 11.222.333/0001-81 | CT-2026-001 | 90 dias | ativa | ✅ |
| `RCM002` | Recicla Mais S/A | 11.444.777/0001-61 | CT-2026-014 | 30 dias | ativa | ✅ |
| `SEM003` | Sem Contrato ME | 45.723.174/0001-10 | *(nenhum)* | 90 dias | ativa | ❌ sem contrato |
| `INA004` | Inativa Ltda | 34.028.316/0001-03 | CT-2025-099 | 90 dias | **inativa** | ❌ inativa |

**Lotes e equipamentos** (código de barras = id do equipamento; posição automática):

| Lote | Organização | Entrada | Status do lote | Equipamentos (posição: tipo / estado / status) |
|---|---|---|---|---|
| `LT-0001` | `ECO001` | há 10 dias | `recebido` (status diferentes entre si) | 1: Notebook / novo / recebido · 2: Monitor / usado_bom / triagem · 3: Impressora / usado_ruim / triagem_completa · 4: Celular / sucata / desmonte |
| `LT-0002` | `RCM002` | há 45 dias | `triagem` (todos iguais) | 1: Servidor / usado_regular / triagem · 2: Switch / usado_bom / triagem — **vencido** para o prazo de 30 dias |
| `LT-0003` | `INA004` | há 20 dias | `recebido` | 1: Roteador / seminovo / recebido — **lote inativo** |

> As datas do seed são calculadas em relação ao momento da execução, para respeitar a regra de entrada de lotes (no máximo 90 dias).

Para zerar e repopular o banco: `npx prisma migrate reset` (pede confirmação, reaplica as migrations e roda o seed).

---

## 5. Como executar o projeto

### Modo desenvolvimento

```bash
npm run dev
```

Inicia o servidor com recarga automática (`tsx watch`). Ao subir, estarão disponíveis:

| Recurso | URL |
|---|---|
| API | `http://localhost:3000` |
| Swagger (documentação interativa) | `http://localhost:3000/docs` |
| Health check | `http://localhost:3000/health` |

### Modo produção

```bash
npm run build                 # compila o TypeScript para dist/
npx prisma migrate deploy     # aplica as migrations já versionadas (não cria novas e não roda o seed)
npm start                     # node dist/server.js
```

Em produção, defina `JWT_SECRET` e `DATABASE_URL` reais no ambiente, e **não** use o seed nem os usuários de teste.

### Graceful shutdown

O servidor trata os sinais `SIGINT` (`Ctrl+C`) e `SIGTERM` (encerramento por Docker/systemd). Ao recebê-los:

1. registra `"<SINAL> recebido, encerrando..."` no log;
2. **para de aceitar novas conexões** e aguarda a conclusão das requisições em andamento (`app.close()`);
3. executa o hook `onClose`, que **desconecta o Prisma** do banco;
4. encerra o processo com código `0`.

Se o encerramento ordenado não terminar em **10 segundos**, o processo é finalizado à força com código `1`.

> No Windows, o sinal confiável é o `Ctrl+C` (`SIGINT`); `SIGTERM` tem suporte limitado no sistema.
> Em container, o `Dockerfile` usa `exec node ...` para que o Node seja o processo principal e receba o `SIGTERM`.

---

## 6. Documentação da API e autenticação

### Swagger

Com o servidor no ar, abra **`http://localhost:3000/docs`**. Todas as rotas, schemas de entrada e perfis estão documentados.
Fluxo recomendado: execute `POST /auth/login`, copie o `token`, clique em **Authorize** e cole o token. Depois, qualquer rota pode ser executada pela própria página.

### Obtendo o token JWT

`POST /auth/login` com `login` e `senha`. O token vale por **1 hora**.

**Linux / macOS / Git Bash (curl + jq):**

```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"login":"almoxarifado","senha":"Almox@123"}'
```

Resposta:

```json
{ "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

Guardando o token em uma variável:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"login":"almoxarifado","senha":"Almox@123"}' | jq -r .token)
```

**Windows (PowerShell):**

```powershell
$resp  = Invoke-RestMethod -Method Post -Uri http://localhost:3000/auth/login `
         -ContentType 'application/json' `
         -Body '{"login":"almoxarifado","senha":"Almox@123"}'
$token = $resp.token
```

### Enviando o token nas requisições protegidas

Todas as rotas, exceto `POST /auth/login` e `GET /health`, exigem o cabeçalho:

```
Authorization: Bearer <token>
```

```bash
# Linux / macOS / Git Bash
curl -s http://localhost:3000/lotes -H "authorization: Bearer $TOKEN"
```

```powershell
# Windows (PowerShell)
Invoke-RestMethod -Uri http://localhost:3000/lotes -Headers @{ Authorization = "Bearer $token" }
```

Para conferir quem é o usuário do token: `GET /auth/me`. A cada requisição o servidor confere se a conta continua
**ativa** e usa o **papel atual** do banco: inativar um usuário ou trocar o papel dele vale imediatamente, mesmo com token ainda não expirado.

### Endpoints

Listagens são paginadas com `?page=1&limit=20` (máximo 100) e respondem
`{ "data": [...], "total": 0, "page": 1, "limit": 20, "totalPages": 0 }`.
Consultas mostram só registros **ativos**; use `?situacao=inativos` ou `?situacao=todos` para ver os inativados.

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/auth/login` | Autentica e devolve o token (público) |
| `GET` | `/auth/me` | Dados do usuário autenticado |
| `POST` `GET` | `/usuarios` | Cria / lista contas |
| `PATCH` | `/usuarios/:id` | Altera papel ou senha (exige `versao`) |
| `DELETE` | `/usuarios/:id` | **Soft delete**: inativa o usuário |
| `PATCH` | `/usuarios/:id/reativar` | Reativa |
| `DELETE` | `/usuarios/:id/definitivo` | **Delete físico** (somente admin) |
| `POST` `GET` | `/organizacoes` | Cadastra (`contratoColeta` opcional) / lista (`?busca=`) |
| `GET` `PUT` | `/organizacoes/:id` | Detalha (com contrato) / atualiza (exige `versao`) |
| `DELETE` | `/organizacoes/:id` | **Soft delete em cadeia**: inativa a organização e seus lotes |
| `PATCH` | `/organizacoes/:id/reativar` | Reativa só a organização |
| `DELETE` | `/organizacoes/:id/definitivo` | **Delete físico em cascata** (somente admin) |
| `DELETE` | `/organizacoes/:id/contrato` | **Delete físico** direto do contrato |
| `POST` `GET` | `/lotes` | Registra (exige organização ativa **com contrato**) / lista (`status`, `organizacaoCodigo`, `busca`) |
| `GET` `PUT` | `/lotes/:id` | Detalha (equipamentos por posição) / atualiza nota fiscal e transportadora |
| `POST` | `/lotes/:id/equipamentos` | Cadastra equipamentos (código de barras e posição automáticos) |
| `DELETE` | `/lotes/:id` | **Soft delete**: inativa o lote |
| `PATCH` | `/lotes/:id/reativar` | Reativa (a organização precisa estar ativa) |
| `DELETE` | `/lotes/:id/definitivo` | **Delete físico em cascata** (somente admin) |
| `GET` | `/equipamentos`, `/equipamentos/:id` | Consulta (`status`, `estadoFisico`, `loteId`, `tipo`, `busca`) |
| `GET` | `/equipamentos/:id/movimentacoes` | Trilha do equipamento |
| `PATCH` | `/equipamentos/:id/estado-fisico` | Altera o estado físico |
| `PATCH` | `/equipamentos/:id/status` | Altera o status e sincroniza o status do lote |
| `DELETE` | `/equipamentos/:id` | **Delete físico** direto |
| `GET` | `/movimentacoes` | Trilha geral (`?equipamentoId=`, `?tipo=`, `?ator=`) |
| `GET` | `/relatorios/resumo` | Totais e distribuições (dados ativos) |
| `GET` | `/relatorios/prazo-armazenamento` | Lotes pendentes x prazo da organização (`?somenteVencidos=true`) |

### Exemplo completo: registrar um lote com equipamentos

```bash
curl -s -X POST http://localhost:3000/lotes \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{
    "codigoLote": "LT-0100",
    "organizacaoCodigo": "ECO001",
    "notaFiscal": "NF-9001",
    "transportadora": "TransLog",
    "equipamentos": [
      { "tipo": "Notebook", "estadoFisico": "usado_bom" },
      { "tipo": "Monitor",  "estadoFisico": "novo" }
    ]
  }'
```

O código de barras **não é enviado**: a resposta traz `codigoBarrasInterno` (igual ao `id`) e `posicao` 1, 2, ...

### Padrão de erros

As respostas de erro têm o formato `{ "message": "..." }`.

| Código | Significado | Exemplos |
|---|---|---|
| `400` | Corpo/parâmetros fora do schema | campo obrigatório ausente, tipo errado |
| `401` | Sem token, token inválido/expirado, credencial incorreta ou conta inativa | login errado, usuário inativado |
| `403` | Perfil sem permissão para a operação | operador listando usuários, auditor criando lote |
| `404` | Não encontrado | id inexistente, **registro inativo** na consulta padrão |
| `409` | Conflito | valor duplicado, **versão desatualizada**, já inativo/ativo, edição de registro inativo |
| `422` | Regra de negócio violada | CNPJ inválido, data futura, **organização sem contrato**, justificativa ausente, transição inválida |
| `500` | Erro interno | — |

---

## 7. Guia de permissões e regras de negócio

### 7.1 Perfis de acesso (rotas **e listagens** bloqueadas por papel)

| Operação | admin | operador_cadastro | gestor_almoxarifado | auditor |
|---|:---:|:---:|:---:|:---:|
| **Listar / consultar usuários** | ✅ | ❌ | ❌ | ✅ |
| Criar, alterar, inativar e reativar usuários | ✅ | ❌ | ❌ | ❌ |
| Consultar organizações e contratos | ✅ | ✅ | ❌ | ✅ |
| Criar, editar, inativar, reativar organizações; excluir contrato | ✅ | ✅ | ❌ | ❌ |
| Consultar lotes, equipamentos e movimentações | ✅ | ❌ | ✅ | ✅ |
| Registrar/editar/inativar lotes; cadastrar, alterar e excluir equipamentos | ✅ | ❌ | ✅ | ❌ |
| Relatórios | ✅ | ❌ | ❌ | ✅ |
| **Exclusão definitiva** (`/definitivo`) de usuário, organização e lote | ✅ | ❌ | ❌ | ❌ |

- O **admin tem acesso a todas as rotas**, mas seu foco é a gestão de usuários. Os **operadores não acessam recursos
  administrativos** (nem a listagem de usuários) e só enxergam a própria área.
- O **auditor** apenas consulta e gera relatórios; nunca escreve.
- O gestor de almoxarifado registra lotes informando o `organizacaoCodigo`, sem precisar listar organizações.
- A matriz está centralizada em `src/shared/permissoes.ts`.

Regras de contas: somente o admin gerencia contas; ninguém pode inativar, excluir ou mudar o papel **da própria conta**;
login com 3+ caracteres (letras, números, `.`, `_`, `-`); senha com 8+ caracteres; usuário inativo não autentica.

### 7.2 Política de exclusão

| Entidade | Soft delete (inativar) | Delete físico |
|---|---|---|
| **Usuário** | `DELETE /usuarios/:id` | `DELETE /usuarios/:id/definitivo` (admin) |
| **Organização** | `DELETE /organizacoes/:id` — **em cadeia**: inativa todos os lotes | `DELETE /organizacoes/:id/definitivo` (admin) — cascata total |
| **Lote** | `DELETE /lotes/:id` | `DELETE /lotes/:id/definitivo` (admin) — cascata |
| **Equipamento** | — (sem soft delete) | `DELETE /equipamentos/:id` — direto |
| **Contrato** | — (sem soft delete) | `DELETE /organizacoes/:id/contrato` — direto, sem restrições |

Como funciona o soft delete:

- Inativar define `ativo = false`. O registro some das consultas padrão (`GET /x/:id` responde `404`; use `?situacao=todos`
  ou `?situacao=inativos` para vê-lo) e **não aceita alterações** até ser reativado.
- Os **equipamentos não têm soft delete próprio**: ficam **inativos por herança** quando o lote está inativo (e o lote,
  quando a organização é inativada). Por isso somem das listagens, relatórios e movimentações padrão e não aceitam troca de status.
- **Reativar** uma organização reativa só a organização; os lotes são reativados um a um (`PATCH /lotes/:id/reativar`),
  e um lote só reativa se a organização estiver ativa.
- Inativar uma organização **não tem restrição** por contrato: pode ser inativada mesmo com contrato.

Como funciona o delete físico:

- É **irreversível** e em **cascata no banco**: excluir a organização remove o contrato, os lotes, os equipamentos, o
  histórico de estado e as movimentações. Excluir um lote remove seus equipamentos e histórico. Excluir um equipamento
  remove seu histórico e suas movimentações.
- Excluir o **contrato** não inativa a organização, mas ela deixa de poder receber novos lotes.

### 7.3 Contratos e organizações

- O contrato é opcional no cadastro: informe `contratoColeta` em `POST /organizacoes` ou depois, em `PUT /organizacoes/:id`
  (substitui o número existente). No máximo **um contrato por organização**, e o número é **único** (duplicado → `409`).
- **Lote só pode ser registrado em organização ATIVA e COM CONTRATO.** Sem contrato (ou com a organização inativa) →
  `422`. Como contrato só tem exclusão física, **"contrato ativo" significa contrato existente**.
- **CNPJ**: validado pelos dígitos verificadores, armazenado só com os 14 dígitos, **único** e imutável.
- `codigo` da organização é obrigatório e único: é por ele que os lotes referenciam a organização (`organizacaoCodigo`).
- `prazoArmazenamentoDias` (padrão **90**) é a base do relatório `/relatorios/prazo-armazenamento`.

### 7.4 Lotes

- Obrigatórios: `codigoLote` (único), `organizacaoCodigo` (precisa existir → `404`), `notaFiscal`, `transportadora`.
- **`dataEntrada`** (ISO 8601; padrão: agora): **não pode ser futura** nem **anterior a 90 dias** → `422`.
- Os equipamentos podem vir junto com o lote. A operação é **transacional**: se algo falhar, **nada é gravado**.
- Depois de criado, só `notaFiscal` e `transportadora` podem ser editados.
- **O status do lote é derivado e não é editável.** Ele só muda quando **todos** os equipamentos do lote têm o mesmo status.
  Exemplo: lote com 3 equipamentos `recebido`. Passar **um** para `triagem` não altera o lote (continua `recebido`);
  quando o **terceiro** também chega a `triagem`, o lote vira `triagem`. A regra é reavaliada a cada troca de status,
  cadastro ou exclusão de equipamento.

### 7.5 Equipamentos

- **Código de barras**: gerado pelo sistema e **igual ao `id`** do equipamento (`codigoBarrasInterno`). Não é aceito na entrada.
- **Posição no lote**: automática e sequencial (1, 2, 3...), única por lote. Não é reaproveitada se um equipamento for excluído.
- Todo equipamento nasce com status **`recebido`** e gera a movimentação `cadastro`.

**Estado físico** — escala: `novo` → `seminovo` → `usado_bom` → `usado_regular` → `usado_ruim` → `sucata`.
Uma queda de **2 ou mais categorias** exige `justificativa` com **pelo menos 5 caracteres** (`422` sem ela). Cada troca grava
uma linha em `HistoricoEstado` e a movimentação `alteracao_estado_fisico`, na mesma transação.

**Status** — fluxo:

```
recebido → triagem → triagem_completa ─┬→ desmonte → reciclagem
                                       │            └→ descarte_seguro
                                       ├→ revenda
                                       └→ descarte_seguro
```

- **`desmonte` só é permitido a partir de `triagem_completa`** (regra da AV1).
- `reciclagem`, `descarte_seguro` e `revenda` são estados finais.
- As demais transições estendem a regra da AV1 e podem ser ajustadas em `src/domain/transicoesStatus.ts`.

### 7.6 Concorrência: campo `versao` (lock otimista)

Todo registro editável carrega `versao`. Para atualizar, **envie a `versao` que você leu**:

```json
{ "novoStatus": "triagem", "versao": 2 }
```

Se outra pessoa alterou o registro antes, a versão fica desatualizada e a API responde **`409`**. Releia e repita com a versão atual.
Além disso, operações que dependem do conjunto de equipamentos do lote (posição e status do lote) travam o lote durante
a transação, para que requisições simultâneas não gerem posições repetidas nem um status de lote inconsistente.

### 7.7 Roteiro rápido de validação

Use `?busca=<tipo>` em `/equipamentos` para localizar um equipamento do seed (ex.: `?busca=Notebook`) e copie `id` e `versao`.

| # | Ação (perfil) | Resultado esperado |
|---|---|---|
| 1 | `POST /auth/login` com `almoxarifado` | `200` + `token` |
| 2 | `GET /lotes` sem token | `401` |
| 3 | `GET /usuarios` com `cadastro` ou `almoxarifado` | `403` |
| 4 | `GET /usuarios` com `auditor` / `admin` | `200` |
| 5 | `GET /organizacoes` com `almoxarifado` | `403` |
| 6 | `POST /lotes` (almoxarifado) em `SEM003` | `422` (sem contrato) |
| 7 | `POST /lotes` (almoxarifado) em `INA004` | `422` (organização inativa) |
| 8 | `POST /lotes` em `ECO001` com 2 equipamentos | `201`; posições 1 e 2; `codigoBarrasInterno` = `id` |
| 9 | `PATCH` status `triagem` em **um** dos 2 equipamentos; depois `GET /lotes/:id` | status do lote continua `recebido` |
| 10 | `PATCH` status `triagem` no **outro** equipamento; `GET /lotes/:id` | status do lote passa a `triagem` |
| 11 | `PATCH` status `desmonte` em equipamento `recebido` | `422` |
| 12 | `PATCH .../estado-fisico` de `novo` para `usado_bom` sem justificativa | `422`; com justificativa e `versao` correta → `200` |
| 13 | Repetir um `PATCH` com a `versao` antiga | `409` |
| 14 | `DELETE /organizacoes/:id` da `ECO001` (cadastro) | `200` com `lotesInativados`; `GET /lotes` não lista mais os lotes dela; `GET /lotes?situacao=inativos` lista |
| 15 | `POST /lotes` em `ECO001` agora | `422` (organização inativa) |
| 16 | `PATCH /organizacoes/:id/reativar` | `200`; lotes seguem inativos até `PATCH /lotes/:id/reativar` |
| 17 | `DELETE /organizacoes/:id/contrato` e depois `POST /lotes` na mesma organização | `204`, depois `422` |
| 18 | `DELETE /equipamentos/:id` | `204`; a posição dele não é reaproveitada |
| 19 | `DELETE /organizacoes/:id/definitivo` com `cadastro` / com `admin` | `403` / `204` (cascata) |
| 20 | `GET /relatorios/prazo-armazenamento?somenteVencidos=true` (auditor) | `LT-0002` aparece como vencido |

---

## 8. Testes

Os testes de unidade cobrem as regras do domínio e **não precisam de banco de dados**: CNPJ, data de entrada, justificativa
de estado físico, regra do desmonte, fluxo de status, hash/verificação de senha, **código de barras = id**, **regra do
status único do lote**, filtros de soft delete e a **matriz de permissões**:

```bash
npm test
```

Para conferir a tipagem de todo o projeto: `npm run build`.

---

## 9. Docker (opcional)

O Docker **não é obrigatório**. Serve apenas para subir o MySQL sem instalá-lo (e, opcionalmente, a própria API).
Com Docker Desktop (Windows) ou Docker Engine + plugin Compose (Ubuntu):

```bash
docker compose up -d          # sobe apenas o MySQL 8.0 (root/greencode, banco "greencode")
docker compose ps             # o serviço "db" deve aparecer como "healthy"
```

Em seguida, siga normalmente a partir do [Passo 1 da seção 4](#4-instalação-e-configuração-inicial).

Para rodar **também a API** em container (exige que `prisma/migrations/` já exista, conforme a seção 4):

```bash
docker compose --profile full up -d --build
docker compose logs -f api
```

Comandos úteis:

```bash
docker compose stop           # para os containers (dados preservados)
docker compose down           # remove os containers (dados preservados no volume)
docker compose down -v        # remove também o volume: APAGA todos os dados do banco
```

---

## 10. Solução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| `Variável de ambiente obrigatória ausente: ...` | `.env` inexistente ou incompleto | Crie o `.env` a partir do `.env.example` ([seção 3](#3-configuração-de-variáveis-de-ambiente)) |
| `P1001: Can't reach database server` | MySQL parado ou `DATABASE_URL` incorreta | Confirme o serviço (`sudo systemctl status mysql` ou `docker compose ps`) e revise host, porta, usuário e senha |
| `P1000: Authentication failed` / `Access denied` | Usuário/senha do `DATABASE_URL` não conferem | Ajuste a URL ou recrie o usuário (seção 2) |
| `P3014` / "could not create the shadow database" | O usuário não pode criar bancos | Conceda `GRANT ALL PRIVILEGES ON *.* ...` em desenvolvimento (seção 2) ou use `root` |
| `EADDRINUSE: address already in use :::3000` | Porta ocupada | Mude `PORT` no `.env` ou finalize o processo que a usa |
| `nenhuma migration "*_init" encontrada` (ao rodar `npm run db:constraints`) | Passo 2 não executado | Rode `npx prisma migrate dev --create-only --name init` primeiro |
| Erro ao aplicar a migration depois de anexar as constraints | MySQL abaixo de 8.0.16 ou DDL aplicada pela metade (o MySQL não desfaz DDL) | Use MySQL 8.0.16+ e rode `npx prisma migrate reset` |
| `Drift detected` / checksum divergente | A migration foi alterada depois de aplicada | Em desenvolvimento: `npx prisma migrate reset` e refaça os passos 2 a 5 |
| Erros de tipos do Prisma (`Papel`, `EstadoFisico`...) | Cliente do Prisma não gerado | `npx prisma generate` |
| `401` em todas as rotas | Token ausente, expirado (1h), mal formatado ou conta inativada | Refaça o login e envie `Authorization: Bearer <token>` |
| `404` em um registro que existe | Ele está **inativo** (soft delete) | Consulte com `?situacao=todos` ou reative |
| `409` ao atualizar | `versao` desatualizada ou registro inativo | Releia o registro e reenvie com a versão atual / reative-o |
| `422` ao registrar lote | Organização sem contrato ou inativa; data fora do limite | Cadastre o contrato, reative a organização ou ajuste `dataEntrada` |
| Login demorado (centenas de ms) | Esperado: o hash da AV1 faz 100 mil iterações de SHA-256 | Nenhuma ação necessária |
| `login` ou código "duplicado" com caixa diferente | O MySQL compara texto sem diferenciar maiúsculas/minúsculas | Comportamento esperado; use valores distintos |

---

## 11. Estrutura do repositório

```
.
├── prisma/
│   ├── schema.prisma          # modelos, enums e relacionamentos (MySQL)
│   ├── constraints.sql        # CHECKs anexados à migration inicial
│   ├── seed.ts                # dados de teste (apaga os dados existentes!)
│   └── migrations/            # gerada por você (passo 2 da seção 4)
├── scripts/
│   └── anexar-constraints.js  # anexa constraints.sql à migration (multiplataforma)
├── src/
│   ├── core/                  # validation.ts e crypto.ts (AV1)
│   ├── domain/                # entidades, Papel e FabricaEntidades (AV1) + transicoesStatus.ts e statusLote.ts
│   ├── modules/               # auth, usuario, organizacao, lote, equipamento, movimentacao, relatorios
│   │   └── <modulo>/          #   controller · service · repository · routes
│   ├── plugins/               # prisma, jwt, error-handler
│   ├── shared/                # permissões, autorização, situação (soft delete), erros, paginação, schemas
│   ├── app.ts                 # montagem do Fastify, Swagger e rotas
│   └── server.ts              # inicialização + graceful shutdown
├── tests/                     # testes de unidade (node:test)
├── docs/
│   ├── API.md                 # endpoints e regras resumidos
│   ├── AV1-para-AV2.md        # AV1 -> AV2 e as respostas do professor, uma a uma
│   └── DECISOES.md            # decisões arquiteturais, trade-offs e alternativas
├── Dockerfile · docker-compose.yml · .dockerignore
└── .env.example · tsconfig.json · package.json
```

### Scripts do `package.json`

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor em modo desenvolvimento (recarrega ao salvar) |
| `npm run build` | Compila o TypeScript para `dist/` |
| `npm start` | Executa a versão compilada (`dist/server.js`) |
| `npm test` | Roda os testes de unidade |
| `npm run db:constraints` | Anexa `prisma/constraints.sql` à migration inicial |
| `npm run prisma:migrate` | `prisma migrate dev` |
| `npm run prisma:deploy` | `prisma migrate deploy` (produção) |
| `npm run prisma:generate` | `prisma generate` |
| `npm run seed` | `prisma db seed` |
