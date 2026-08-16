-- CreateTable
CREATE TABLE `DeliveryCourier` (
    `id` VARCHAR(191) NOT NULL,
    `establishmentId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `normalizedName` VARCHAR(80) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DeliveryCourier_establishmentId_active_name_idx`(`establishmentId`, `active`, `name`),
    UNIQUE INDEX `DeliveryCourier_establishmentId_normalizedName_key`(`establishmentId`, `normalizedName`),
    UNIQUE INDEX `DeliveryCourier_id_establishmentId_key`(`id`, `establishmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeliveryDay` (
    `id` VARCHAR(191) NOT NULL,
    `establishmentId` VARCHAR(191) NOT NULL,
    `courierId` VARCHAR(191) NOT NULL,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `dailyRateCents` INTEGER NOT NULL DEFAULT 0,
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,
    `settlementPaidCents` INTEGER NULL,
    `openedByUserId` VARCHAR(191) NOT NULL,
    `closedByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DeliveryDay_establishmentId_status_openedAt_idx`(`establishmentId`, `status`, `openedAt`),
    INDEX `DeliveryDay_courierId_status_idx`(`courierId`, `status`),
    INDEX `DeliveryDay_establishmentId_closedAt_idx`(`establishmentId`, `closedAt`),
    UNIQUE INDEX `DeliveryDay_id_establishmentId_key`(`id`, `establishmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Delivery` (
    `id` VARCHAR(191) NOT NULL,
    `establishmentId` VARCHAR(191) NOT NULL,
    `dayId` VARCHAR(191) NOT NULL,
    `customerName` VARCHAR(80) NOT NULL,
    `address` VARCHAR(255) NOT NULL,
    `products` VARCHAR(255) NULL,
    `totalCents` INTEGER NOT NULL,
    `feeCents` INTEGER NOT NULL,
    `paymentMethod` ENUM('CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD') NOT NULL,
    `deliveredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actorUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Delivery_establishmentId_deliveredAt_idx`(`establishmentId`, `deliveredAt`),
    INDEX `Delivery_dayId_deliveredAt_idx`(`dayId`, `deliveredAt`),
    INDEX `Delivery_actorUserId_deliveredAt_idx`(`actorUserId`, `deliveredAt`),
    UNIQUE INDEX `Delivery_id_establishmentId_key`(`id`, `establishmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeliveryExpense` (
    `id` VARCHAR(191) NOT NULL,
    `establishmentId` VARCHAR(191) NOT NULL,
    `dayId` VARCHAR(191) NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `amountCents` INTEGER NOT NULL,
    `actorUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DeliveryExpense_establishmentId_createdAt_idx`(`establishmentId`, `createdAt`),
    INDEX `DeliveryExpense_dayId_createdAt_idx`(`dayId`, `createdAt`),
    UNIQUE INDEX `DeliveryExpense_id_establishmentId_key`(`id`, `establishmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DeliveryCourier` ADD CONSTRAINT `DeliveryCourier_establishmentId_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryDay` ADD CONSTRAINT `DeliveryDay_establishmentId_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryDay` ADD CONSTRAINT `DeliveryDay_courierId_establishmentId_fkey` FOREIGN KEY (`courierId`, `establishmentId`) REFERENCES `DeliveryCourier`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryDay` ADD CONSTRAINT `DeliveryDay_openedByUserId_establishmentId_fkey` FOREIGN KEY (`openedByUserId`, `establishmentId`) REFERENCES `User`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryDay` ADD CONSTRAINT `DeliveryDay_closedByUserId_establishmentId_fkey` FOREIGN KEY (`closedByUserId`, `establishmentId`) REFERENCES `User`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Delivery` ADD CONSTRAINT `Delivery_establishmentId_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Delivery` ADD CONSTRAINT `Delivery_dayId_establishmentId_fkey` FOREIGN KEY (`dayId`, `establishmentId`) REFERENCES `DeliveryDay`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Delivery` ADD CONSTRAINT `Delivery_actorUserId_establishmentId_fkey` FOREIGN KEY (`actorUserId`, `establishmentId`) REFERENCES `User`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryExpense` ADD CONSTRAINT `DeliveryExpense_establishmentId_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryExpense` ADD CONSTRAINT `DeliveryExpense_dayId_establishmentId_fkey` FOREIGN KEY (`dayId`, `establishmentId`) REFERENCES `DeliveryDay`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeliveryExpense` ADD CONSTRAINT `DeliveryExpense_actorUserId_establishmentId_fkey` FOREIGN KEY (`actorUserId`, `establishmentId`) REFERENCES `User`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;
