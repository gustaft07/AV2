-- CreateTable
CREATE TABLE `Usuario` (
    `id` VARCHAR(191) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `login` VARCHAR(191) NOT NULL,
    `hashSenha` VARCHAR(191) NOT NULL,
    `saltSenha` VARCHAR(191) NOT NULL,
    `papel` ENUM('admin', 'operador_cadastro', 'gestor_almoxarifado', 'auditor') NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `versao` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `Usuario_login_key`(`login`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Organizacao` (
    `id` VARCHAR(191) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `codigo` VARCHAR(191) NOT NULL,
    `razaoSocial` VARCHAR(255) NOT NULL,
    `cnpj` VARCHAR(191) NOT NULL,
    `prazoArmazenamentoDias` INTEGER NOT NULL DEFAULT 90,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `versao` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `Organizacao_codigo_key`(`codigo`),
    UNIQUE INDEX `Organizacao_cnpj_key`(`cnpj`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contrato` (
    `id` VARCHAR(191) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `numero` VARCHAR(191) NOT NULL,
    `organizacaoId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Contrato_numero_key`(`numero`),
    UNIQUE INDEX `Contrato_organizacaoId_key`(`organizacaoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lote` (
    `id` VARCHAR(191) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `codigoLote` VARCHAR(191) NOT NULL,
    `notaFiscal` VARCHAR(191) NOT NULL,
    `transportadora` VARCHAR(191) NOT NULL,
    `dataEntrada` DATETIME(3) NOT NULL,
    `status` ENUM('recebido', 'triagem', 'triagem_completa', 'desmonte', 'reciclagem', 'descarte_seguro', 'revenda') NOT NULL DEFAULT 'recebido',
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `organizacaoId` VARCHAR(191) NOT NULL,
    `versao` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `Lote_codigoLote_key`(`codigoLote`),
    INDEX `Lote_organizacaoId_idx`(`organizacaoId`),
    INDEX `Lote_dataEntrada_idx`(`dataEntrada`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Equipamento` (
    `id` VARCHAR(191) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `codigoBarrasInterno` VARCHAR(191) NOT NULL,
    `posicao` INTEGER NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `estadoFisico` ENUM('novo', 'seminovo', 'usado_bom', 'usado_regular', 'usado_ruim', 'sucata') NOT NULL,
    `status` ENUM('recebido', 'triagem', 'triagem_completa', 'desmonte', 'reciclagem', 'descarte_seguro', 'revenda') NOT NULL DEFAULT 'recebido',
    `loteId` VARCHAR(191) NOT NULL,
    `versao` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `Equipamento_codigoBarrasInterno_key`(`codigoBarrasInterno`),
    INDEX `Equipamento_status_idx`(`status`),
    INDEX `Equipamento_estadoFisico_idx`(`estadoFisico`),
    UNIQUE INDEX `Equipamento_loteId_posicao_key`(`loteId`, `posicao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HistoricoEstado` (
    `id` VARCHAR(191) NOT NULL,
    `equipamentoId` VARCHAR(191) NOT NULL,
    `de` ENUM('novo', 'seminovo', 'usado_bom', 'usado_regular', 'usado_ruim', 'sucata') NOT NULL,
    `para` ENUM('novo', 'seminovo', 'usado_bom', 'usado_regular', 'usado_ruim', 'sucata') NOT NULL,
    `justificativa` VARCHAR(500) NULL,
    `em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `HistoricoEstado_equipamentoId_em_idx`(`equipamentoId`, `em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Movimentacao` (
    `id` VARCHAR(191) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `equipamentoId` VARCHAR(191) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `ator` VARCHAR(191) NOT NULL,
    `observacao` VARCHAR(1000) NULL,

    INDEX `Movimentacao_equipamentoId_criadoEm_idx`(`equipamentoId`, `criadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Contrato` ADD CONSTRAINT `Contrato_organizacaoId_fkey` FOREIGN KEY (`organizacaoId`) REFERENCES `Organizacao`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lote` ADD CONSTRAINT `Lote_organizacaoId_fkey` FOREIGN KEY (`organizacaoId`) REFERENCES `Organizacao`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Equipamento` ADD CONSTRAINT `Equipamento_loteId_fkey` FOREIGN KEY (`loteId`) REFERENCES `Lote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HistoricoEstado` ADD CONSTRAINT `HistoricoEstado_equipamentoId_fkey` FOREIGN KEY (`equipamentoId`) REFERENCES `Equipamento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Movimentacao` ADD CONSTRAINT `Movimentacao_equipamentoId_fkey` FOREIGN KEY (`equipamentoId`) REFERENCES `Equipamento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


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
