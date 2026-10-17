import { FontAwesome6 } from '@expo/vector-icons';

export type AppIconName =
  | 'add'
  | 'admin'
  | 'back'
  | 'cash'
  | 'card'
  | 'check'
  | 'close'
  | 'expand'
  | 'pix'
  | 'receipt'
  | 'credits'
  | 'delivery'
  | 'external'
  | 'home'
  | 'logout'
  | 'next'
  | 'printer'
  | 'kitchen'
  | 'quickSale'
  | 'restaurant'
  | 'search'
  | 'store'
  | 'tables'
  | 'user';

const iconNames: Record<
  AppIconName,
  | 'arrow-up-right-from-square'
  | 'arrow-right-from-bracket'
  | 'caret-left'
  | 'chevron-right'
  | 'circle-user'
  | 'circle-plus'
  | 'house'
  | 'laptop'
  | 'magnifying-glass'
  | 'motorcycle'
  | 'table-cells-large'
  | 'print'
  | 'store'
  | 'utensils'
  | 'bolt'
  | 'money-bill-wave'
  | 'credit-card'
  | 'circle-check'
  | 'xmark'
  | 'chevron-down'
  | 'qrcode'
  | 'receipt'
> = {
  add: 'circle-plus',
  admin: 'laptop',
  back: 'caret-left',
  cash: 'money-bill-wave',
  card: 'credit-card',
  check: 'circle-check',
  close: 'xmark',
  expand: 'chevron-down',
  pix: 'qrcode',
  receipt: 'receipt',
  credits: 'table-cells-large',
  delivery: 'motorcycle',
  external: 'arrow-up-right-from-square',
  home: 'house',
  logout: 'arrow-right-from-bracket',
  next: 'chevron-right',
  kitchen: 'utensils',
  quickSale: 'bolt',
  restaurant: 'utensils',
  search: 'magnifying-glass',
  store: 'store',
  tables: 'table-cells-large',
  user: 'circle-user',
  printer: 'print',
};

export function AppIcon({
  color,
  name,
  size,
}: {
  color: string;
  name: AppIconName;
  size: number;
}) {
  return <FontAwesome6 color={color} name={iconNames[name]} size={size} />;
}
