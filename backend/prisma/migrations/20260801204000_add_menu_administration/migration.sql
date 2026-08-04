CREATE TABLE `MenuCategory` (
  `id` VARCHAR(191) NOT NULL,
  `establishmentId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `normalizedName` VARCHAR(80) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `MenuCategory_establishmentId_normalizedName_key` (`establishmentId`, `normalizedName`),
  UNIQUE INDEX `MenuCategory_id_establishmentId_key` (`id`, `establishmentId`),
  INDEX `MenuCategory_establishmentId_active_name_idx` (`establishmentId`, `active`, `name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `MenuCategory` (
  `id`,
  `establishmentId`,
  `name`,
  `normalizedName`,
  `updatedAt`
)
SELECT DISTINCT
  CONCAT('cat_', MD5(CONCAT(`establishmentId`, ':', `category`))),
  `establishmentId`,
  CASE `category`
    WHEN 'CLASSIC_BURGERS' THEN 'Hambúrgueres clássicos'
    WHEN 'ARTISAN_BURGERS' THEN 'Hambúrgueres artesanais'
    WHEN 'EXTRAS' THEN 'Adicionais'
    WHEN 'BEVERAGES' THEN 'Bebidas'
    WHEN 'COCKTAILS' THEN 'Drinks'
    WHEN 'BEERS' THEN 'Cervejas'
    WHEN 'SIDES' THEN 'Batatas e nuggets'
    WHEN 'SNACKS' THEN 'Petiscos'
    WHEN 'COMBOS' THEN 'Combos'
    ELSE 'Outros'
  END,
  CASE `category`
    WHEN 'CLASSIC_BURGERS' THEN 'hambúrgueres clássicos'
    WHEN 'ARTISAN_BURGERS' THEN 'hambúrgueres artesanais'
    WHEN 'EXTRAS' THEN 'adicionais'
    WHEN 'BEVERAGES' THEN 'bebidas'
    WHEN 'COCKTAILS' THEN 'drinks'
    WHEN 'BEERS' THEN 'cervejas'
    WHEN 'SIDES' THEN 'batatas e nuggets'
    WHEN 'SNACKS' THEN 'petiscos'
    WHEN 'COMBOS' THEN 'combos'
    ELSE 'outros'
  END,
  CURRENT_TIMESTAMP(3)
FROM `Product`;

ALTER TABLE `Product`
  ADD COLUMN `categoryId` VARCHAR(191) NULL,
  ADD COLUMN `description` VARCHAR(255) NULL;

UPDATE `Product`
SET `categoryId` = CONCAT(
  'cat_',
  MD5(CONCAT(`establishmentId`, ':', `category`))
);

ALTER TABLE `Product`
  MODIFY `categoryId` VARCHAR(191) NOT NULL,
  DROP COLUMN `category`;

CREATE INDEX `Product_categoryId_active_name_idx`
  ON `Product` (`categoryId`, `active`, `name`);

ALTER TABLE `MenuCategory`
  ADD CONSTRAINT `MenuCategory_establishmentId_fkey`
  FOREIGN KEY (`establishmentId`) REFERENCES `Establishment` (`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Product`
  ADD CONSTRAINT `Product_categoryId_establishmentId_fkey`
  FOREIGN KEY (`categoryId`, `establishmentId`)
  REFERENCES `MenuCategory` (`id`, `establishmentId`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
