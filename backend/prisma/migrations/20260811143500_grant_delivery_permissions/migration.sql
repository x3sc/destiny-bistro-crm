INSERT INTO `Permission` (`id`, `code`, `name`, `description`, `updatedAt`)
VALUES
  (
    'permission_deliveries_read',
    'deliveries.read',
    'Visualizar delivery',
    'Consultar entregadores, dias, entregas, despesas e acertos.',
    CURRENT_TIMESTAMP(3)
  ),
  (
    'permission_deliveries_write',
    'deliveries.write',
    'Alterar delivery',
    'Cadastrar entregadores, iniciar dias, registrar entregas e despesas e fechar acertos.',
    CURRENT_TIMESTAMP(3)
  )
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT `Role`.`id`, `Permission`.`id`
FROM `Role`
JOIN `Permission` ON `Permission`.`code` IN ('deliveries.read', 'deliveries.write')
WHERE `Role`.`code` IN ('OWNER', 'MANAGER', 'WAITER');
