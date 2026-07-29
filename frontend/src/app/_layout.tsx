import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from '@/auth/auth-context';
import {
  AuthLoadingScreen,
  LoginScreen,
} from '@/components/login-screen';
import { normalizeApiBaseUrl } from '@/services/api-base-url';

export default function RootLayout() {
  const apiBaseUrl = normalizeApiBaseUrl(
    process.env.EXPO_PUBLIC_API_URL ?? '',
  ) ?? '';

  return (
    <AuthProvider apiBaseUrl={apiBaseUrl}>
      <AuthenticatedApplication />
    </AuthProvider>
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

  return <Stack screenOptions={{ headerShown: false }} />;
}
