ALTER TABLE `ComandaEvent`
    MODIFY `type` ENUM(
        'OPENED', 'CANCELLED', 'CLOSED', 'ITEM_ADDED', 'ITEM_CONFIRMED',
        'ITEM_QUANTITY_CHANGED', 'ITEM_REMOVED', 'ITEM_CANCELLED',
        'ADDITIONALS_CHANGED'
    ) NOT NULL;

ALTER TABLE `InventoryMovement`
    MODIFY `type` ENUM(
        'ENTRY', 'EXIT', 'ADJUSTMENT', 'SALE_CONSUMPTION',
        'ADDITIONAL_CONSUMPTION', 'LOSS', 'MANUAL_EXIT',
        'POSITIVE_ADJUSTMENT', 'NEGATIVE_ADJUSTMENT', 'REVERSAL'
    ) NOT NULL,
    ADD COLUMN `operationId` VARCHAR(191) NULL,
    ADD COLUMN `balanceBefore` INTEGER NULL;

UPDATE `InventoryMovement`
SET `balanceBefore` = `balanceAfter` - `quantityDelta`;

ALTER TABLE `InventoryMovement`
    MODIFY `balanceBefore` INTEGER NOT NULL;

ALTER TABLE `InventoryStock`
    ADD COLUMN `deficitQuantity` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `ComandaItem`
    ADD COLUMN `additionalTotalCents` INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX `ComandaItem_id_establishmentId_key`
    ON `ComandaItem`(`id`, `establishmentId`);

