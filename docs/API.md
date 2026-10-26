# API greencode

Autenticação: `POST /auth/login` (`login` + `senha`) devolve um JWT (1h). Envie `Authorization: Bearer <token>`.
Listagens paginadas (`page`, `limit` ≤ 100) devolvem `{ data, total, page, limit, totalPages }`.
Atualizações (`PUT`/`PATCH` com dados) exigem `versao` (lock otimista); versão desatualizada → **409**.
Consultas mostram só registros **ativos**; use `?situacao=inativos` ou `?situacao=todos` para ver os inativados.

## Permissões (resumo)
| Recurso | Consultar | Escrever |
|---|---|---|
| Usuários | admin, auditor | admin |
| Organizações / contratos | admin, operador_cadastro, auditor | admin, operador_cadastro |
| Lotes / equipamentos / movimentações | admin, gestor_almoxarifado, auditor | admin, gestor_almoxarifado |
| Relatórios | admin, auditor | — |
| Exclusão definitiva (`/definitivo`) | — | admin |

## Endpoints
| Método | Rota | Descrição |
|---|---|---|
| POST | /auth/login | Login (público) |
| GET | /auth/me | Dados do token |
| POST, GET | /usuarios | Cria / lista |
| PATCH | /usuarios/:id | Papel ou senha (exige `versao`) |
| DELETE | /usuarios/:id | **Soft delete**: inativa (não autentica mais) |
| PATCH | /usuarios/:id/reativar | Reativa |
| DELETE | /usuarios/:id/definitivo | **Delete físico** |
| POST, GET | /organizacoes | Cadastra (CNPJ validado; `contratoColeta` opcional) / lista |
| GET, PUT | /organizacoes/:id | Detalha / atualiza (exige `versao`) |
| DELETE | /organizacoes/:id | **Soft delete em cadeia**: inativa a organização e seus lotes |
| PATCH | /organizacoes/:id/reativar | Reativa só a organização |
| DELETE | /organizacoes/:id/definitivo | **Delete físico em cascata** (contrato, lotes, equipamentos...) |
| DELETE | /organizacoes/:id/contrato | **Delete físico** direto do contrato |
| POST, GET | /lotes | Registra (exige organização ativa **com contrato**) / lista (`status`, `organizacaoCodigo`, `busca`) |
| GET, PUT | /lotes/:id | Detalha (equipamentos por posição) / atualiza nota fiscal e transportadora |
| POST | /lotes/:id/equipamentos | Cadastra equipamentos (código de barras e posição automáticos) |
| DELETE | /lotes/:id | **Soft delete**: inativa o lote |
| PATCH | /lotes/:id/reativar | Reativa (organização precisa estar ativa) |
| DELETE | /lotes/:id/definitivo | **Delete físico em cascata** |
| GET | /equipamentos, /equipamentos/:id | Consulta (`status`, `estadoFisico`, `loteId`, `tipo`, `busca`) |
| GET | /equipamentos/:id/movimentacoes | Trilha do equipamento |
| PATCH | /equipamentos/:id/estado-fisico | Troca o estado físico |
| PATCH | /equipamentos/:id/status | Troca o status e sincroniza o status do lote |
| DELETE | /equipamentos/:id | **Delete físico** direto |
| GET | /movimentacoes | Trilha geral |
| GET | /relatorios/resumo | Totais e distribuições (dados ativos) |
| GET | /relatorios/prazo-armazenamento | Lotes pendentes x prazo (`?somenteVencidos=true`) |

## Regras
- **Soft delete** (usuário, organização, lote): `ativo = false`. Registro inativo some das consultas padrão (`GET /x/:id` → 404, salvo `?situacao=todos`) e não aceita alterações até ser reativado. Equipamentos não têm soft delete: ficam inativos por herança quando o lote está inativo.
- **Delete físico**: equipamento e contrato (direto); organização, lote e usuário via `/definitivo`. A exclusão é em cascata no banco.
- **Lote**: só em organização **ativa e com contrato**. Código, nota fiscal e transportadora obrigatórios; `dataEntrada` não futura e com até 90 dias. Equipamentos podem vir junto (transação: se algo falhar, nada é gravado).
- **Status do lote**: derivado. Só muda quando **todos** os equipamentos do lote têm o mesmo status.
- **Equipamento**: o código de barras é o próprio `id` e a `posicao` é sequencial no lote; ambos gerados pelo sistema. Nasce `recebido`.
- **Estado físico**: queda de 2+ categorias exige `justificativa` (mín. 5 caracteres).
- **Status do equipamento**: `desmonte` só a partir de `triagem_completa` (regra da AV1).
- **Movimentações** são imutáveis; gravadas na mesma transação da alteração.
- **CNPJ** válido, guardado só com dígitos, único.

## Erros
400 schema inválido · 401 sem token/credencial inválida · 403 sem permissão · 404 não encontrado (inclui registro inativo) · 409 duplicidade, versão desatualizada ou estado conflitante (ex.: já inativo) · 422 regra de negócio (`ErroValidacao`) · 500 erro interno.

## Exemplo
```bash
TOKEN=$(curl -s -X POST localhost:3000/auth/login -H 'content-type: application/json' \
  -d '{"login":"almoxarifado","senha":"Almox@123"}' | jq -r .token)

curl -X POST localhost:3000/lotes -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{
  "codigoLote":"LT-0100","organizacaoCodigo":"ECO001","notaFiscal":"NF-9","transportadora":"TransLog",
  "equipamentos":[{"tipo":"Notebook","estadoFisico":"usado_bom"},{"tipo":"Monitor","estadoFisico":"novo"}]}'
```
