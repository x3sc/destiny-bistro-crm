INSERT INTO `Permission` (`id`, `code`, `name`, `description`, `updatedAt`)
VALUES (
  'permission_printing_write',
  'printing.write',
  'Imprimir comandas e cozinha',
  'Gerar documentos e enviar impressões térmicas operacionais.',
  CURRENT_TIMESTAMP(3)
)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT `Role`.`id`, `Permission`.`id`
FROM `Role`
JOIN `Permission` ON `Permission`.`code` = 'printing.write'
WHERE `Role`.`code` IN ('OWNER', 'MANAGER', 'WAITER', 'KITCHEN');
