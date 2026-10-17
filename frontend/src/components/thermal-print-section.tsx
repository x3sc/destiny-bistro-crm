import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  loadComandaPrintDocument,
  PrintAccountConflictError,
  type ComandaPrintDocument,
  type ComandaPrintKind,
} from '../services/comanda-print-api';
import {
  defaultPrinterSettings,
  loadPrinterSettings,
  parsePrinterSettings,
  savePrinterSettings,
  type PrinterSettings,
} from '../services/printer-settings';
import { sendToThermalPrinter } from '../services/thermal-printer';
import {
  buildThermalReceiptBytes,
  thermalReceiptPreview,
  type CounterReceiptRecipient,
} from '../services/thermal-receipt';
import { themeColors } from '../theme/tokens';
import { AppIcon } from './app-icon';
import { useNavigationGuard } from '../navigation/safe-navigation';

interface ThermalPrintSectionProps {
  counterStage?: 'pending' | 'final';
  counterSale?: { name: string | null; number: number; status: 'OPEN' | 'CLOSED' | 'CANCELLED'; items: readonly { quantity: number; confirmedQuantity: number }[] };
  checkoutPreview?: { includeServiceFee: boolean; expectedSnapshot: string };
  disabled?: boolean;
  onPrinted?: () => void;
  onConflict?: () => void;
  apiBaseUrl: string;
  canPrint: boolean;
  comandaId: string;
  loadDocument?: typeof loadComandaPrintDocument;
  loadSettings?: typeof loadPrinterSettings;
  platform?: string;
  saveSettings?: typeof savePrinterSettings;
  sendPrint?: typeof sendToThermalPrinter;
}

