CREATE TABLE `ComandaConfirmationBatch` (
    `id` VARCHAR(191) NOT NULL,
    `establishmentId` VARCHAR(191) NOT NULL,
    `comandaId` VARCHAR(191) NOT NULL,
    `actorUserId` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `requestFingerprint` VARCHAR(64) NOT NULL,
    `inventoryWarnings` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ComandaConfirmationBatch_establishment_request_key`(`establishmentId`, `requestId`),
    UNIQUE INDEX `ComandaConfirmationBatch_id_establishment_key`(`id`, `establishmentId`),
    INDEX `ComandaConfirmationBatch_comanda_created_idx`(`comandaId`, `createdAt`),
    INDEX `ComandaConfirmationBatch_actor_created_idx`(`actorUserId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ComandaConfirmationBatch`
  ADD CONSTRAINT `ComandaConfirmationBatch_establishment_fkey`
  FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ComandaConfirmationBatch`
  ADD CONSTRAINT `ComandaConfirmationBatch_comanda_fkey`
  FOREIGN KEY (`comandaId`, `establishmentId`)
  REFERENCES `Comanda`(`id`, `establishmentId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ComandaConfirmationBatch`
  ADD CONSTRAINT `ComandaConfirmationBatch_actor_fkey`
  FOREIGN KEY (`actorUserId`, `establishmentId`)
  REFERENCES `User`(`id`, `establishmentId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
