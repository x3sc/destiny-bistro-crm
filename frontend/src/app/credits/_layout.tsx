import { Redirect, Stack } from 'expo-router';
import { SafeRouteBoundary } from '@/navigation/safe-navigation';
import { hasPermission, useAuth } from '@/auth/auth-context';

export default function CreditsLayout() {
  const { user } = useAuth();
  if (!hasPermission(user, 'credits.read')) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} screenLayout={({ children }) => <SafeRouteBoundary>{children}</SafeRouteBoundary>} />;
}