CREATE TABLE `InventoryOperation` (
    `id` VARCHAR(191) NOT NULL,
    `establishmentId` VARCHAR(191) NOT NULL,
    `type` ENUM('ENTRY', 'MANUAL', 'CONFIRMATION', 'CANCELLATION', 'CONFIGURATION') NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NULL,
    `comandaId` VARCHAR(191) NULL,
    `actorUserId` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `InventoryOperation_establishmentId_requestId_key`(`establishmentId`, `requestId`),
    UNIQUE INDEX `InventoryOperation_id_establishmentId_key`(`id`, `establishmentId`),
    INDEX `InventoryOperation_comandaId_createdAt_idx`(`comandaId`, `createdAt`),
    INDEX `InventoryOperation_sourceId_createdAt_idx`(`sourceId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `InventoryLot` (
    `id` VARCHAR(191) NOT NULL,
    `establishmentId` VARCHAR(191) NOT NULL,
    `stockId` VARCHAR(191) NOT NULL,
    `origin` ENUM('PURCHASE', 'ADJUSTMENT', 'REVERSAL', 'LEGACY') NOT NULL,
    `code` VARCHAR(80) NULL,
    `initialQuantity` INTEGER NOT NULL,
    `currentQuantity` INTEGER NOT NULL,
    `totalCostCents` INTEGER NULL,
    `receivedAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `actorUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InventoryLot_id_establishmentId_key`(`id`, `establishmentId`),
    UNIQUE INDEX `InventoryLot_establishmentId_stockId_code_key`(`establishmentId`, `stockId`, `code`),
    INDEX `InventoryLot_stockId_expiresAt_receivedAt_idx`(`stockId`, `expiresAt`, `receivedAt`),
    INDEX `InventoryLot_establishmentId_expiresAt_idx`(`establishmentId`, `expiresAt`),
    CONSTRAINT `InventoryLot_positive_quantities_chk`
        CHECK (`initialQuantity` > 0 AND `currentQuantity` >= 0),
    CONSTRAINT `InventoryLot_purchase_cost_chk`
        CHECK (`origin` <> 'PURCHASE' OR (`totalCostCents` IS NOT NULL AND `totalCostCents` > 0)),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `InventoryMovementLot` (
    `id` VARCHAR(191) NOT NULL,
    `establishmentId` VARCHAR(191) NOT NULL,
    `movementId` VARCHAR(191) NOT NULL,
    `lotId` VARCHAR(191) NOT NULL,
    `quantityDelta` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `InventoryMovementLot_movementId_lotId_key`(`movementId`, `lotId`),
    INDEX `InventoryMovementLot_lotId_createdAt_idx`(`lotId`, `createdAt`),
    INDEX `InventoryMovementLot_establishmentId_createdAt_idx`(`establishmentId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProductIngredient` (
    `id` VARCHAR(191) NOT NULL,
    `establishmentId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `ingredientId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductIngredient_establishment_product_ingredient_key`(`establishmentId`, `productId`, `ingredientId`),
    INDEX `ProductIngredient_ingredientId_idx`(`ingredientId`),
    CONSTRAINT `ProductIngredient_quantity_chk` CHECK (`quantity` > 0),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Additional` (
    `id` VARCHAR(191) NOT NULL,
    `establishmentId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `priceCents` INTEGER NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Additional_establishmentId_code_key`(`establishmentId`, `code`),
    UNIQUE INDEX `Additional_id_establishmentId_key`(`id`, `establishmentId`),
    INDEX `Additional_establishmentId_active_name_idx`(`establishmentId`, `active`, `name`),
    CONSTRAINT `Additional_priceCents_chk` CHECK (`priceCents` >= 0),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProductAdditional` (
    `id` VARCHAR(191) NOT NULL,
    `establishmentId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `additionalId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ProductAdditional_establishment_product_additional_key`(`establishmentId`, `productId`, `additionalId`),
    INDEX `ProductAdditional_additionalId_idx`(`additionalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AdditionalIngredient` (
    `id` VARCHAR(191) NOT NULL,
    `establishmentId` VARCHAR(191) NOT NULL,
    `additionalId` VARCHAR(191) NOT NULL,
    `ingredientId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AdditionalIngredient_establishment_additional_ingredient_key`(`establishmentId`, `additionalId`, `ingredientId`),
    INDEX `AdditionalIngredient_ingredientId_idx`(`ingredientId`),
    CONSTRAINT `AdditionalIngredient_quantity_chk` CHECK (`quantity` > 0),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ComandaItemConfiguration` (
    `id` VARCHAR(191) NOT NULL,
    `establishmentId` VARCHAR(191) NOT NULL,
    `comandaItemId` VARCHAR(191) NOT NULL,
    `configurationKey` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `confirmedQuantity` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ComandaItemConfiguration_item_key`(`comandaItemId`, `configurationKey`),
    UNIQUE INDEX `ComandaItemConfiguration_id_establishment_key`(`id`, `establishmentId`),
    INDEX `ComandaItemConfiguration_establishment_created_idx`(`establishmentId`, `createdAt`),
    CONSTRAINT `ComandaItemConfiguration_quantity_chk`
        CHECK (`quantity` >= 0 AND `confirmedQuantity` >= 0 AND `confirmedQuantity` <= `quantity`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ComandaItemAdditional` (
    `id` VARCHAR(191) NOT NULL,
    `establishmentId` VARCHAR(191) NOT NULL,
    `configurationId` VARCHAR(191) NOT NULL,
    `additionalId` VARCHAR(191) NOT NULL,
    `additionalName` VARCHAR(100) NOT NULL,
    `unitPriceCents` INTEGER NOT NULL,
    `quantityPerUnit` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ComandaItemAdditional_configuration_additional_key`(`configurationId`, `additionalId`),
    INDEX `ComandaItemAdditional_establishment_created_idx`(`establishmentId`, `createdAt`),
    CONSTRAINT `ComandaItemAdditional_values_chk`
        CHECK (`unitPriceCents` >= 0 AND `quantityPerUnit` > 0),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ComandaItemCancellation` (
    `id` VARCHAR(191) NOT NULL,
    `establishmentId` VARCHAR(191) NOT NULL,
    `configurationId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `disposition` ENUM('RETURN_TO_STOCK', 'LOSS') NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `actorUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ComandaItemCancellation_configuration_created_idx`(`configurationId`, `createdAt`),
    INDEX `ComandaItemCancellation_establishment_created_idx`(`establishmentId`, `createdAt`),
    CONSTRAINT `ComandaItemCancellation_quantity_chk` CHECK (`quantity` > 0),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `ComandaItemConfiguration` (
    `id`, `establishmentId`, `comandaItemId`, `configurationKey`,
    `quantity`, `confirmedQuantity`, `createdAt`, `updatedAt`
)
SELECT
    CONCAT('legacy_config_', `id`), `establishmentId`, `id`, 'base',
    `quantity`, `confirmedQuantity`, `createdAt`, `updatedAt`
FROM `ComandaItem`;

ALTER TABLE `InventoryOperation`
    ADD CONSTRAINT `InventoryOperation_establishment_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `InventoryOperation_comanda_fkey` FOREIGN KEY (`comandaId`, `establishmentId`) REFERENCES `Comanda`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `InventoryOperation_actor_fkey` FOREIGN KEY (`actorUserId`, `establishmentId`) REFERENCES `User`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `InventoryLot`
    ADD CONSTRAINT `InventoryLot_establishment_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `InventoryLot_stock_fkey` FOREIGN KEY (`stockId`, `establishmentId`) REFERENCES `InventoryStock`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `InventoryLot_actor_fkey` FOREIGN KEY (`actorUserId`, `establishmentId`) REFERENCES `User`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `InventoryMovement`
    ADD INDEX `InventoryMovement_operationId_idx`(`operationId`),
    ADD CONSTRAINT `InventoryMovement_operation_fkey` FOREIGN KEY (`operationId`, `establishmentId`) REFERENCES `InventoryOperation`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `InventoryMovementLot`
    ADD CONSTRAINT `InventoryMovementLot_establishment_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `InventoryMovementLot_movement_fkey` FOREIGN KEY (`movementId`) REFERENCES `InventoryMovement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `InventoryMovementLot_lot_fkey` FOREIGN KEY (`lotId`, `establishmentId`) REFERENCES `InventoryLot`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ProductIngredient`
    ADD CONSTRAINT `ProductIngredient_establishment_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `ProductIngredient_product_fkey` FOREIGN KEY (`productId`, `establishmentId`) REFERENCES `Product`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `ProductIngredient_ingredient_fkey` FOREIGN KEY (`ingredientId`, `establishmentId`) REFERENCES `Ingredient`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Additional`
    ADD CONSTRAINT `Additional_establishment_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ProductAdditional`
    ADD CONSTRAINT `ProductAdditional_establishment_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `ProductAdditional_product_fkey` FOREIGN KEY (`productId`, `establishmentId`) REFERENCES `Product`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `ProductAdditional_additional_fkey` FOREIGN KEY (`additionalId`, `establishmentId`) REFERENCES `Additional`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `AdditionalIngredient`
    ADD CONSTRAINT `AdditionalIngredient_establishment_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `AdditionalIngredient_additional_fkey` FOREIGN KEY (`additionalId`, `establishmentId`) REFERENCES `Additional`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `AdditionalIngredient_ingredient_fkey` FOREIGN KEY (`ingredientId`, `establishmentId`) REFERENCES `Ingredient`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ComandaItemConfiguration`
    ADD CONSTRAINT `ComandaItemConfiguration_establishment_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `ComandaItemConfiguration_item_fkey` FOREIGN KEY (`comandaItemId`, `establishmentId`) REFERENCES `ComandaItem`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ComandaItemAdditional`
    ADD CONSTRAINT `ComandaItemAdditional_establishment_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `ComandaItemAdditional_configuration_fkey` FOREIGN KEY (`configurationId`, `establishmentId`) REFERENCES `ComandaItemConfiguration`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `ComandaItemAdditional_additional_fkey` FOREIGN KEY (`additionalId`, `establishmentId`) REFERENCES `Additional`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ComandaItemCancellation`
    ADD CONSTRAINT `ComandaItemCancellation_establishment_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `ComandaItemCancellation_configuration_fkey` FOREIGN KEY (`configurationId`, `establishmentId`) REFERENCES `ComandaItemConfiguration`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `ComandaItemCancellation_actor_fkey` FOREIGN KEY (`actorUserId`, `establishmentId`) REFERENCES `User`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;
