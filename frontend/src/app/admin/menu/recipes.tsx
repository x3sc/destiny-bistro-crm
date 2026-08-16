import { type Href, useRouter } from 'expo-router';

import { RecipeManagementScreen } from '@/components/recipe-management-screen';

export default function RecipeManagementRoute() {
  const router = useRouter();
  return <RecipeManagementScreen onBack={() => router.replace('/admin/menu' as Href)} />;
}
