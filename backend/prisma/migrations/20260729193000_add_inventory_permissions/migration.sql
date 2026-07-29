INSERT INTO `Permission` (
    `id`,
    `code`,
    `name`,
    `createdAt`,
    `updatedAt`
)
VALUES
    (
        'permission_inventory_read',
        'inventory.read',
        'Visualizar estoque',
        CURRENT_TIMESTAMP(3),
        CURRENT_TIMESTAMP(3)
    ),
    (
        'permission_inventory_write',
        'inventory.write',
        'Alterar estoque',
        CURRENT_TIMESTAMP(3),
        CURRENT_TIMESTAMP(3)
    )
ON DUPLICATE KEY UPDATE
    `name` = VALUES(`name`),
    `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT INTO `RolePermission` (`roleId`, `permissionId`, `createdAt`)
SELECT role_record.`id`, permission_record.`id`, CURRENT_TIMESTAMP(3)
FROM `Role` AS role_record
INNER JOIN `Permission` AS permission_record
    ON permission_record.`code` IN ('inventory.read', 'inventory.write')
WHERE role_record.`code` IN ('OWNER', 'MANAGER')
ON DUPLICATE KEY UPDATE
    `createdAt` = VALUES(`createdAt`);

INSERT INTO `RolePermission` (`roleId`, `permissionId`, `createdAt`)
SELECT role_record.`id`, permission_record.`id`, CURRENT_TIMESTAMP(3)
FROM `Role` AS role_record
INNER JOIN `Permission` AS permission_record
    ON permission_record.`code` = 'inventory.read'
WHERE role_record.`code` = 'KITCHEN'
ON DUPLICATE KEY UPDATE
    `createdAt` = VALUES(`createdAt`);
