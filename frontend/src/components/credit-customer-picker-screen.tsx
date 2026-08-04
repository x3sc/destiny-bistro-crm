import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  createCreditCustomer,
  loadCreditCustomers,
  type CreditCustomerSummary,
} from '../services/credits-api';
import { themeColors } from '../theme/tokens';
import { CreditButton } from './credit-screen-parts';
import { creditStyles } from './credit-screens.styles';
import { ScreenBackButton } from './screen-back-button';

type State =
  | { kind: 'error' }
  | { kind: 'loading' }
  | { customers: CreditCustomerSummary[]; kind: 'success' };

export function CreditCustomerPickerScreen({
  actionLabel,
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  createRequest = createCreditCustomer,
  initialName = '',
  loadRequest = loadCreditCustomers,
  onBack,
  onSelectCustomer,
  title = 'Escolher pessoa',
}: {
  actionLabel: string;
  apiBaseUrl?: string;
  createRequest?: typeof createCreditCustomer;
  initialName?: string;
  loadRequest?: typeof loadCreditCustomers;
  onBack: () => void;
  onSelectCustomer: (customer: CreditCustomerSummary) => Promise<void>;
  title?: string;
}) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [name, setName] = useState(initialName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [state, setState] = useState<State>({ kind: 'loading' });

  const refresh = useCallback(() => {
    if (!normalizedApiBaseUrl) {
      setState({ kind: 'error' });
      return;
    }

    setState({ kind: 'loading' });
    void loadRequest(normalizedApiBaseUrl, true).then(
      (customers) => {
        setState({ customers, kind: 'success' });
      },
      () => {
        setState({ kind: 'error' });
      },
    );
  }, [loadRequest, normalizedApiBaseUrl]);

  useFocusEffect(refresh);

  const chooseCustomer = async (customer: CreditCustomerSummary) => {
    setIsSubmitting(true);
    setSubmitError(false);

    try {
      await onSelectCustomer(customer);
    } catch {
      setSubmitError(true);
      setIsSubmitting(false);
    }
  };

  const createAndChoose = async () => {
    const trimmedName = name.trim();

    if (!normalizedApiBaseUrl || !trimmedName) {
      setSubmitError(true);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(false);

    try {
      const customer = await createRequest(normalizedApiBaseUrl, trimmedName);
      await onSelectCustomer(customer);
    } catch {
      setSubmitError(true);
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={creditStyles.safeArea}>
      <ScrollView contentContainerStyle={creditStyles.content}>
        <ScreenBackButton onPress={onBack} />
        <View style={creditStyles.heading}>
          <Text style={creditStyles.eyebrow}>Destiny Bistro CRM</Text>
          <Text style={creditStyles.title}>{title}</Text>
          <Text style={creditStyles.description}>
            Selecione uma pessoa existente ou cadastre um novo nome.
          </Text>
        </View>

        <View style={creditStyles.card}>
          <Text style={creditStyles.sectionTitle}>Cadastrar pessoa</Text>
          <TextInput
            accessibilityLabel="Nome da pessoa"
            editable={!isSubmitting}
            maxLength={80}
            onChangeText={setName}
            placeholder="Nome"
            style={creditStyles.field}
            value={name}
          />
          <CreditButton
            disabled={isSubmitting || !name.trim()}
            label={isSubmitting ? 'Processando...' : actionLabel}
            onPress={() => {
              void createAndChoose();
            }}
          />
        </View>

        {submitError && (
          <Text style={creditStyles.error}>
            Não foi possível concluir esta operação.
          </Text>
        )}

        <Text style={creditStyles.sectionTitle}>Pessoas cadastradas</Text>

        {state.kind === 'loading' && (
          <View style={creditStyles.loading}>
            <ActivityIndicator color={themeColors.primaryActivity} size="large" />
          </View>
        )}
        {state.kind === 'error' && (
          <View style={creditStyles.actions}>
            <Text style={creditStyles.error}>
              Não foi possível carregar as pessoas.
            </Text>
            <CreditButton label="Tentar novamente" onPress={refresh} />
          </View>
        )}
        {state.kind === 'success' && state.customers.length === 0 && (
          <Text style={creditStyles.empty}>Nenhuma pessoa cadastrada.</Text>
        )}
        {state.kind === 'success' && state.customers.length > 0 && (
          <View style={creditStyles.list}>
            {state.customers.map((customer) => (
              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                key={customer.id}
                onPress={() => {
                  void chooseCustomer(customer);
                }}
                style={({ pressed }) => [
                  creditStyles.card,
                  pressed && !isSubmitting && creditStyles.cardPressed,
                  isSubmitting && creditStyles.buttonDisabled,
                ]}
              >
                <Text style={creditStyles.cardTitle}>{customer.name}</Text>
                <Text style={creditStyles.description}>
                  Usar este cadastro
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
