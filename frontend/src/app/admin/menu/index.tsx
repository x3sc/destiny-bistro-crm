import { type Href, useRouter } from 'expo-router';

import { MenuManagementScreen } from '@/components/menu-management-screen';

export default function MenuManagementRoute() {
  const router = useRouter();

  return (
    <MenuManagementScreen
      onBack={() => router.replace('/admin' as Href)}
      onRecipes={() => router.push('/admin/menu/recipes' as Href)}
    />
  );
}
