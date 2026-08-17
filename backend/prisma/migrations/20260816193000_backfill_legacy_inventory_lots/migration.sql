-- Preserve pre-ledger balances as traceable lots. UUID values fit the String IDs
-- used by Prisma and avoid recreating or resetting existing stock records.
INSERT INTO `InventoryLot` (
    `id`,
    `establishmentId`,
    `stockId`,
    `origin`,
    `code`,
    `initialQuantity`,
    `currentQuantity`,
    `totalCostCents`,
    `receivedAt`,
    `expiresAt`,
    `actorUserId`,
    `createdAt`,
    `updatedAt`
)
SELECT
    UUID(),
    stock.`establishmentId`,
    stock.`id`,
    'LEGACY',
    NULL,
    stock.`quantity`,
    stock.`quantity`,
    NULL,
    stock.`createdAt`,
    NULL,
    actors.`actorUserId`,
    NOW(3),
    NOW(3)
FROM `InventoryStock` AS stock
INNER JOIN (
    SELECT `establishmentId`, MIN(`id`) AS `actorUserId`
    FROM `User`
    GROUP BY `establishmentId`
) AS actors ON actors.`establishmentId` = stock.`establishmentId`
WHERE stock.`quantity` > 0
  AND NOT EXISTS (
      SELECT 1
      FROM `InventoryLot` AS lot
      WHERE lot.`stockId` = stock.`id`
  );
