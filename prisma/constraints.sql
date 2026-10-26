-- Constraints que o Prisma não declara no schema.prisma (sintaxe MySQL 8.0.16+).
-- Devem ser ANEXADAS ao migration.sql gerado com `prisma migrate dev --create-only`
-- (veja o README, seção "Migrations e constraints").
-- Atenção: no MySQL 5.7 e anteriores o CHECK é aceito mas IGNORADO. Use MySQL 8.0.16 ou superior.

-- CNPJ armazenado somente com 14 dígitos (a validação dos dígitos verificadores é feita pelo domínio)
ALTER TABLE `Organizacao`
  ADD CONSTRAINT `organizacao_cnpj_formato_chk` CHECK (`cnpj` REGEXP '^[0-9]{14}$');

ALTER TABLE `Organizacao`
  ADD CONSTRAINT `organizacao_prazo_positivo_chk` CHECK (`prazoArmazenamentoDias` > 0);

-- Login no mesmo formato aceito pelo domínio (Usuario.validar)
ALTER TABLE `Usuario`
  ADD CONSTRAINT `usuario_login_formato_chk` CHECK (`login` REGEXP '^[a-zA-Z0-9._-]{3,}$');

-- Histórico de estado físico: precisa registrar uma mudança de fato
ALTER TABLE `HistoricoEstado`
  ADD CONSTRAINT `historico_estado_diferente_chk` CHECK (`de` <> `para`);

-- Rebaixar 2+ categorias exige justificativa de ao menos 5 caracteres (regra da AV1 também no banco)
ALTER TABLE `HistoricoEstado`
  ADD CONSTRAINT `historico_justificativa_chk` CHECK (
    ( (CASE `para` WHEN 'novo' THEN 0 WHEN 'seminovo' THEN 1 WHEN 'usado_bom' THEN 2
                   WHEN 'usado_regular' THEN 3 WHEN 'usado_ruim' THEN 4 WHEN 'sucata' THEN 5 END)
    - (CASE `de`   WHEN 'novo' THEN 0 WHEN 'seminovo' THEN 1 WHEN 'usado_bom' THEN 2
                   WHEN 'usado_regular' THEN 3 WHEN 'usado_ruim' THEN 4 WHEN 'sucata' THEN 5 END) ) < 2
    OR CHAR_LENGTH(TRIM(IFNULL(`justificativa`, ''))) >= 5
  );

-- Código de barras é gerado pelo sistema e corresponde sempre ao id do equipamento
ALTER TABLE `Equipamento`
  ADD CONSTRAINT `equipamento_codigo_barras_eq_id_chk` CHECK (`codigoBarrasInterno` = `id`);

-- Posição no lote é sequencial a partir de 1
ALTER TABLE `Equipamento`
  ADD CONSTRAINT `equipamento_posicao_chk` CHECK (`posicao` >= 1);

-- "desmonte" só a partir de triagem_completa: regra mantida no domínio (Equipamento.alterarStatus).
