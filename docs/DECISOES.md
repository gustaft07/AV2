# Decisões arquiteturais


## 1. Monólito em camadas, com o domínio da AV1 no centro
Um único servidor HTTP por módulos. **Controller** traduz HTTP; **Service** orquestra regras e transações usando as entidades e validações da AV1; **Repository** é o único ponto que fala com o Prisma e converte entre linhas e entidades de domínio. A regra não depende do transporte. *Trade-off:* escala como unidade única. *Rejeitado:* microsserviços (custo sem necessidade atual).

## 2. Reaproveitar a AV1
Preserva o comportamento já validado. Mudanças no código original foram mínimas (`docs/AV1-para-AV2.md`).

## 3. Fastify, Prisma e MySQL
Fastify: desempenho e validação por JSON Schema (que também gera o Swagger). Prisma: schema declarativo, cliente tipado, migrations e `$transaction`. MySQL 8 (InnoDB, ACID); `CHECK` fica em `prisma/constraints.sql` (exige 8.0.16+). A comparação de texto do MySQL ignora maiúsculas/minúsculas, o que vale também para chaves únicas (login, códigos).

## 4. Política de exclusão (regra do professor)
- **Soft delete** (`ativo`) em usuário, organização e lote, com **cadeia**: inativar a organização inativa seus lotes na mesma transação.
- **Equipamento herda a inatividade do lote**, sem coluna própria. Alternativas descartadas: (a) `ativo` em equipamento: duplica estado e exigiria `updateMany` em milhares de linhas a cada inativação; (b) apagar equipamentos ao inativar: destruiria a trilha de auditoria. O professor disse que equipamento não faz sentido ter soft delete, e a herança respeita isso.
- **Delete físico** direto para equipamento e contrato. Para as entidades com soft delete, o "delete padrão" fica em `/definitivo`, restrito a admin, em cascata no banco (`onDelete: Cascade`), porque é destrutivo e irreversível.
- Consultas padrão só mostram ativos (`?situacao=` amplia). Registro inativo não aceita alterações.

## 5. Status do lote derivado
O lote não tem rota de mudança de status. Após cada troca de status, cadastro ou exclusão de equipamento, o serviço verifica se **todos** os equipamentos têm o mesmo status e só então atualiza o lote. Para evitar corrida entre requisições concorrentes (duas trocas que, somadas, deixariam todos iguais), a operação trava a linha do lote (`SELECT ... FOR UPDATE`) e roda em **READ COMMITTED**, de modo que a segunda transação enxerga a primeira já confirmada. A mesma trava serializa a atribuição de `posicao`.

## 6. Código de barras = id; posição automática
O código é o `id` (UUID gerado no domínio, conhecido antes do INSERT). A coluna `codigoBarrasInterno` é mantida porque o enunciado pede unicidade nela, e um `CHECK (codigoBarrasInterno = id)` garante a igualdade. *Trade-off:* redundância controlada. A `posicao` é sequencial por lote, única por lote e **não reaproveitada** após exclusões (estabilidade de etiquetas).

## 7. Contrato obrigatório para lotes
"Contrato ativo" = contrato existente: como contrato só tem exclusão física, não existe contrato inativo. A organização sem contrato continua ativa, mas `POST /lotes` é recusado (422).

## 8. Controle de acesso
Matriz única em `src/shared/permissoes.ts`, aplicada por hook em cada rota, inclusive nas listagens. Admin está em todos os grupos (acesso a todas as rotas) mas é o único a gerir usuários. Operadores não acessam recursos administrativos.

## 9. Autenticação JWT com o hash da AV1
Token stateless de 1h com `sub`, `login` e `papel`. A senha usa `verificarSenha` (sal + SHA-256 iterado 100 mil vezes). *Ponto de atenção:* é síncrona (~200 ms por login) e não é um KDF dedicado; evolução: `scrypt` assíncrono. A cada requisição o hook `authenticate` consulta o usuário (1 busca por chave primária): conta inativada ou excluída perde o acesso imediatamente, e mudanças de papel valem na hora.

## 10. Transações e concorrência
`$transaction` em criação de lote com equipamentos, cadastro de equipamentos, alteração de estado físico e de status, e remoção de equipamento. **Lock otimista** (`versao`) nas atualizações: zero linhas afetadas → 409.

## 11. Integridade no banco
`UNIQUE` (códigos, CNPJ, login, número do contrato, `loteId+posicao`), FKs com cascade, `CHECK` (CNPJ com 14 dígitos, login, prazo, histórico de estado, código de barras = id, posição ≥ 1).

## 12. Docker e multiplataforma
Docker é opcional (só sobe o MySQL). Sem dependências nativas (`crypto` do Node, `tsx`), tratamento de `SIGINT`/`SIGTERM` e scripts que funcionam em Windows e Linux.

## 13. Evolução
Hash assíncrono, cache curto da consulta de usuário, refresh token, rate limiting, testes de integração com banco efêmero.
