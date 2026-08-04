INSERT INTO `Permission` (`id`, `code`, `name`, `description`, `updatedAt`)
VALUES (
  'permission_products_write',
  'products.write',
  'Gerenciar cardápio',
  'Criar, editar, ativar e desativar categorias e itens do cardápio.',
  CURRENT_TIMESTAMP(3)
)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT `Role`.`id`, `Permission`.`id`
FROM `Role`
JOIN `Permission` ON `Permission`.`code` = 'products.write'
WHERE `Role`.`code` IN ('OWNER', 'MANAGER');
