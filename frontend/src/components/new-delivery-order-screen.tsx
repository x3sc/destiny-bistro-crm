import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  createDeliveryOrder,
  type DeliveryOrder,
} from '../services/deliveries-api';
import { isBrazilianMobile } from '../services/phone';
import { BrandedScreenHeader } from './branded-screen-header';
import { deliveryOrderStyles as styles } from './delivery-order-screens.styles';
import {
  DeliveryButton,
  MoneyField,
  PhoneField,
  TextField,
} from './delivery-screen-parts';

export function NewDeliveryOrderScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  createRequest = createDeliveryOrder,
  onBack,
  onCreated,
}: {
  apiBaseUrl?: string;
  createRequest?: typeof createDeliveryOrder;
  onBack: () => void;
  onCreated: (order: DeliveryOrder) => void;
}) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [address, setAddress] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [feeCents, setFeeCents] = useState(0);
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const phoneValid = isBrazilianMobile(phone);
  const valid =
    Boolean(normalizedApiBaseUrl) &&
    customerName.trim().length > 0 &&
    phoneValid &&
    address.trim().length > 0;

  const submit = async () => {
    if (!normalizedApiBaseUrl || !valid || saving) return;
    setSaving(true);
    setError(false);
    try {
      onCreated(
        await createRequest(normalizedApiBaseUrl, {
          address: address.trim(),
          customerName: customerName.trim(),
          feeCents,
          phone: phone.trim(),
        }),
      );
    } catch {
      setError(true);
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <BrandedScreenHeader
        description="Cadastre o cliente e monte o pedido usando o cardápio"
        onBack={onBack}
        title="Novo pedido"
      />
      <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Dados da entrega</Text>
          <TextField
            label="Nome do cliente"
            onChangeText={setCustomerName}
            placeholder="Quem receberá o pedido"
            value={customerName}
          />
          <PhoneField
            label="Telefone"
            onChangeDigits={setPhone}
            valueDigits={phone}
          />
          {phone.length > 0 && !phoneValid ? (
            <Text style={styles.error}>
              Informe um celular com DDD no formato (11) 99999-9999.
            </Text>
          ) : null}
          <TextField
            label="Endereço"
            onChangeText={setAddress}
            placeholder="Rua, número, complemento e referência"
            value={address}
          />
          <MoneyField
            label="Taxa de entrega"
            onChangeCents={setFeeCents}
            valueCents={feeCents}
          />
          <Text style={styles.meta}>
            A taxa será somada aos produtos e ficará incluída no total do pedido.
          </Text>
        </View>
        {error ? (
          <Text style={styles.error}>Não foi possível criar o pedido.</Text>
        ) : null}
        <DeliveryButton
          disabled={!valid || saving}
          label={saving ? 'Criando pedido...' : 'Continuar para o cardápio'}
          onPress={() => void submit()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
