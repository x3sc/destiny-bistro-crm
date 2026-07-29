-- Existing operational rows receive their establishment before tenant constraints
-- are enforced.
ALTER TABLE `ComandaEvent` ADD COLUMN `establishmentId` VARCHAR(191) NULL;
ALTER TABLE `ComandaItem` ADD COLUMN `establishmentId` VARCHAR(191) NULL;
ALTER TABLE `CreditOrder` ADD COLUMN `establishmentId` VARCHAR(191) NULL;
ALTER TABLE `CreditSettlement` ADD COLUMN `establishmentId` VARCHAR(191) NULL;

UPDATE `ComandaEvent` AS event
INNER JOIN `Comanda` AS comanda ON comanda.`id` = event.`comandaId`
SET event.`establishmentId` = comanda.`establishmentId`;

UPDATE `ComandaItem` AS item
INNER JOIN `Comanda` AS comanda ON comanda.`id` = item.`comandaId`
SET item.`establishmentId` = comanda.`establishmentId`;

UPDATE `CreditOrder` AS credit_order
INNER JOIN `Comanda` AS comanda ON comanda.`id` = credit_order.`comandaId`
SET credit_order.`establishmentId` = comanda.`establishmentId`;

UPDATE `CreditSettlement` AS settlement
INNER JOIN `CreditCustomer` AS customer ON customer.`id` = settlement.`customerId`
SET settlement.`establishmentId` = customer.`establishmentId`;

ALTER TABLE `ComandaEvent` MODIFY `establishmentId` VARCHAR(191) NOT NULL;
ALTER TABLE `ComandaItem` MODIFY `establishmentId` VARCHAR(191) NOT NULL;
ALTER TABLE `CreditOrder` MODIFY `establishmentId` VARCHAR(191) NOT NULL;
ALTER TABLE `CreditSettlement` MODIFY `establishmentId` VARCHAR(191) NOT NULL;

ALTER TABLE `AuditLog` DROP FOREIGN KEY `AuditLog_userId_fkey`;
ALTER TABLE `Comanda` DROP FOREIGN KEY `Comanda_tableId_fkey`;
ALTER TABLE `ComandaEvent` DROP FOREIGN KEY `ComandaEvent_actorUserId_fkey`;
ALTER TABLE `ComandaEvent` DROP FOREIGN KEY `ComandaEvent_comandaId_fkey`;
ALTER TABLE `ComandaItem` DROP FOREIGN KEY `ComandaItem_comandaId_fkey`;
ALTER TABLE `ComandaItem` DROP FOREIGN KEY `ComandaItem_productId_fkey`;
ALTER TABLE `CreditOrder` DROP FOREIGN KEY `CreditOrder_comandaId_fkey`;
ALTER TABLE `CreditOrder` DROP FOREIGN KEY `CreditOrder_customerId_fkey`;
ALTER TABLE `CreditOrder` DROP FOREIGN KEY `CreditOrder_settlementId_fkey`;
ALTER TABLE `CreditSettlement` DROP FOREIGN KEY `CreditSettlement_customerId_fkey`;
ALTER TABLE `RestaurantTable` DROP FOREIGN KEY `RestaurantTable_activeComandaId_fkey`;

