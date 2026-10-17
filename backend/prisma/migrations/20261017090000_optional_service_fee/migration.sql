ALTER TABLE `Comanda` ADD COLUMN `serviceFeeApplied` BOOLEAN NULL,
 ADD COLUMN `serviceFeePercent` INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN `serviceFeeSubtotalCents` INTEGER NULL,
 ADD COLUMN `serviceFeeAmountCents` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `ComandaEvent` ADD COLUMN `serviceFeeDeltaCents` INTEGER NULL,
 MODIFY `type` ENUM('OPENED','CANCELLED','CLOSED','ITEM_ADDED','ITEM_CONFIRMED','ITEM_QUANTITY_CHANGED','ITEM_REMOVED','ITEM_CANCELLED','ADDITIONALS_CHANGED','SERVICE_FEE_CHANGED') NOT NULL;
CREATE TABLE `ComandaCheckoutOperation` (
 `id` VARCHAR(191) NOT NULL, `establishmentId` VARCHAR(191) NOT NULL, `comandaId` VARCHAR(191) NOT NULL,
 `actorUserId` VARCHAR(191) NOT NULL, `requestId` VARCHAR(191) NOT NULL, `requestFingerprint` CHAR(64) NOT NULL,
 `result` JSON NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
 UNIQUE INDEX `ComandaCheckoutOperation_establishmentId_requestId_key` (`establishmentId`,`requestId`),
 INDEX `ComandaCheckoutOperation_comandaId_establishmentId_idx` (`comandaId`,`establishmentId`),
 CONSTRAINT `ComandaCheckoutOperation_establishmentId_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT `ComandaCheckoutOperation_comandaId_establishmentId_fkey` FOREIGN KEY (`comandaId`,`establishmentId`) REFERENCES `Comanda` (`id`,`establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
