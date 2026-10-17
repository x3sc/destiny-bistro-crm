import { Stack } from 'expo-router';
import { SafeNavigationProvider, SafeRouteBoundary } from '@/navigation/safe-navigation';
import { AuthorizationSessionBoundary } from '@/navigation/authorization-session-boundary';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, hasPermission, useAuth } from '@/auth/auth-context';
import {
  AuthLoadingScreen,
  LoginScreen,
} from '@/components/login-screen';
import { normalizeApiBaseUrl } from '@/services/api-base-url';
import { OperationalTypographyProvider } from '@/theme/operational-typography';

export default function RootLayout() {
  const apiBaseUrl = normalizeApiBaseUrl(
    process.env.EXPO_PUBLIC_API_URL ?? '',
  ) ?? '';

  return (
    <OperationalTypographyProvider>
      <AuthProvider apiBaseUrl={apiBaseUrl}>
        <AuthenticatedApplication />
      </AuthProvider>
    </OperationalTypographyProvider>
  );
}

function AuthenticatedApplication() {
  const { loading, signIn, user } = useAuth();

  if (loading) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return (
      <>
        <StatusBar style="dark" />
        <LoginScreen onLogin={signIn} />
      </>
    );
  }

  return <SafeNavigationProvider canAccess={(permission) => hasPermission(user, permission)}>
    <AuthorizationSessionBoundary />
    <Stack screenOptions={{ headerShown: false }} screenLayout={({ children }) => <SafeRouteBoundary>{children}</SafeRouteBoundary>} />
  </SafeNavigationProvider>;
}