CREATE TABLE `Ingredient` (
    `id` VARCHAR(191) NOT NULL,
    `establishmentId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `unit` ENUM('UNIT', 'GRAM', 'MILLILITER') NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Ingredient_establishmentId_active_name_idx`(`establishmentId`, `active`, `name`),
    UNIQUE INDEX `Ingredient_establishmentId_code_key`(`establishmentId`, `code`),
    UNIQUE INDEX `Ingredient_id_establishmentId_key`(`id`, `establishmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `InventoryStock` (
    `id` VARCHAR(191) NOT NULL,
    `establishmentId` VARCHAR(191) NOT NULL,
    `ingredientId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `minimumQuantity` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `InventoryStock_establishmentId_updatedAt_idx`(`establishmentId`, `updatedAt`),
    UNIQUE INDEX `InventoryStock_establishmentId_ingredientId_key`(`establishmentId`, `ingredientId`),
    UNIQUE INDEX `InventoryStock_ingredientId_establishmentId_key`(`ingredientId`, `establishmentId`),
    UNIQUE INDEX `InventoryStock_id_establishmentId_key`(`id`, `establishmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `InventoryMovement` (
    `id` VARCHAR(191) NOT NULL,
    `establishmentId` VARCHAR(191) NOT NULL,
    `stockId` VARCHAR(191) NOT NULL,
    `type` ENUM('ENTRY', 'EXIT', 'ADJUSTMENT') NOT NULL,
    `quantityDelta` INTEGER NOT NULL,
    `balanceAfter` INTEGER NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `actorUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InventoryMovement_establishmentId_createdAt_idx`(`establishmentId`, `createdAt`),
    INDEX `InventoryMovement_stockId_createdAt_idx`(`stockId`, `createdAt`),
    INDEX `InventoryMovement_actorUserId_createdAt_idx`(`actorUserId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `Comanda_id_establishmentId_key` ON `Comanda`(`id`, `establishmentId`);
CREATE INDEX `ComandaEvent_establishmentId_createdAt_idx` ON `ComandaEvent`(`establishmentId`, `createdAt`);
CREATE INDEX `ComandaItem_establishmentId_createdAt_idx` ON `ComandaItem`(`establishmentId`, `createdAt`);
CREATE UNIQUE INDEX `CreditCustomer_id_establishmentId_key` ON `CreditCustomer`(`id`, `establishmentId`);
CREATE INDEX `CreditOrder_establishmentId_status_idx` ON `CreditOrder`(`establishmentId`, `status`);
CREATE UNIQUE INDEX `CreditOrder_comandaId_establishmentId_key` ON `CreditOrder`(`comandaId`, `establishmentId`);
CREATE INDEX `CreditSettlement_establishmentId_paidAt_idx` ON `CreditSettlement`(`establishmentId`, `paidAt`);
CREATE UNIQUE INDEX `CreditSettlement_id_establishmentId_key` ON `CreditSettlement`(`id`, `establishmentId`);
CREATE UNIQUE INDEX `Product_id_establishmentId_key` ON `Product`(`id`, `establishmentId`);
CREATE UNIQUE INDEX `RestaurantTable_id_establishmentId_key` ON `RestaurantTable`(`id`, `establishmentId`);
CREATE UNIQUE INDEX `RestaurantTable_activeComandaId_establishmentId_key` ON `RestaurantTable`(`activeComandaId`, `establishmentId`);
CREATE UNIQUE INDEX `User_id_establishmentId_key` ON `User`(`id`, `establishmentId`);

ALTER TABLE `RestaurantTable` ADD CONSTRAINT `RestaurantTable_activeComandaId_establishmentId_fkey` FOREIGN KEY (`activeComandaId`, `establishmentId`) REFERENCES `Comanda`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Comanda` ADD CONSTRAINT `Comanda_tableId_establishmentId_fkey` FOREIGN KEY (`tableId`, `establishmentId`) REFERENCES `RestaurantTable`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CreditOrder` ADD CONSTRAINT `CreditOrder_establishmentId_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CreditOrder` ADD CONSTRAINT `CreditOrder_customerId_establishmentId_fkey` FOREIGN KEY (`customerId`, `establishmentId`) REFERENCES `CreditCustomer`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CreditOrder` ADD CONSTRAINT `CreditOrder_comandaId_establishmentId_fkey` FOREIGN KEY (`comandaId`, `establishmentId`) REFERENCES `Comanda`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CreditOrder` ADD CONSTRAINT `CreditOrder_settlementId_establishmentId_fkey` FOREIGN KEY (`settlementId`, `establishmentId`) REFERENCES `CreditSettlement`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CreditSettlement` ADD CONSTRAINT `CreditSettlement_establishmentId_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CreditSettlement` ADD CONSTRAINT `CreditSettlement_customerId_establishmentId_fkey` FOREIGN KEY (`customerId`, `establishmentId`) REFERENCES `CreditCustomer`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ComandaItem` ADD CONSTRAINT `ComandaItem_establishmentId_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ComandaItem` ADD CONSTRAINT `ComandaItem_comandaId_establishmentId_fkey` FOREIGN KEY (`comandaId`, `establishmentId`) REFERENCES `Comanda`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ComandaItem` ADD CONSTRAINT `ComandaItem_productId_establishmentId_fkey` FOREIGN KEY (`productId`, `establishmentId`) REFERENCES `Product`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ComandaEvent` ADD CONSTRAINT `ComandaEvent_establishmentId_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ComandaEvent` ADD CONSTRAINT `ComandaEvent_comandaId_establishmentId_fkey` FOREIGN KEY (`comandaId`, `establishmentId`) REFERENCES `Comanda`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ComandaEvent` ADD CONSTRAINT `ComandaEvent_actorUserId_establishmentId_fkey` FOREIGN KEY (`actorUserId`, `establishmentId`) REFERENCES `User`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_establishmentId_fkey` FOREIGN KEY (`userId`, `establishmentId`) REFERENCES `User`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Ingredient` ADD CONSTRAINT `Ingredient_establishmentId_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `InventoryStock` ADD CONSTRAINT `InventoryStock_establishmentId_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `InventoryStock` ADD CONSTRAINT `InventoryStock_ingredientId_establishmentId_fkey` FOREIGN KEY (`ingredientId`, `establishmentId`) REFERENCES `Ingredient`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_establishmentId_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_stockId_establishmentId_fkey` FOREIGN KEY (`stockId`, `establishmentId`) REFERENCES `InventoryStock`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_actorUserId_establishmentId_fkey` FOREIGN KEY (`actorUserId`, `establishmentId`) REFERENCES `User`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;
