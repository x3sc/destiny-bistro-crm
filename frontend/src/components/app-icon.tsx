import { FontAwesome6 } from '@expo/vector-icons';

export type AppIconName =
  | 'admin'
  | 'back'
  | 'credits'
  | 'delivery'
  | 'external'
  | 'printer'
  | 'kitchen'
  | 'search'
  | 'tables'
  | 'user';

const iconNames: Record<
  AppIconName,
  | 'arrow-up-right-from-square'
  | 'caret-left'
  | 'circle-user'
  | 'house'
  | 'laptop'
  | 'magnifying-glass'
  | 'motorcycle'
  | 'table-cells-large'
  | 'print'
  | 'utensils'
> = {
  admin: 'laptop',
  back: 'caret-left',
  credits: 'table-cells-large',
  delivery: 'motorcycle',
  external: 'arrow-up-right-from-square',
  kitchen: 'utensils',
  search: 'magnifying-glass',
  tables: 'house',
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
