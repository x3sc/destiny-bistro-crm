CREATE TABLE `Establishment` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `normalizedName` VARCHAR(80) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Establishment_normalizedName_key`(`normalizedName`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `Establishment` (
  `id`,
  `name`,
  `normalizedName`,
  `updatedAt`
) VALUES (
  'legacy-establishment',
  'Estabelecimento principal',
  'estabelecimento principal',
  CURRENT_TIMESTAMP(3)
);

ALTER TABLE `RestaurantTable`
  ADD COLUMN `establishmentId` VARCHAR(191) NOT NULL DEFAULT 'legacy-establishment';
ALTER TABLE `Comanda`
  ADD COLUMN `establishmentId` VARCHAR(191) NOT NULL DEFAULT 'legacy-establishment';
ALTER TABLE `CreditCustomer`
  ADD COLUMN `establishmentId` VARCHAR(191) NOT NULL DEFAULT 'legacy-establishment';
ALTER TABLE `Product`
  ADD COLUMN `establishmentId` VARCHAR(191) NOT NULL DEFAULT 'legacy-establishment';
ALTER TABLE `User`
  ADD COLUMN `establishmentId` VARCHAR(191) NOT NULL DEFAULT 'legacy-establishment';
ALTER TABLE `AuditLog`
  ADD COLUMN `establishmentId` VARCHAR(191) NOT NULL DEFAULT 'legacy-establishment';

ALTER TABLE `RestaurantTable` ALTER COLUMN `establishmentId` DROP DEFAULT;
ALTER TABLE `Comanda` ALTER COLUMN `establishmentId` DROP DEFAULT;
ALTER TABLE `CreditCustomer` ALTER COLUMN `establishmentId` DROP DEFAULT;
ALTER TABLE `Product` ALTER COLUMN `establishmentId` DROP DEFAULT;
ALTER TABLE `User` ALTER COLUMN `establishmentId` DROP DEFAULT;
ALTER TABLE `AuditLog` ALTER COLUMN `establishmentId` DROP DEFAULT;

DROP INDEX `RestaurantTable_number_key` ON `RestaurantTable`;
DROP INDEX `CreditCustomer_normalizedName_key` ON `CreditCustomer`;
DROP INDEX `Product_code_key` ON `Product`;

CREATE UNIQUE INDEX `RestaurantTable_establishmentId_number_key`
  ON `RestaurantTable`(`establishmentId`, `number`);
CREATE INDEX `RestaurantTable_establishmentId_status_idx`
  ON `RestaurantTable`(`establishmentId`, `status`);
CREATE INDEX `Comanda_establishmentId_status_idx`
  ON `Comanda`(`establishmentId`, `status`);
CREATE UNIQUE INDEX `CreditCustomer_establishmentId_normalizedName_key`
  ON `CreditCustomer`(`establishmentId`, `normalizedName`);
CREATE INDEX `CreditCustomer_establishmentId_name_idx`
  ON `CreditCustomer`(`establishmentId`, `name`);
CREATE UNIQUE INDEX `Product_establishmentId_code_key`
  ON `Product`(`establishmentId`, `code`);
CREATE INDEX `Product_establishmentId_active_name_idx`
  ON `Product`(`establishmentId`, `active`, `name`);
CREATE INDEX `User_establishmentId_active_name_idx`
  ON `User`(`establishmentId`, `active`, `name`);
CREATE INDEX `AuditLog_establishmentId_createdAt_idx`
  ON `AuditLog`(`establishmentId`, `createdAt`);

ALTER TABLE `RestaurantTable`
  ADD CONSTRAINT `RestaurantTable_establishmentId_fkey`
  FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Comanda`
  ADD CONSTRAINT `Comanda_establishmentId_fkey`
  FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CreditCustomer`
  ADD CONSTRAINT `CreditCustomer_establishmentId_fkey`
  FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Product`
  ADD CONSTRAINT `Product_establishmentId_fkey`
  FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `User`
  ADD CONSTRAINT `User_establishmentId_fkey`
  FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `AuditLog`
  ADD CONSTRAINT `AuditLog_establishmentId_fkey`
  FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
