CREATE TABLE `TenantRole` (
  `id` VARCHAR(191) NOT NULL, `establishmentId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(80) NOT NULL, `name` VARCHAR(80) NOT NULL, `normalizedName` VARCHAR(80) NOT NULL,
  `description` VARCHAR(255) NULL, `protected` BOOLEAN NOT NULL DEFAULT false, `version` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `TenantRole_id_establishmentId_key` (`id`, `establishmentId`),
  UNIQUE INDEX `TenantRole_establishmentId_code_key` (`establishmentId`, `code`),
  UNIQUE INDEX `TenantRole_establishmentId_normalizedName_key` (`establishmentId`, `normalizedName`),
  CONSTRAINT `TenantRole_establishmentId_fkey` FOREIGN KEY (`establishmentId`) REFERENCES `Establishment` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `TenantRolePermission` (
  `roleId` VARCHAR(191) NOT NULL, `establishmentId` VARCHAR(191) NOT NULL, `permissionId` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`roleId`, `permissionId`), INDEX `TenantRolePermission_roleId_establishmentId_idx` (`roleId`, `establishmentId`),
  CONSTRAINT `TenantRolePermission_roleId_establishmentId_fkey` FOREIGN KEY (`roleId`, `establishmentId`) REFERENCES `TenantRole` (`id`, `establishmentId`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `TenantRolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `User` ADD COLUMN `localRoleId` VARCHAR(191) NULL, ADD COLUMN `roleVersion` INTEGER NOT NULL DEFAULT 1;
INSERT INTO `Permission` (`id`,`code`,`name`,`createdAt`,`updatedAt`) VALUES
 ('perm_quick_sales_read','quick-sales.read','Visualizar Venda Rápida',NOW(3),NOW(3)),
 ('perm_quick_sales_write','quick-sales.write','Operar Venda Rápida',NOW(3),NOW(3)),
 ('perm_counter_sales_read','counter-sales.read','Visualizar Balcão',NOW(3),NOW(3)),
 ('perm_counter_sales_write','counter-sales.write','Operar Balcão',NOW(3),NOW(3))
 ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);
INSERT INTO `TenantRole` (`id`,`establishmentId`,`code`,`name`,`normalizedName`,`description`,`protected`,`updatedAt`)
 SELECT CONCAT('tr_',MD5(CONCAT(e.id,':',r.id))),e.id,r.code,r.name,LOWER(TRIM(r.name)),r.description,r.code='OWNER',NOW(3)
 FROM `Establishment` e CROSS JOIN `Role` r;
INSERT INTO `TenantRolePermission` (`roleId`,`establishmentId`,`permissionId`)
 SELECT tr.id,tr.establishmentId,p.id FROM `TenantRole` tr JOIN `Role` r ON r.code=tr.code
 JOIN `RolePermission` rp ON rp.roleId=r.id JOIN `Permission` p ON p.id=rp.permissionId
 WHERE r.code='OWNER' OR (p.code NOT IN ('users.manage','roles.manage') AND (p.code NOT IN ('credits.read','credits.write') OR r.code='MANAGER'));
INSERT IGNORE INTO `TenantRolePermission` (`roleId`,`establishmentId`,`permissionId`)
 SELECT tr.id,tr.establishmentId,np.id FROM `TenantRole` tr JOIN `Role` r ON r.code=tr.code
 JOIN `RolePermission` rp ON rp.roleId=r.id JOIN `Permission` p ON p.id=rp.permissionId
 JOIN `Permission` np ON (p.code='comandas.read' AND np.code IN ('quick-sales.read','counter-sales.read'))
 OR (p.code='comandas.write' AND np.code IN ('quick-sales.write','counter-sales.write'));
INSERT IGNORE INTO `TenantRolePermission` (`roleId`,`establishmentId`,`permissionId`)
 SELECT tr.id,tr.establishmentId,p.id FROM `TenantRole` tr CROSS JOIN `Permission` p WHERE tr.protected=true;
