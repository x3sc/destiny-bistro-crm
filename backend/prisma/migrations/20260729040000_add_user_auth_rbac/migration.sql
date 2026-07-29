CREATE TABLE `User` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `normalizedName` VARCHAR(80) NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `lastLoginAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `User_normalizedName_key`(`normalizedName`),
  INDEX `User_active_name_idx`(`active`, `name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Role` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `description` VARCHAR(255) NULL,
  `system` BOOLEAN NOT NULL DEFAULT false,
  `managerAssignable` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Role_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Permission` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(80) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Permission_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `UserRole` (
  `userId` VARCHAR(191) NOT NULL,
  `roleId` VARCHAR(191) NOT NULL,
  `assignedByUserId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `UserRole_roleId_idx`(`roleId`),
  INDEX `UserRole_assignedByUserId_idx`(`assignedByUserId`),
  PRIMARY KEY (`userId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RolePermission` (
  `roleId` VARCHAR(191) NOT NULL,
  `permissionId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `RolePermission_permissionId_idx`(`permissionId`),
  PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AuthSession` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `tokenHash` CHAR(64) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `revokedAt` DATETIME(3) NULL,
  `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `AuthSession_tokenHash_key`(`tokenHash`),
  INDEX `AuthSession_userId_expiresAt_idx`(`userId`, `expiresAt`),
  INDEX `AuthSession_expiresAt_revokedAt_idx`(`expiresAt`, `revokedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AuditLog` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `action` VARCHAR(80) NOT NULL,
  `resourceType` VARCHAR(50) NOT NULL,
  `resourceId` VARCHAR(191) NOT NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `AuditLog_userId_createdAt_idx`(`userId`, `createdAt`),
  INDEX `AuditLog_resourceType_resourceId_createdAt_idx`(`resourceType`, `resourceId`, `createdAt`),
  INDEX `AuditLog_action_createdAt_idx`(`action`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ComandaEvent` ADD COLUMN `actorUserId` VARCHAR(191) NULL;
CREATE INDEX `ComandaEvent_actorUserId_createdAt_idx` ON `ComandaEvent`(`actorUserId`, `createdAt`);

ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_assignedByUserId_fkey` FOREIGN KEY (`assignedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AuthSession` ADD CONSTRAINT `AuthSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ComandaEvent` ADD CONSTRAINT `ComandaEvent_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
