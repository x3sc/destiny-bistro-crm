ALTER TABLE `PaymentAllocation` MODIFY `method` ENUM('CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'COUNTER') NOT NULL;
ALTER TABLE `Payment` MODIFY `origin` ENUM('QUICK_SALE_CHECKOUT', 'TABLE_CHECKOUT', 'CREDIT_INSTALLMENT', 'DELIVERY_CHECKOUT', 'COUNTER_CHECKOUT') NOT NULL;

CREATE TABLE `CounterSaleOperation` (
  `id` VARCHAR(191) NOT NULL,
  `establishmentId` VARCHAR(191) NOT NULL,
  `comandaId` VARCHAR(191) NOT NULL,
  `actorUserId` VARCHAR(191) NOT NULL,
  `action` VARCHAR(16) NOT NULL,
  `requestId` VARCHAR(191) NOT NULL,
  `requestFingerprint` CHAR(64) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `CounterSaleOperation_establishmentId_requestId_key` (`establishmentId`, `requestId`),
  INDEX `CounterSaleOperation_comandaId_establishmentId_idx` (`comandaId`, `establishmentId`),
  CONSTRAINT `CounterSaleOperation_establishmentId_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `CounterSaleOperation_comandaId_establishmentId_fkey` FOREIGN KEY (`comandaId`, `establishmentId`) REFERENCES `Comanda` (`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
