import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type CheckStatus = 'connected' | 'idle' | 'loading' | 'unavailable';

interface ConnectivityScreenProps {
  apiBaseUrl?: string;
}

const statusLabels: Record<CheckStatus, string> = {
  connected: 'Conectado',
  idle: 'Não verificado',
  loading: 'Verificando...',
  unavailable: 'Indisponível',
};

function normalizeApiBaseUrl(value: string | undefined) {
  return value?.trim().replace(/\/+$/, '');
}

export function ConnectivityScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
}: ConnectivityScreenProps) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [apiStatus, setApiStatus] = useState<CheckStatus>(
    normalizedApiBaseUrl ? 'loading' : 'idle',
  );
  const [databaseStatus, setDatabaseStatus] = useState<CheckStatus>('idle');

  const checkConnectivity = useCallback(async () => {
    if (!normalizedApiBaseUrl) {
      setApiStatus('idle');
      setDatabaseStatus('idle');
      return;
    }

    try {
      const healthResponse = await fetch(`${normalizedApiBaseUrl}/health`);

      if (!healthResponse.ok) {
        throw new Error('API health check failed');
      }

      setApiStatus('connected');
      setDatabaseStatus('loading');

      try {
        const readinessResponse = await fetch(`${normalizedApiBaseUrl}/ready`);

        setDatabaseStatus(readinessResponse.ok ? 'connected' : 'unavailable');
      } catch {
        setDatabaseStatus('unavailable');
      }
    } catch {
      setApiStatus('unavailable');
      setDatabaseStatus('idle');
    }
  }, [normalizedApiBaseUrl]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setApiStatus(normalizedApiBaseUrl ? 'loading' : 'idle');
      setDatabaseStatus('idle');
      void checkConnectivity();
    }, 0);

    return () => {
      clearTimeout(timeout);
    };
  }, [checkConnectivity, normalizedApiBaseUrl]);

  const retryConnectivity = () => {
    setApiStatus('loading');
    setDatabaseStatus('idle');
    void checkConnectivity();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>Destiny Bistro CRM</Text>
          <Text style={styles.title}>Verificação do ambiente</Text>
          <Text style={styles.description}>
            Confirme se o aplicativo consegue acessar a API e o banco MySQL.
          </Text>
        </View>

        {!normalizedApiBaseUrl && (
          <Text style={styles.configurationError}>
            Configure EXPO_PUBLIC_API_URL antes de iniciar o aplicativo.
          </Text>
        )}

        <View style={styles.statusList}>
          <StatusCard label="API" status={apiStatus} />
          <StatusCard label="MySQL" status={databaseStatus} />
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={!normalizedApiBaseUrl}
          onPress={retryConnectivity}
          style={({ pressed }) => [
            styles.button,
            !normalizedApiBaseUrl && styles.buttonDisabled,
            pressed && normalizedApiBaseUrl && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>Tentar novamente</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function StatusCard({ label, status }: { label: string; status: CheckStatus }) {
  return (
    <View style={styles.statusCard}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, status === 'connected' && styles.connected]}>
        {statusLabels[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f2eb',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
    padding: 24,
  },
  heading: {
    gap: 8,
  },
  eyebrow: {
    color: '#795548',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#2f241f',
    fontSize: 32,
    fontWeight: '700',
  },
  description: {
    color: '#5d514b',
    fontSize: 16,
    lineHeight: 24,
  },
  configurationError: {
    borderRadius: 12,
    backgroundColor: '#f8d7da',
    color: '#842029',
    padding: 16,
  },
  statusList: {
    gap: 12,
  },
  statusCard: {
    borderRadius: 12,
    backgroundColor: '#ffffff',
    gap: 4,
    padding: 16,
  },
  statusLabel: {
    color: '#5d514b',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusValue: {
    color: '#842029',
    fontSize: 20,
    fontWeight: '700',
  },
  connected: {
    color: '#146c43',
  },
  button: {
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#6f4e37',
    padding: 16,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