export function ThermalPrintSection({
  counterSale,
  counterStage,
  checkoutPreview,
  disabled = false,
  onPrinted,
  onConflict,
  apiBaseUrl,
  canPrint,
  comandaId,
  loadDocument = loadComandaPrintDocument,
  loadSettings = loadPrinterSettings,
  platform = Platform.OS,
  saveSettings = savePrinterSettings,
  sendPrint = sendToThermalPrinter,
}: ThermalPrintSectionProps) {
  const counterSnapshot = JSON.stringify(counterSale);
  const [preview, setPreview] = useState<{ document: ComandaPrintDocument; snapshot: string | undefined; recipient?: CounterReceiptRecipient }>();
  const document = preview?.snapshot === counterSnapshot ? preview?.document : undefined;
  const setDocument = (value?: ComandaPrintDocument, recipient?: CounterReceiptRecipient) => setPreview(value ? { document: value, snapshot: counterSnapshot, recipient } : undefined);
  const [settings, setSettings] = useState<PrinterSettings>(defaultPrinterSettings);
  const [host, setHost] = useState(defaultPrinterSettings.host);
  const [port, setPort] = useState(String(defaultPrinterSettings.port));
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [message, setMessage] = useState<string>();
  const sendingLock = useRef(false);
  const loadingLock = useRef(false);
  const hasPending = Boolean(counterSale?.items.some((item) => item.quantity > item.confirmedQuantity));
  const hasDelivered = Boolean(counterSale?.items.some((item) => item.confirmedQuantity > 0));
  const counterOpen = counterSale?.status === 'OPEN';
  useNavigationGuard({ busy: sending || loading,
    closeModal: document ? () => setDocument(undefined) : showSettings ? () => setShowSettings(false) : undefined });

  useEffect(() => {
    void loadSettings().then((value) => {
      setSettings(value);
      setHost(value.host);
      setPort(String(value.port));
    });
  }, [loadSettings]);

  if (!canPrint || platform === 'web' || (counterSale && counterStage === 'pending' && (!counterOpen || !hasPending))) return null;

  const openPreview = async (kind: ComandaPrintKind, recipient?: CounterReceiptRecipient) => {
    if (disabled || loadingLock.current || sendingLock.current) return;
    if (counterSale && (!counterOpen || (kind === 'COUNTER_PENDING' ? !hasPending : hasPending || !hasDelivered))) return;
    loadingLock.current = true;
    setLoading(true);
    setMessage(undefined);
    try {
      const [value, currentSettings] = await Promise.all([
        loadDocument(apiBaseUrl, comandaId, kind, ...(checkoutPreview ? [checkoutPreview] : [])),
        loadSettings(),
      ]);
      setSettings(currentSettings);
      setHost(currentSettings.host);
      setPort(String(currentSettings.port));
      setDocument(value, recipient);
    } catch (error) {
      if (error instanceof PrintAccountConflictError) onConflict?.();
      setMessage(error instanceof Error ? error.message : 'Não foi possível preparar a impressão.');
    } finally {
      loadingLock.current = false;
      setLoading(false);
    }
  };

  const persistSettings = async () => {
    try {
      const value = parsePrinterSettings(host, port);
      await saveSettings(value);
      setSettings(value);
      setShowSettings(false);
      setMessage('Impressora configurada neste dispositivo.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Configuração inválida.');
    }
  };

  const send = async (target: ComandaPrintDocument) => {
    if (sendingLock.current || disabled) return;
    sendingLock.current = true;
    setSending(true);
    setMessage(undefined);
    try {
      await sendPrint(buildThermalReceiptBytes(target, preview?.recipient), settings);
      if (target.kind === 'CHECKOUT_PREVIEW') onPrinted?.();
      setDocument(undefined);
      setMessage(`Enviado à impressora ${settings.host}:${settings.port}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível imprimir.');
    } finally {
      sendingLock.current = false;
      setSending(false);
    }
  };

  const testPrinter = async () => {
    if (sendingLock.current || loadingLock.current) return;
    sendingLock.current = true;
    const now = new Date().toISOString();
    const testDocument: ComandaPrintDocument = {
      comandaId: 'test',
      comandaName: 'Teste de conexão',
      comandaNumber: 0,
      deliveryFeeCents: null,
      destination: 'COUNTER',
      establishmentName: 'Destiny Bistro CRM',
      generatedAt: now,
      generatedBy: 'Configuração local',
      items: [{
        additionals: [],
        productName: 'Impressora configurada',
        quantity: 1,
        subtotalCents: 0,
        unitPriceCents: 0,
      }],
      kind: 'CONFIRMED',
      openedAt: now,
      status: 'OPEN',
      tableNumber: null,
      totalCents: 0,
    };
    try {
      const value = parsePrinterSettings(host, port);
      setSending(true);
      await sendPrint(buildThermalReceiptBytes(testDocument), value);
      setMessage(`Teste enviado à impressora ${value.host}:${value.port}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível testar a impressora.');
    } finally {
      sendingLock.current = false;
      setSending(false);
    }
  };

  return (
    <View style={printStyles.section} testID="thermal-print-section">
      <View style={printStyles.headingRow}>
        <View style={printStyles.headingCopy}>
          <Text style={printStyles.sectionTitle}>{counterSale ? counterStage === 'pending' ? 'Impressão dos pendentes' : counterStage === 'final' ? 'Conferência final' : 'Impressão do balcão' : 'Impressão'}</Text>
          <Text style={printStyles.description}>{counterSale ? 'Escolha uma via para imprimir.' : 'Bobina térmica 80 mm em preto e branco'}</Text>
        </View>
        <Pressable
          accessibilityLabel="Configurar impressora"
          accessibilityRole="button"
          onPress={() => setShowSettings(true)}
          style={printStyles.settingsButton}
        >
          <AppIcon color={themeColors.primary} name="printer" size={18} />
        </Pressable>
      </View>

      <View style={counterSale ? printStyles.counterButtons : printStyles.buttonRow}>
        {counterSale ? <>
          {counterStage !== 'final' && counterOpen && hasPending && <>
            <PrintButton
              disabled={loading || sending || disabled}
              label="Imprimir pendentes para o cliente"
              description={`Balcão · Comanda #${counterSale.number} · ${counterSale.name || 'Cliente não identificado'}`}
              onPress={() => void openPreview('COUNTER_PENDING', 'CLIENT')}
            />
            <PrintButton
              disabled={loading || sending || disabled}
              label="Imprimir pendentes para o balcão"
              description={`Balcão · Comanda #${counterSale.number} · ${counterSale.name || 'Cliente não identificado'}`}
              onPress={() => void openPreview('COUNTER_PENDING', 'COUNTER')}
              secondary
            />
          </>}
          {counterStage !== 'pending' && <>
            <PrintButton
              disabled={loading || sending || disabled || !counterOpen || hasPending || !hasDelivered}
              label="Imprimir conferência final para o cliente"
              description={`Balcão · Comanda #${counterSale.number} · ${counterSale.name || 'Cliente não identificado'}`}
              onPress={() => void openPreview('COUNTER_FINAL', 'CLIENT')}
            />
            <PrintButton
              disabled={loading || sending || disabled || !counterOpen || hasPending || !hasDelivered}
              label="Imprimir conferência final para o balcão"
              description={`Balcão · Comanda #${counterSale.number} · ${counterSale.name || 'Cliente não identificado'}`}
              onPress={() => void openPreview('COUNTER_FINAL', 'COUNTER')}
              secondary
            />
          </>}
        </> : <>
          <PrintButton
            disabled={loading || sending || disabled}
            label={checkoutPreview ? 'Imprimir conta' : 'Imprimir comanda'}
            onPress={() => void openPreview(checkoutPreview ? 'CHECKOUT_PREVIEW' : 'CONFIRMED')}
          />
          {!checkoutPreview && <PrintButton
            disabled={loading || sending || disabled}
            label="Imprimir cozinha"
            onPress={() => void openPreview('KITCHEN_PENDING')}
          />}
        </>}
      </View>
      {counterSale && counterStage !== 'pending' && counterOpen && hasPending && <Text style={printStyles.description}>
        Entregue ou cancele os itens pendentes para emitir a conferência final.
      </Text>}
      {loading && <ActivityIndicator color={themeColors.primaryActivity} />}
      {message && <Text style={printStyles.message}>{message}</Text>}

      <Modal
        animationType="slide"
        onRequestClose={() => { if (!sendingLock.current) setDocument(undefined); }}
        transparent
        visible={Boolean(document)}
      >
        <View style={printStyles.modalBackdrop}>
          <View style={printStyles.modalCard}>
            <Text style={printStyles.modalTitle}>Prévia da impressão</Text>
            <Text style={printStyles.modalDescription}>
              {counterSale ? 'Confira a via selecionada antes de enviar. Repetir o envio pode duplicar esta via.' : 'Confira antes de enviar. Repetir o envio pode produzir uma segunda via.'}
            </Text>
            <ScrollView style={printStyles.previewScroll}>
              <Text style={printStyles.paperPreview} testID="thermal-paper-preview">
                {document ? thermalReceiptPreview(document, preview?.recipient) : ''}
              </Text>
            </ScrollView>
            <Text style={printStyles.endpoint}>{settings.host}:{settings.port}</Text>
            {message && <Text style={printStyles.message}>{message}</Text>}
            <View style={printStyles.modalActions}>
              <PrintButton
                disabled={sending}
                label="Configurar"
                onPress={() => {
                  setDocument(undefined);
                  setShowSettings(true);
                }}
                secondary
              />
              <PrintButton
                disabled={sending || disabled}
                label={sending ? 'Enviando...' : 'Enviar à impressora'}
                onPress={() => document && void send(document)}
              />
            </View>
            <Pressable disabled={sending} onPress={() => setDocument(undefined)} style={printStyles.cancelButton}>
              <Text style={printStyles.cancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setShowSettings(false)}
        transparent
        visible={showSettings}
      >
        <View style={printStyles.modalBackdrop}>
          <View style={printStyles.settingsCard}>
            <Text style={printStyles.modalTitle}>Configurar impressora</Text>
            <Text style={printStyles.fieldLabel}>Endereço IP</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="numbers-and-punctuation"
              onChangeText={setHost}
              style={printStyles.input}
              testID="printer-host"
              value={host}
            />
            <Text style={printStyles.fieldLabel}>Porta RAW TCP</Text>
            <TextInput
              keyboardType="number-pad"
              onChangeText={setPort}
              style={printStyles.input}
              testID="printer-port"
              value={port}
            />
            <Text style={printStyles.description}>Papel 80 mm · 48 colunas · corte total</Text>
            {message && <Text style={printStyles.message}>{message}</Text>}
            <View style={printStyles.settingsActions}>
              <PrintButton disabled={sending} label="Testar impressão" onPress={() => void testPrinter()} secondary />
              <PrintButton label="Salvar" onPress={() => void persistSettings()} />
            </View>
            <Pressable onPress={() => setShowSettings(false)} style={printStyles.cancelButton}>
              <Text style={printStyles.cancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PrintButton({
  disabled = false,
  description,
  label,
  onPress,
  secondary = false,
}: {
  disabled?: boolean;
  description?: string;
  label: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={description}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        printStyles.button,
        description && printStyles.describedButton,
        secondary && printStyles.secondaryButton,
        pressed && printStyles.pressedButton,
        disabled && printStyles.disabledButton,
      ]}
    >
      <Text style={[printStyles.buttonText, secondary && printStyles.secondaryButtonText]}>{label}</Text>
      {description && <Text style={[printStyles.buttonDescription, secondary && printStyles.secondaryButtonText]}>{description}</Text>}
    </Pressable>
  );
}

const printStyles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: themeColors.primary,
    borderColor: themeColors.primary,
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 12,
  },
  buttonRow: { flexDirection: 'row', gap: 8 },
  counterButtons: { gap: 8 },
  describedButton: { flex: 0, gap: 4, paddingVertical: 12, minHeight: 76 },
  buttonDescription: { color: themeColors.foregroundOnPrimary, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  buttonText: { color: themeColors.foregroundOnPrimary, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  cancelButton: { alignItems: 'center', minHeight: 44, padding: 12 },
  cancelText: { color: themeColors.foregroundMuted, fontSize: 14, fontWeight: '700' },
  description: { color: themeColors.foregroundMuted, fontSize: 13, lineHeight: 18 },
  disabledButton: { opacity: 0.5 },
  endpoint: { color: themeColors.foreground, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  fieldLabel: { color: themeColors.foreground, fontSize: 14, fontWeight: '700' },
  headingCopy: { flex: 1, gap: 2 },
  headingRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  input: { backgroundColor: themeColors.surface, borderColor: themeColors.borderStrong, borderRadius: 12, borderWidth: 1, color: themeColors.foreground, minHeight: 48, paddingHorizontal: 14 },
  message: { color: themeColors.foregroundMuted, fontSize: 13, lineHeight: 18 },
  modalActions: { flexDirection: 'row', gap: 8 },
  modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', flex: 1, justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: themeColors.surface, borderRadius: 22, gap: 12, maxHeight: '92%', maxWidth: 520, padding: 18, width: '100%' },
  modalDescription: { color: themeColors.foregroundMuted, fontSize: 13, lineHeight: 19 },
  modalTitle: { color: themeColors.foreground, fontSize: 20, fontWeight: '800' },
  paperPreview: { backgroundColor: '#ffffff', color: '#000000', fontFamily: Platform.select({ android: 'monospace', ios: 'Courier', default: 'monospace' }), fontSize: 11, lineHeight: 16, padding: 14 },
  pressedButton: { opacity: 0.72 },
  previewScroll: { backgroundColor: '#ffffff', borderColor: '#000000', borderRadius: 2, borderWidth: 1, maxHeight: 390 },
  secondaryButton: { backgroundColor: themeColors.surface, borderColor: themeColors.primary },
  secondaryButtonText: { color: themeColors.primary },
  section: { backgroundColor: themeColors.surfaceMuted, borderColor: themeColors.border, borderRadius: 22, borderWidth: 1, gap: 12, padding: 16 },
  sectionTitle: { color: themeColors.foreground, fontSize: 18, fontWeight: '700' },
  settingsActions: { flexDirection: 'row', gap: 8 },
  settingsButton: { alignItems: 'center', borderColor: themeColors.primary, borderRadius: 22, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  settingsCard: { backgroundColor: themeColors.surface, borderRadius: 22, gap: 10, maxWidth: 480, padding: 20, width: '100%' },
});