INSERT INTO `TenantRole` (`id`,`establishmentId`,`code`,`name`,`normalizedName`,`updatedAt`)
 SELECT CONCAT('restricted_',MD5(e.id)),e.id,'RESTRICTED','Sem acesso','sem acesso',NOW(3) FROM `Establishment` e;
INSERT INTO `TenantRole` (`id`,`establishmentId`,`code`,`name`,`normalizedName`,`updatedAt`)
 SELECT CONCAT('legacy_',MD5(u.id)),u.establishmentId,CONCAT('LEGACY_',u.id),CONCAT('Acesso legado ',LEFT(u.id,32)),LOWER(CONCAT('Acesso legado ',LEFT(u.id,32))),NOW(3)
 FROM `User` u JOIN `UserRole` ur ON ur.userId=u.id JOIN `Role` r ON r.id=ur.roleId
 GROUP BY u.id,u.establishmentId HAVING COUNT(*)>1 AND SUM(r.code='OWNER')=0;
INSERT IGNORE INTO `TenantRolePermission` (`roleId`,`establishmentId`,`permissionId`)
 SELECT tr.id,u.establishmentId,p.id FROM `User` u JOIN `TenantRole` tr ON tr.id=CONCAT('legacy_',MD5(u.id))
 JOIN `UserRole` ur ON ur.userId=u.id JOIN `RolePermission` rp ON rp.roleId=ur.roleId JOIN `Permission` p ON p.id=rp.permissionId
 WHERE p.code NOT IN ('roles.manage','users.manage') AND (p.code NOT IN ('credits.read','credits.write') OR EXISTS
 (SELECT 1 FROM `UserRole` ur2 JOIN `Role` r2 ON r2.id=ur2.roleId WHERE ur2.userId=u.id AND r2.code='MANAGER'));
INSERT IGNORE INTO `TenantRolePermission` (`roleId`,`establishmentId`,`permissionId`)
 SELECT tr.id,tr.establishmentId,np.id FROM `TenantRole` tr JOIN `TenantRolePermission` tp ON tp.roleId=tr.id
 JOIN `Permission` p ON p.id=tp.permissionId JOIN `Permission` np ON
 (p.code='comandas.read' AND np.code IN ('quick-sales.read','counter-sales.read')) OR
 (p.code='comandas.write' AND np.code IN ('quick-sales.write','counter-sales.write')) WHERE tr.code LIKE 'LEGACY_%';
UPDATE `User` u SET u.localRoleId=CASE
 WHEN EXISTS (SELECT 1 FROM `UserRole` ur JOIN `Role` r ON r.id=ur.roleId WHERE ur.userId=u.id AND r.code='OWNER')
 THEN (SELECT tr.id FROM `TenantRole` tr WHERE tr.establishmentId=u.establishmentId AND tr.code='OWNER')
 WHEN (SELECT COUNT(*) FROM `UserRole` ur WHERE ur.userId=u.id)>1 THEN CONCAT('legacy_',MD5(u.id))
 WHEN (SELECT COUNT(*) FROM `UserRole` ur WHERE ur.userId=u.id)=1 THEN
 (SELECT CONCAT('tr_',MD5(CONCAT(u.establishmentId,':',ur.roleId))) FROM `UserRole` ur WHERE ur.userId=u.id LIMIT 1)
 ELSE CONCAT('restricted_',MD5(u.establishmentId)) END;
ALTER TABLE `User` MODIFY `localRoleId` VARCHAR(191) NOT NULL,
 ADD INDEX `User_localRoleId_establishmentId_idx` (`localRoleId`,`establishmentId`),
 ADD CONSTRAINT `User_localRoleId_establishmentId_fkey` FOREIGN KEY (`localRoleId`,`establishmentId`) REFERENCES `TenantRole` (`id`,`establishmentId`) ON DELETE RESTRICT ON UPDATE CASCADE;
