-- AlterTable
ALTER TABLE `Product` ADD COLUMN `category` ENUM(
    'CLASSIC_BURGERS',
    'ARTISAN_BURGERS',
    'EXTRAS',
    'BEVERAGES',
    'COCKTAILS',
    'BEERS',
    'SIDES',
    'SNACKS',
    'COMBOS',
    'OTHER'
) NOT NULL DEFAULT 'OTHER';
