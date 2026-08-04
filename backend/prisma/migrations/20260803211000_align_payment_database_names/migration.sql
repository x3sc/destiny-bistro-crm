-- Align renamed legacy objects with the generic Payment model.
ALTER TABLE `Payment`
  DROP FOREIGN KEY `CreditSettlement_establishmentId_fkey`,
  ALTER COLUMN `origin` DROP DEFAULT,
  ADD CONSTRAINT `Payment_establishmentId_fkey`
    FOREIGN KEY (`establishmentId`)
    REFERENCES `Establishment`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  RENAME INDEX `CreditSettlement_establishmentId_paidAt_idx`
    TO `Payment_establishmentId_paidAt_idx`,
  RENAME INDEX `CreditSettlement_id_establishmentId_key`
    TO `Payment_id_establishmentId_key`;
