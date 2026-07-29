-- AlterTable
ALTER TABLE `Comanda` MODIFY `tableId` INTEGER NULL;

-- CreateTable
CREATE TABLE `CreditCustomer` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `normalizedName` VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CreditCustomer_normalizedName_key`(`normalizedName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditSettlement` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `amountCents` INTEGER NOT NULL,
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CreditSettlement_customerId_paidAt_idx`(`customerId`, `paidAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditOrder` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `comandaId` VARCHAR(191) NOT NULL,
    `source` ENUM('MANUAL', 'TABLE') NOT NULL,
    `status` ENUM('DRAFT', 'OPEN', 'SETTLED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `totalCents` INTEGER NOT NULL DEFAULT 0,
    `orderedAt` DATETIME(3) NOT NULL,
    `finalizedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `settledAt` DATETIME(3) NULL,
    `settlementId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CreditOrder_comandaId_key`(`comandaId`),
    INDEX `CreditOrder_customerId_status_idx`(`customerId`, `status`),
    INDEX `CreditOrder_settlementId_idx`(`settlementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CreditSettlement` ADD CONSTRAINT `CreditSettlement_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `CreditCustomer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditOrder` ADD CONSTRAINT `CreditOrder_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `CreditCustomer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditOrder` ADD CONSTRAINT `CreditOrder_comandaId_fkey` FOREIGN KEY (`comandaId`) REFERENCES `Comanda`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditOrder` ADD CONSTRAINT `CreditOrder_settlementId_fkey` FOREIGN KEY (`settlementId`) REFERENCES `CreditSettlement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
