import { FontAwesome6 } from '@expo/vector-icons';

export type AppIconName =
  | 'admin'
  | 'back'
  | 'credits'
  | 'external'
  | 'search'
  | 'tables'
  | 'user';

const iconNames: Record<
  AppIconName,
  'arrow-up-right-from-square' | 'caret-left' | 'circle-user' | 'house' | 'laptop' | 'magnifying-glass' | 'table-cells-large'
> = {
  admin: 'laptop',
  back: 'caret-left',
  credits: 'table-cells-large',
  external: 'arrow-up-right-from-square',
  search: 'magnifying-glass',
  tables: 'house',
  user: 'circle-user',
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
