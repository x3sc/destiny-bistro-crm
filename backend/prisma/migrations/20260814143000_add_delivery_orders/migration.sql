ALTER TABLE `CreditOrder`
  MODIFY `source` ENUM('MANUAL', 'TABLE', 'DELIVERY') NOT NULL;

ALTER TABLE `Payment`
  MODIFY `origin` ENUM('TABLE_CHECKOUT', 'CREDIT_INSTALLMENT', 'DELIVERY_CHECKOUT') NOT NULL;

CREATE TABLE `DeliveryOrder` (
  `id` VARCHAR(191) NOT NULL,
  `establishmentId` VARCHAR(191) NOT NULL,
  `comandaId` VARCHAR(191) NOT NULL,
  `dayId` VARCHAR(191) NULL,
  `customerName` VARCHAR(80) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `address` VARCHAR(255) NOT NULL,
  `feeCents` INTEGER NOT NULL DEFAULT 0,
  `status` ENUM('NEW', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED') NOT NULL DEFAULT 'NEW',
  `dispatchedAt` DATETIME(3) NULL,
  `deliveredAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `DeliveryOrder_comandaId_key`(`comandaId`),
  UNIQUE INDEX `DeliveryOrder_id_establishmentId_key`(`id`, `establishmentId`),
  UNIQUE INDEX `DeliveryOrder_comandaId_establishmentId_key`(`comandaId`, `establishmentId`),
  INDEX `DeliveryOrder_establishmentId_status_updatedAt_idx`(`establishmentId`, `status`, `updatedAt`),
  INDEX `DeliveryOrder_dayId_status_idx`(`dayId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DeliveryOrder`
  ADD CONSTRAINT `DeliveryOrder_establishmentId_fkey`
  FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `DeliveryOrder`
  ADD CONSTRAINT `DeliveryOrder_comandaId_establishmentId_fkey`
  FOREIGN KEY (`comandaId`, `establishmentId`) REFERENCES `Comanda`(`id`, `establishmentId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `DeliveryOrder`
  ADD CONSTRAINT `DeliveryOrder_dayId_establishmentId_fkey`
  FOREIGN KEY (`dayId`, `establishmentId`) REFERENCES `DeliveryDay`(`id`, `establishmentId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `DeliveryOrder`
  ADD CONSTRAINT `DeliveryOrder_feeCents_check` CHECK (`feeCents` >= 0);
