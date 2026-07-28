-- AlterTable
ALTER TABLE `ComandaEvent` MODIFY `type` ENUM(
    'OPENED',
    'CANCELLED',
    'ITEM_ADDED',
    'ITEM_CONFIRMED',
    'ITEM_QUANTITY_CHANGED',
    'ITEM_REMOVED'
) NOT NULL;

-- AlterTable
ALTER TABLE `ComandaItem`
    ADD COLUMN `confirmedQuantity` INTEGER NOT NULL DEFAULT 0,
    ADD CONSTRAINT `ComandaItem_confirmedQuantity_check`
        CHECK (`confirmedQuantity` >= 0 AND `confirmedQuantity` <= `quantity`);
