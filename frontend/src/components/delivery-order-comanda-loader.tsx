import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import { loadDeliveryOrder } from '../services/deliveries-api';
import { themeColors } from '../theme/tokens';
import { BrandedScreenHeader } from './branded-screen-header';
import { deliveryOrderStyles as styles } from './delivery-order-screens.styles';
import { DeliveryButton } from './delivery-screen-parts';

export function DeliveryOrderComandaLoader({
  children,
  onBack,
  orderId,
  title,
}: {
  children: (comandaId: string) => ReactNode;
  onBack: () => void;
  orderId: string;
  title: string;
}) {
  const apiBaseUrl = normalizeApiBaseUrl(process.env.EXPO_PUBLIC_API_URL);
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'error' }
    | { comandaId: string; kind: 'success' }
  >({ kind: 'loading' });

  const load = useCallback(() => {
    if (!apiBaseUrl || !orderId) {
      setState({ kind: 'error' });
      return;
    }
    setState({ kind: 'loading' });
    void loadDeliveryOrder(apiBaseUrl, orderId).then(
      (order) => setState({ comandaId: order.comandaId, kind: 'success' }),
      () => setState({ kind: 'error' }),
    );
  }, [apiBaseUrl, orderId]);

  useEffect(() => {
    let active = true;

    if (!apiBaseUrl || !orderId) {
      void Promise.resolve().then(() => {
        if (active) setState({ kind: 'error' });
      });
    } else {
      void loadDeliveryOrder(apiBaseUrl, orderId).then(
        (order) => {
          if (active) {
            setState({ comandaId: order.comandaId, kind: 'success' });
          }
        },
        () => {
          if (active) setState({ kind: 'error' });
        },
      );
    }

    return () => {
      active = false;
    };
  }, [apiBaseUrl, orderId]);

  if (state.kind === 'success') {
    return children(state.comandaId);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <BrandedScreenHeader onBack={onBack} title={title} />
      <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
        {state.kind === 'loading' ? (
          <View style={styles.loading}>
            <ActivityIndicator color={themeColors.primaryActivity} size="large" />
            <Text style={styles.meta}>Carregando pedido...</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.error}>Não foi possível carregar o pedido.</Text>
            <DeliveryButton label="Tentar novamente" onPress={load} tone="secondary" />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
