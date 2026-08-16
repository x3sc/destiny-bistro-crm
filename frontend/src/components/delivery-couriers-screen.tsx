import { type ReactNode, useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  createDeliveryCourier,
  loadDeliveryCouriers,
  type DeliveryCourierSummary,
} from '../services/deliveries-api';
import { formatCentsAsBrl } from '../services/money';
import { themeColors } from '../theme/tokens';
import { BrandedScreenHeader } from './branded-screen-header';
import { DeliverySectionTabs } from './delivery-section-tabs';
import { DeliveryButton, TextField } from './delivery-screen-parts';
import { deliveryStyles } from './delivery-screens.styles';

type State =
  | { couriers: DeliveryCourierSummary[]; kind: 'success' }
  | { kind: 'error' }
  | { kind: 'loading' };

export function DeliveryCouriersScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  bottomNavigation,
  createRequest = createDeliveryCourier,
  loadRequest = loadDeliveryCouriers,
  onBack,
  onOrders,
  onSelectCourier,
}: {
  apiBaseUrl?: string;
  bottomNavigation?: ReactNode;
  createRequest?: typeof createDeliveryCourier;
  loadRequest?: typeof loadDeliveryCouriers;
  onBack: () => void;
  onOrders?: () => void;
  onSelectCourier: (courier: DeliveryCourierSummary) => void;
}) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [name, setName] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!normalizedApiBaseUrl) {
      setState({ kind: 'error' });
      return;
    }

    setState({ kind: 'loading' });
    void loadRequest(normalizedApiBaseUrl).then(
      (couriers) => {
        setState({ couriers, kind: 'success' });
      },
      () => {
        setState({ kind: 'error' });
      },
    );
  }, [loadRequest, normalizedApiBaseUrl]);

  useFocusEffect(refresh);

  const submit = () => {
    if (!normalizedApiBaseUrl || !name.trim() || saving) {
      return;
    }

    setSaving(true);
    setFormError(null);
    void createRequest(normalizedApiBaseUrl, name).then(
      () => {
        setSaving(false);
        setName('');
        setFormOpen(false);
        refresh();
      },
      (error: unknown) => {
        setSaving(false);
        setFormError(
          error instanceof Error
            ? error.message
            : 'Não foi possível cadastrar o entregador.',
        );
      },
    );
  };

  return (
    <SafeAreaView style={deliveryStyles.safeArea}>
      <BrandedScreenHeader
        description="Entregadores, diárias e acertos"
        onBack={onBack}
        title="Delivery"
      />
      <ScrollView
        contentContainerStyle={deliveryStyles.content}
        style={deliveryStyles.scroll}
      >
        {onOrders ? (
          <DeliverySectionTabs
            active="couriers"
            onCouriers={() => undefined}
            onOrders={onOrders}
          />
        ) : null}
        {formOpen ? (
          <View style={deliveryStyles.formCard}>
            <Text style={deliveryStyles.sectionTitle}>Novo entregador</Text>
            <TextField
              label="Nome do entregador"
              onChangeText={setName}
              placeholder="Ex.: João"
              value={name}
            />
            {formError ? (
              <Text style={deliveryStyles.error}>{formError}</Text>
            ) : null}
            <DeliveryButton
              disabled={!name.trim() || saving}
              label={saving ? 'Cadastrando...' : 'Cadastrar entregador'}
              onPress={submit}
            />
            <DeliveryButton
              label="Cancelar"
              onPress={() => {
                setFormOpen(false);
                setFormError(null);
                setName('');
              }}
              tone="secondary"
            />
          </View>
        ) : (
          <View style={deliveryStyles.actions}>
            <DeliveryButton
              label="Cadastrar entregador"
              onPress={() => {
                setFormOpen(true);
              }}
            />
          </View>
        )}

        {state.kind === 'loading' && (
          <View style={deliveryStyles.loading}>
            <ActivityIndicator
              color={themeColors.primaryActivity}
              size="large"
            />
            <Text style={deliveryStyles.description}>
              Carregando entregadores...
            </Text>
          </View>
        )}

        {state.kind === 'error' && (
          <View style={deliveryStyles.actions}>
            <Text style={deliveryStyles.error}>
              Não foi possível carregar os entregadores.
            </Text>
            <DeliveryButton label="Tentar novamente" onPress={refresh} />
          </View>
        )}

        {state.kind === 'success' && state.couriers.length === 0 && (
          <Text style={deliveryStyles.empty}>
            Nenhum entregador cadastrado ainda.
          </Text>
        )}

        {state.kind === 'success' && state.couriers.length > 0 && (
          <View style={deliveryStyles.list}>
            <Text style={deliveryStyles.sectionTitle}>Entregadores</Text>
            {state.couriers.map((courier) => (
              <Pressable
                accessibilityRole="button"
                key={courier.id}
                onPress={() => {
                  onSelectCourier(courier);
                }}
                style={({ pressed }) => [
                  deliveryStyles.card,
                  pressed && deliveryStyles.cardPressed,
                ]}
              >
                <View style={deliveryStyles.row}>
                  <Text style={deliveryStyles.cardTitle}>{courier.name}</Text>
                  {courier.activeDayId ? (
                    <Text
                      style={[deliveryStyles.badge, deliveryStyles.badgeOpen]}
                    >
                      Dia aberto
                    </Text>
                  ) : null}
                </View>
                <Text style={deliveryStyles.description}>
                  Já recebeu {formatCentsAsBrl(courier.settledTotalCents)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
      {bottomNavigation}
    </SafeAreaView>
  );
}
