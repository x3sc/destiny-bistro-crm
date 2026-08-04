-- Replace the single credit settlement with an immutable payment ledger.
ALTER TABLE `CreditOrder`
  DROP FOREIGN KEY `CreditOrder_settlementId_establishmentId_fkey`;

ALTER TABLE `CreditSettlement`
  DROP FOREIGN KEY `CreditSettlement_customerId_establishmentId_fkey`;

RENAME TABLE `CreditSettlement` TO `Payment`;

ALTER TABLE `Payment`
  ADD COLUMN `comandaId` VARCHAR(191) NULL,
  ADD COLUMN `creditOrderId` VARCHAR(191) NULL,
  ADD COLUMN `origin` ENUM('TABLE_CHECKOUT', 'CREDIT_INSTALLMENT') NOT NULL DEFAULT 'CREDIT_INSTALLMENT',
  ADD COLUMN `recordedByUserId` VARCHAR(191) NULL;

UPDATE `Payment` AS payment
INNER JOIN `CreditOrder` AS credit_order
  ON credit_order.`settlementId` = payment.`id`
  AND credit_order.`establishmentId` = payment.`establishmentId`
SET
  payment.`comandaId` = credit_order.`comandaId`,
  payment.`creditOrderId` = credit_order.`id`;

ALTER TABLE `Payment`
  MODIFY `comandaId` VARCHAR(191) NOT NULL,
  DROP COLUMN `customerId`;

ALTER TABLE `CreditOrder`
  DROP INDEX `CreditOrder_settlementId_idx`,
  DROP COLUMN `settlementId`;

CREATE UNIQUE INDEX `CreditOrder_id_establishmentId_key`
  ON `CreditOrder`(`id`, `establishmentId`);

CREATE INDEX `Payment_comandaId_paidAt_idx` ON `Payment`(`comandaId`, `paidAt`);
CREATE INDEX `Payment_creditOrderId_paidAt_idx` ON `Payment`(`creditOrderId`, `paidAt`);
CREATE INDEX `Payment_recordedByUserId_paidAt_idx` ON `Payment`(`recordedByUserId`, `paidAt`);

ALTER TABLE `Payment`
  ADD CONSTRAINT `Payment_comandaId_establishmentId_fkey`
    FOREIGN KEY (`comandaId`, `establishmentId`)
    REFERENCES `Comanda`(`id`, `establishmentId`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `Payment_creditOrderId_establishmentId_fkey`
    FOREIGN KEY (`creditOrderId`, `establishmentId`)
    REFERENCES `CreditOrder`(`id`, `establishmentId`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `Payment_recordedByUserId_establishmentId_fkey`
    FOREIGN KEY (`recordedByUserId`, `establishmentId`)
    REFERENCES `User`(`id`, `establishmentId`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `Payment_amountCents_positive` CHECK (`amountCents` > 0);

CREATE TABLE `PaymentAllocation` (
  `id` VARCHAR(191) NOT NULL,
  `establishmentId` VARCHAR(191) NOT NULL,
  `paymentId` VARCHAR(191) NOT NULL,
  `method` ENUM('CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD') NOT NULL,
  `amountCents` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `PaymentAllocation_paymentId_method_key`(`paymentId`, `method`),
  INDEX `PaymentAllocation_establishmentId_createdAt_idx`(`establishmentId`, `createdAt`),
  INDEX `PaymentAllocation_paymentId_idx`(`paymentId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `PaymentAllocation_amountCents_positive` CHECK (`amountCents` > 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PaymentAllocation`
  ADD CONSTRAINT `PaymentAllocation_establishmentId_fkey`
    FOREIGN KEY (`establishmentId`)
    REFERENCES `Establishment`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `PaymentAllocation_paymentId_establishmentId_fkey`
    FOREIGN KEY (`paymentId`, `establishmentId`)
    REFERENCES `Payment`(`id`, `establishmentId`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
