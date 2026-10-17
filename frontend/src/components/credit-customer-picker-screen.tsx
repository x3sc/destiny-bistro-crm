import { type ReactNode, useCallback, useState } from 'react';
import { useNavigationGuard } from '../navigation/safe-navigation';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OperationalText as Text } from '../theme/operational-typography';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  createCreditCustomer,
  loadCreditCustomers,
  type CreditCustomerSummary,
} from '../services/credits-api';
import { themeColors } from '../theme/tokens';
import { AppIcon } from './app-icon';
import { CreditButton } from './credit-screen-parts';
import { creditStyles } from './credit-screens.styles';
import { BrandedScreenHeader } from './branded-screen-header';

type State =
  | { kind: 'error' }
  | { kind: 'loading' }
  | { customers: CreditCustomerSummary[]; kind: 'success' };

export function CreditCustomerPickerScreen({
  actionLabel,
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  bottomNavigation,
  createRequest = createCreditCustomer,
  initialName = '',
  loadRequest = loadCreditCustomers,
  onBack,
  onSelectCustomer,
  title = 'Escolher pessoa',
}: {
  actionLabel: string;
  apiBaseUrl?: string;
  bottomNavigation?: ReactNode;
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
  useNavigationGuard({ busy: isSubmitting });
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

  const normalizedName = normalizeSearchText(name.trim());
  const visibleCustomers =
    state.kind === 'success'
      ? state.customers.filter(
          (customer) =>
            !normalizedName ||
            normalizeSearchText(customer.name).includes(normalizedName),
        )
      : [];

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
      <BrandedScreenHeader
        description="Selecione uma pessoa existente ou cadastre um novo nome"
        onBack={onBack}
        title={title}
      />
      <ScrollView
        contentContainerStyle={creditStyles.detailsContent}
        style={creditStyles.scroll}
      >
        <View style={creditStyles.formCard}>
          <Text fontRole="heading" style={creditStyles.sectionTitle}>Novo cadastro</Text>
          <Text style={creditStyles.description}>
            Digite o nome completo. Cadastros semelhantes aparecerão abaixo.
          </Text>
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

        <View style={creditStyles.sectionHeading}>
          <Text fontRole="heading" style={creditStyles.sectionTitle}>
            Pessoas cadastradas
          </Text>
          {state.kind === 'success' && (
            <Text style={creditStyles.sectionCount}>
              {visibleCustomers.length} encontradas
            </Text>
          )}
        </View>

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
            {visibleCustomers.map((customer) => (
              <Pressable
                accessibilityLabel={`${customer.name}, usar este cadastro`}
                accessibilityRole="button"
                disabled={isSubmitting}
                key={customer.id}
                onPress={() => {
                  void chooseCustomer(customer);
                }}
                style={({ pressed }) => [
                  creditStyles.personCard,
                  pressed && !isSubmitting && creditStyles.cardPressed,
                  isSubmitting && creditStyles.buttonDisabled,
                ]}
              >
                <View style={creditStyles.personCopy}>
                  <Text fontRole="heading" style={creditStyles.customerName}>
                    {customer.name}
                  </Text>
                  <Text style={creditStyles.description}>Usar este cadastro</Text>
                </View>
                <AppIcon color={themeColors.primary} name="next" size={15} />
              </Pressable>
            ))}
            {visibleCustomers.length === 0 && (
              <Text style={creditStyles.empty}>
                Nenhum cadastro semelhante. Você pode criar “{name.trim()}”.
              </Text>
            )}
          </View>
        )}
      </ScrollView>
      {bottomNavigation}
    </SafeAreaView>
  );
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}
