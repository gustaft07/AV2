# Da AV1 (CLI) para a AV2 (API) — e as respostas do professor

## 1. O que veio da AV1 sem mudar
- `src/core/validation.ts`: `validarCNPJ`, `validarDataEntradaLote`, escala de estado físico, status do equipamento, `validarTransicaoParaDesmonte`, `ErroValidacao`.
- `src/core/crypto.ts`: `hashSenha` e `verificarSenha` (hash + sal) usados no login.
- `src/domain/`: `EntidadeBase`, `Papel`, `Usuario`, `Organizacao`, `Lote`, `Movimentacao`, `FabricaEntidades`. Os serviços criam entidades pela fábrica (que valida) e os repositórios convertem entre objetos de domínio e linhas do banco.

## 2. Alterações no código da AV1
| Arquivo | Mudança | Motivo |
|---|---|---|
| `domain/Equipamento.ts` | `alterarEstadoFisico` lança `ErroValidacao` em vez de `Error` | a API responde 422 em vez de 500 (o CLI continua igual: é subclasse de `Error`) |
| `domain/Equipamento.ts` | `codigoBarras` passou a ser opcional e, se omitido, é o próprio `id` | **regra do professor: o código de barras é o id do equipamento** |
| `domain/Equipamento.ts` | novo método `alterarStatus` | a API troca status; `"desmonte"` segue a regra da AV1 |
| `domain/FabricaEntidades.ts` | `criarEquipamento` aceita `codigoBarras` opcional | idem |
| `domain/transicoesStatus.ts` (novo) | mapa de transições | **só a regra do desmonte é da AV1**; o resto do fluxo é suposição |
| `domain/statusLote.ts` (novo) | `statusUnico()` | regra "todos iguais" do status do lote |

## 3. Respostas do professor (PDF "Dúvidas AV2") e onde cada uma está implementada
| Resposta / regra | Implementação |
|---|---|
| Scripts de teste não são obrigatórios; facilitam a correção | Swagger em `/docs`, testes de unidade (`npm test`) e roteiro de validação no README |
| **Soft delete (inativar) e delete padrão; o comportamento é em cadeia** | Usuário, organização e lote: `DELETE /x/:id` inativa (soft) e `DELETE /x/:id/definitivo` exclui fisicamente (somente admin). Inativar organização inativa todos os lotes; equipamentos ficam inativos por herança. Exclusão física cai em cascata no banco (`onDelete: Cascade`) |
| **Equipamentos e contratos: só delete (sem soft delete)** | `DELETE /equipamentos/:id` e `DELETE /organizacoes/:id/contrato`: exclusão física direta, sem restrições |
| Ausência de contrato não inativa a organização, mas **não se pode adicionar lote sem contrato** | `POST /lotes` rejeita (422) organização sem contrato; a organização continua ativa |
| Lotes só em organizações com contratos ativos | Idem. Como contrato só tem delete físico, **"contrato ativo" = contrato existente**. Também rejeita organização inativa |
| Inativar organização com contrato ativo: sem restrição | Sem validação; o contrato permanece |
| **O status do lote muda quando TODOS os equipamentos foram afetados (mesmo status)** | `domain/statusLote.ts` + `lote/lote.sincronizacao.ts`; executado a cada troca de status, cadastro e exclusão de equipamento, com o lote travado (`FOR UPDATE`) e transação READ COMMITTED |
| Um único equipamento em triagem **não** muda o lote | Coberto por teste unitário (`statusUnico`) |
| **Código de barras = id da tabela de equipamentos** | gerado pelo sistema; coluna `codigoBarrasInterno` sempre igual a `id` (CHECK no banco); não é aceito na entrada |
| **Posição no lote é automática ("index de um array")** | `posicao` sequencial por lote (1, 2, 3...), única por lote, atribuída ao cadastrar |
| **Admin tem acesso a TODAS as rotas** | `ADMIN` consta em todos os grupos de `src/shared/permissoes.ts` (teste unitário garante) |
| **Listagens bloqueadas por papel; operador não vê a lista de usuários** | `GET /usuarios` só admin e auditor; organizações só admin/cadastro/auditor; lotes, equipamentos e movimentações só admin/almoxarifado/auditor |

## 4. Mapeamento de campos
| AV1 | AV2 (banco/API) |
|---|---|
| `Organizacao.contratoColeta` (texto) | tabela `Contrato` (`numero`), 1 : 0..1 |
| `Lote.organizacaoCodigo` | FK `organizacaoId`; a API continua aceitando `organizacaoCodigo` |
| `Equipamento.codigoBarras` | `codigoBarrasInterno` (nome do enunciado), único e igual ao `id` |
| `Equipamento.historicoEstado[]` | tabela `HistoricoEstado` |
| `Movimentacao.ator` | `ator` (login), sem FK |
| `Usuario.hashSenha` + `saltSenha` | mesmos campos |
| (novo) `ativo` | `Usuario`, `Organizacao`, `Lote` (soft delete) |
| (novo) `Lote.status` | derivado dos equipamentos; não editável |
| (novo) `Equipamento.posicao` | automático |

## 5. O que é suposição minha (revise com o professor se tiver dúvida)
1. **Fluxo de status** além da regra do desmonte: `recebido → triagem → triagem_completa → (desmonte | revenda | descarte_seguro)` e `desmonte → (reciclagem | descarte_seguro)`. Edite `src/domain/transicoesStatus.ts`.
2. **O lote usa o mesmo vocabulário de status do equipamento** (o exemplo do professor foi "triagem").
3. **Posição começa em 1** (o professor falou em "index de um array"; para iniciar em 0 basta trocar `+ 1` por `+ 0` em `lote.service.ts` e `equipamento.repository.ts`).
4. **Auditor** consulta usuários, organizações, lotes, equipamentos e relatórios, mas nunca escreve.
5. **"Delete padrão"** das entidades com soft delete foi exposto em `/definitivo`, restrito a admin.
6. **Reativar** uma organização não reativa os lotes (cada lote é reativado individualmente, e só se a organização estiver ativa).
7. **Valores de `Movimentacao.tipo`**: `cadastro`, `alteracao_estado_fisico`, `alteracao_status`.
