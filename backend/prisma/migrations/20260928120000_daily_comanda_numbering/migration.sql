-- The historical rows keep their issued numbers. openedDate is the immutable
-- Sao Paulo calendar date on which the comanda was opened.
ALTER TABLE `Comanda`
  ADD COLUMN `openedDate` DATE NULL;

UPDATE `Comanda`
SET `openedDate` = DATE(DATE_SUB(`openedAt`, INTERVAL 3 HOUR));

ALTER TABLE `Comanda`
  MODIFY `openedDate` DATE NOT NULL,
  MODIFY `number` INTEGER NOT NULL;

DROP INDEX `Comanda_number_key` ON `Comanda`;

CREATE UNIQUE INDEX `Comanda_establishmentId_openedDate_number_key`
  ON `Comanda`(`establishmentId`, `openedDate`, `number`);

CREATE TABLE `ComandaDailySequence` (
  `establishmentId` VARCHAR(191) NOT NULL,
  `openedDate` DATE NOT NULL,
  `lastNumber` INTEGER NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`establishmentId`, `openedDate`),
  CONSTRAINT `ComandaDailySequence_establishmentId_fkey`
    FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `ComandaDailySequence` (
  `establishmentId`,
  `openedDate`,
  `lastNumber`,
  `updatedAt`
)
SELECT
  `establishmentId`,
  `openedDate`,
  MAX(`number`),
  CURRENT_TIMESTAMP(3)
FROM `Comanda`
GROUP BY `establishmentId`, `openedDate`;
