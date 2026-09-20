ALTER TABLE `Product`
  ADD COLUMN `requiresKitchen` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `ComandaItem`
  ADD COLUMN `requiresKitchen` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `KitchenTicket` (
    `id` VARCHAR(191) NOT NULL,
    `establishmentId` VARCHAR(191) NOT NULL,
    `comandaId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `confirmationKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `KitchenTicket_id_establishment_key`(`id`, `establishmentId`),
    UNIQUE INDEX `KitchenTicket_establishment_confirmation_key`(`establishmentId`, `confirmationKey`),
    INDEX `KitchenTicket_establishment_status_created_idx`(`establishmentId`, `status`, `createdAt`),
    INDEX `KitchenTicket_comanda_establishment_idx`(`comandaId`, `establishmentId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `KitchenTicket_establishment_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `KitchenTicket_comanda_fkey` FOREIGN KEY (`comandaId`, `establishmentId`) REFERENCES `Comanda`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `KitchenTicketItem` (
    `id` VARCHAR(191) NOT NULL,
    `establishmentId` VARCHAR(191) NOT NULL,
    `kitchenTicketId` VARCHAR(191) NOT NULL,
    `comandaItemId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `productName` VARCHAR(100) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `KitchenTicketItem_id_establishment_key`(`id`, `establishmentId`),
    UNIQUE INDEX `KitchenTicketItem_ticket_comanda_item_key`(`kitchenTicketId`, `comandaItemId`),
    INDEX `KitchenTicketItem_establishment_created_idx`(`establishmentId`, `createdAt`),
    INDEX `KitchenTicketItem_comanda_item_establishment_idx`(`comandaItemId`, `establishmentId`),
    INDEX `KitchenTicketItem_product_establishment_idx`(`productId`, `establishmentId`),
    CONSTRAINT `KitchenTicketItem_quantity_chk` CHECK (`quantity` > 0),
    PRIMARY KEY (`id`),
    CONSTRAINT `KitchenTicketItem_establishment_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `KitchenTicketItem_ticket_fkey` FOREIGN KEY (`kitchenTicketId`, `establishmentId`) REFERENCES `KitchenTicket`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `KitchenTicketItem_comanda_item_fkey` FOREIGN KEY (`comandaItemId`, `establishmentId`) REFERENCES `ComandaItem`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `KitchenTicketItem_product_fkey` FOREIGN KEY (`productId`, `establishmentId`) REFERENCES `Product`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `KitchenTicketItemConfiguration` (
    `id` VARCHAR(191) NOT NULL,
    `establishmentId` VARCHAR(191) NOT NULL,
    `kitchenTicketItemId` VARCHAR(191) NOT NULL,
    `sourceConfigurationId` VARCHAR(191) NOT NULL,
    `configurationKey` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `KitchenTicketItemConfiguration_id_establishment_key`(`id`, `establishmentId`),
    UNIQUE INDEX `KitchenTicketItemConfiguration_item_source_key`(`kitchenTicketItemId`, `sourceConfigurationId`),
    INDEX `KitchenTicketItemConfiguration_establishment_created_idx`(`establishmentId`, `createdAt`),
    INDEX `KitchenTicketItemConfiguration_source_establishment_idx`(`sourceConfigurationId`, `establishmentId`),
    CONSTRAINT `KitchenTicketItemConfiguration_quantity_chk` CHECK (`quantity` > 0),
    PRIMARY KEY (`id`),
    CONSTRAINT `KitchenTicketItemConfiguration_establishment_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `KitchenTicketItemConfiguration_item_fkey` FOREIGN KEY (`kitchenTicketItemId`, `establishmentId`) REFERENCES `KitchenTicketItem`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `KitchenTicketItemConfiguration_source_fkey` FOREIGN KEY (`sourceConfigurationId`, `establishmentId`) REFERENCES `ComandaItemConfiguration`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `KitchenTicketItemAdditional` (
    `id` VARCHAR(191) NOT NULL,
    `establishmentId` VARCHAR(191) NOT NULL,
    `kitchenTicketItemConfigurationId` VARCHAR(191) NOT NULL,
    `additionalId` VARCHAR(191) NOT NULL,
    `additionalName` VARCHAR(100) NOT NULL,
    `quantityPerUnit` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `KitchenTicketItemAdditional_configuration_additional_key`(`kitchenTicketItemConfigurationId`, `additionalId`),
    INDEX `KitchenTicketItemAdditional_establishment_created_idx`(`establishmentId`, `createdAt`),
    CONSTRAINT `KitchenTicketItemAdditional_quantity_chk` CHECK (`quantityPerUnit` > 0),
    PRIMARY KEY (`id`),
    CONSTRAINT `KitchenTicketItemAdditional_establishment_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `KitchenTicketItemAdditional_configuration_fkey` FOREIGN KEY (`kitchenTicketItemConfigurationId`, `establishmentId`) REFERENCES `KitchenTicketItemConfiguration`(`id`, `establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `Permission` (`id`, `code`, `name`, `description`, `updatedAt`)
VALUES
  (
    'permission_kitchen_read',
    'kitchen.read',
    'Visualizar cozinha',
    'Consultar tickets e itens enviados para preparo.',
    CURRENT_TIMESTAMP(3)
  ),
  (
    'permission_kitchen_write',
    'kitchen.write',
    'Alterar cozinha',
    'Atualizar o estado de preparo e cancelar tickets de cozinha.',
    CURRENT_TIMESTAMP(3)
  )
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT `Role`.`id`, `Permission`.`id`
FROM `Role`
JOIN `Permission` ON `Permission`.`code` IN ('kitchen.read', 'kitchen.write')
WHERE `Role`.`code` IN ('OWNER', 'MANAGER', 'KITCHEN');
