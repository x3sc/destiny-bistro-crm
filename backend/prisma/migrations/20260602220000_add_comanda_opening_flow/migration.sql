-- AlterTable
ALTER TABLE `RestaurantTable` ADD COLUMN `activeComandaId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Comanda` (
    `id` VARCHAR(191) NOT NULL,
    `number` INTEGER NOT NULL AUTO_INCREMENT,
    `tableId` INTEGER NOT NULL,
    `status` ENUM('OPEN', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `cancelledAt` DATETIME(3) NULL,
    `cancellationReason` ENUM('OPENED_BY_MISTAKE') NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Comanda_number_key`(`number`),
    INDEX `Comanda_tableId_idx`(`tableId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ComandaEvent` (
    `id` VARCHAR(191) NOT NULL,
    `comandaId` VARCHAR(191) NOT NULL,
    `type` ENUM('OPENED', 'CANCELLED') NOT NULL,
    `reason` ENUM('OPENED_BY_MISTAKE') NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ComandaEvent_comandaId_idx`(`comandaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `RestaurantTable_activeComandaId_key` ON `RestaurantTable`(`activeComandaId`);

-- AddForeignKey
ALTER TABLE `RestaurantTable` ADD CONSTRAINT `RestaurantTable_activeComandaId_fkey` FOREIGN KEY (`activeComandaId`) REFERENCES `Comanda`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comanda` ADD CONSTRAINT `Comanda_tableId_fkey` FOREIGN KEY (`tableId`) REFERENCES `RestaurantTable`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComandaEvent` ADD CONSTRAINT `ComandaEvent_comandaId_fkey` FOREIGN KEY (`comandaId`) REFERENCES `Comanda`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
