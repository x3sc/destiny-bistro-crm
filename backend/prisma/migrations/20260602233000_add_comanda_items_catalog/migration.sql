-- AlterTable
ALTER TABLE `ComandaEvent` MODIFY `type` ENUM('OPENED', 'CANCELLED', 'ITEM_ADDED', 'ITEM_QUANTITY_CHANGED', 'ITEM_REMOVED') NOT NULL;

-- AlterTable
ALTER TABLE `ComandaEvent` ADD COLUMN `itemId` VARCHAR(191) NULL,
    ADD COLUMN `productId` VARCHAR(191) NULL,
    ADD COLUMN `productName` VARCHAR(191) NULL,
    ADD COLUMN `unitPriceCents` INTEGER NULL,
    ADD COLUMN `previousQuantity` INTEGER NULL,
    ADD COLUMN `newQuantity` INTEGER NULL;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `priceCents` INTEGER NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Product_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ComandaItem` (
    `id` VARCHAR(191) NOT NULL,
    `comandaId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `productName` VARCHAR(191) NOT NULL,
    `unitPriceCents` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ComandaItem_comandaId_productId_key`(`comandaId`, `productId`),
    INDEX `ComandaItem_comandaId_idx`(`comandaId`),
    INDEX `ComandaItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ComandaItem` ADD CONSTRAINT `ComandaItem_comandaId_fkey` FOREIGN KEY (`comandaId`) REFERENCES `Comanda`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComandaItem` ADD CONSTRAINT `ComandaItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
