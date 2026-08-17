import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  createIngredient,
  createInventoryEntry,
  createInventoryMovement,
  deactivateIngredient,
  loadInventory,
  loadInventoryLots,
  loadInventoryMovements,
  updateIngredient,
  type IngredientUnit,
  type InventoryItem,
  type InventoryLot,
  type InventoryMovement,
} from '../services/inventory-api';
import {
  centsFromBrlInput,
  formatCentsForBrlInput,
} from '../services/money';
import { themeColors } from '../theme/tokens';
import { BrandedScreenHeader } from './branded-screen-header';

type Editor = 'ingredient' | 'entry' | 'exit' | 'loss' | 'adjustment' | undefined;

export function InventoryManagementScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL,
  onBack,
}: {
  apiBaseUrl?: string;
  onBack: () => void;
}) {
  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [inventory, setInventory] = useState<InventoryItem[]>();
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<InventoryItem>();
  const [lots, setLots] = useState<InventoryLot[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [editor, setEditor] = useState<Editor>();
  const [ingredientBeingEdited, setIngredientBeingEdited] = useState<InventoryItem>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  const refresh = useCallback(() => {
    if (!normalizedApiBaseUrl) {
      return Promise.resolve().then(() => setError(true));
    }
    return loadInventory(normalizedApiBaseUrl).then(
      (result) => {
        setInventory(result);
        setSelected((current) => result.find(({ id }) => id === current?.id));
        setError(false);
      },
      () => setError(true),
    );
  }, [normalizedApiBaseUrl]);

  useEffect(() => void refresh(), [refresh]);

  const openDetails = async (item: InventoryItem) => {
    setSelected(item);
    setEditor('entry');
    setMessage(undefined);
    if (!normalizedApiBaseUrl) return;
    try {
      const [nextLots, nextMovements] = await Promise.all([
        loadInventoryLots(normalizedApiBaseUrl, item.id),
        loadInventoryMovements(normalizedApiBaseUrl, item.id),
      ]);
      setLots(nextLots);
      setMovements(nextMovements);
    } catch {
      setMessage('Não foi possível carregar lotes e movimentações.');
    }
  };

  const closeDetails = () => {
    setEditor(undefined);
    setIngredientBeingEdited(undefined);
    setLots([]);
    setMovements([]);
    setSelected(undefined);
  };

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return (inventory ?? []).filter((item) =>
      `${item.ingredient.code} ${item.ingredient.name}`
        .toLocaleLowerCase('pt-BR')
        .includes(normalized),
    );
  }, [inventory, query]);

  const mutate = async (request: () => Promise<unknown>, success: string) => {
    if (busy) return;
    setBusy(true);
    setMessage(undefined);
    try {
      await request();
      await refresh();
      if (selected && normalizedApiBaseUrl) {
        const [nextLots, nextMovements] = await Promise.all([
          loadInventoryLots(normalizedApiBaseUrl, selected.id),
          loadInventoryMovements(normalizedApiBaseUrl, selected.id),
        ]);
        setLots(nextLots);
        setMovements(nextMovements);
      }
      setEditor(undefined);
      setMessage(success);
    } catch {
      setMessage('Não foi possível concluir. Confira os valores e tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <BrandedScreenHeader
        description="Saldos, lotes, entradas, perdas e histórico por insumo"
        onBack={onBack}
        title="Estoque"
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.toolbar}>
          <TextInput
            accessibilityLabel="Pesquisar insumo"
            onChangeText={setQuery}
            placeholder="Pesquisar por nome ou código"
            placeholderTextColor={themeColors.placeholder}
            style={styles.input}
            value={query}
          />
          <ActionButton label="Novo insumo" onPress={() => { setIngredientBeingEdited(undefined); setEditor('ingredient'); }} />
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}
        {error ? <Text style={styles.error}>Não foi possível carregar o estoque.</Text> : null}
        {!inventory && !error ? <ActivityIndicator color={themeColors.primary} /> : null}

        <View style={styles.summaryRow}>
          <Summary label="Insumos" value={String(inventory?.length ?? 0)} />
          <Summary label="Estoque baixo" value={String(inventory?.filter((item) => item.lowStock).length ?? 0)} />
          <Summary label="Com déficit" value={String(inventory?.filter((item) => item.deficitQuantity > 0).length ?? 0)} />
        </View>

        <View style={styles.list}>
          {filtered.map((item) => (
            <Pressable
              accessibilityLabel={`Gerenciar ${item.ingredient.name}`}
              accessibilityRole="button"
              key={item.id}
              onPress={() => void openDetails(item)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View style={styles.cardHeading}>
                <View style={styles.grow}>
                  <Text style={styles.cardTitle}>{item.ingredient.name}</Text>
                  <Text style={styles.muted}>{item.ingredient.code} · {unitLabel(item.ingredient.unit)}</Text>
                </View>
                <Text style={styles.balance}>{formatQuantity(item.quantity, item.ingredient.unit)}</Text>
              </View>
              <View style={styles.badges}>
                {item.lowStock ? <Badge label="Estoque baixo" danger /> : <Badge label="Saldo normal" />}
                {item.deficitQuantity > 0 ? <Badge label={`Déficit ${formatQuantity(item.deficitQuantity, item.ingredient.unit)}`} danger /> : null}
                {!item.ingredient.active ? <Badge label="Inativo" danger /> : null}
              </View>
            </Pressable>
          ))}
        </View>

      </ScrollView>

      {editor === 'ingredient' && normalizedApiBaseUrl ? (
        <Modal
          animationType="fade"
          onRequestClose={() => setEditor(undefined)}
          transparent
          visible
        >
          <View style={styles.modalBackdrop}>
            <View
              accessibilityLabel={ingredientBeingEdited ? 'Janela de editar insumo' : 'Janela de novo insumo'}
              accessibilityViewIsModal
              style={styles.modalSheet}
            >
              <ScrollView
                contentContainerStyle={styles.modalContent}
                keyboardShouldPersistTaps="handled"
              >
                <IngredientEditor
                  busy={busy}
                  initial={ingredientBeingEdited}
                  onCancel={() => setEditor(undefined)}
                  onSave={(input) => mutate(
                    () => ingredientBeingEdited
                      ? updateIngredient(normalizedApiBaseUrl, ingredientBeingEdited.ingredient.id, {
                          ...input,
                          active: ingredientBeingEdited.ingredient.active,
                        })
                      : createIngredient(normalizedApiBaseUrl, input),
                    ingredientBeingEdited ? 'Insumo atualizado.' : 'Insumo cadastrado.',
                  )}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}

      {selected && editor !== 'ingredient' && normalizedApiBaseUrl ? (
        <Modal
          animationType="fade"
          onRequestClose={closeDetails}
          transparent
          visible
        >
          <View style={styles.modalBackdrop}>
            <View
              accessibilityLabel={`Janela de estoque de ${selected.ingredient.name}`}
              accessibilityViewIsModal
              style={styles.modalSheet}
            >
              <ScrollView
                contentContainerStyle={styles.modalContent}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.details}>
                  <View style={styles.modalHeading}>
                    <Text style={styles.sectionTitle}>{selected.ingredient.name}</Text>
                    <ActionButton label="Fechar" onPress={closeDetails} secondary />
                  </View>
                  {message ? <Text style={styles.modalMessage}>{message}</Text> : null}
                  <View style={styles.actions}>
                    <ActionButton label="Editar insumo" onPress={() => { setIngredientBeingEdited(selected); setEditor('ingredient'); }} secondary />
                    {selected.ingredient.active ? (
                      <ActionButton label="Desativar" onPress={() => void mutate(() => deactivateIngredient(normalizedApiBaseUrl, selected.ingredient.id), 'Insumo desativado.')} secondary />
                    ) : (
                      <ActionButton label="Ativar" onPress={() => void mutate(() => updateIngredient(normalizedApiBaseUrl, selected.ingredient.id, {
                        active: true,
                        code: selected.ingredient.code,
                        minimumQuantity: selected.minimumQuantity,
                        name: selected.ingredient.name,
                        unit: selected.ingredient.unit,
                      }), 'Insumo ativado.')} secondary />
                    )}
                    <ActionButton label="Entrada" onPress={() => setEditor('entry')} />
                    <ActionButton label="Retirada" onPress={() => setEditor('exit')} secondary />
                    <ActionButton label="Perda" onPress={() => setEditor('loss')} secondary />
                    <ActionButton label="Ajuste" onPress={() => setEditor('adjustment')} secondary />
                  </View>
                  {editor ? (
                    <MovementEditor
                      busy={busy}
                      editor={editor}
                      item={selected}
                      onCancel={() => setEditor(undefined)}
                      onSave={(input) => {
                        if (editor === 'entry') {
                          return mutate(
                            () => createInventoryEntry(normalizedApiBaseUrl, selected.id, input.entry!),
                            'Entrada registrada.',
                          );
                        }
                        return mutate(
                          () => createInventoryMovement(normalizedApiBaseUrl, selected.id, input.movement!),
                          'Movimentação registrada.',
                        );
                      }}
                    />
                  ) : null}
                  <Text style={styles.subheading}>Lotes</Text>
                  {lots.length === 0 ? <Text style={styles.muted}>Nenhum lote registrado.</Text> : lots.map((lot) => (
                    <View key={lot.id} style={styles.row}>
                      <View style={styles.grow}>
                        <Text style={styles.rowTitle}>{lot.code || 'Sem código'}</Text>
                        <Text style={styles.muted}>{lot.expiresAt ? `Validade ${new Date(lot.expiresAt).toLocaleDateString('pt-BR')}` : 'Sem validade'}{lot.expired ? ' · Vencido' : ''}</Text>
                      </View>
                      <Text style={styles.rowValue}>{formatQuantity(lot.currentQuantity, selected.ingredient.unit)}</Text>
                    </View>
                  ))}
                  <Text style={styles.subheading}>Movimentações</Text>
                  {movements.length === 0 ? <Text style={styles.muted}>Nenhuma movimentação registrada.</Text> : movements.slice(0, 20).map((movement) => (
                    <View key={movement.id} style={styles.row}>
                      <View style={styles.grow}>
                        <Text style={styles.rowTitle}>{movement.reason}</Text>
                        <Text style={styles.muted}>{movement.type} · {new Date(movement.createdAt).toLocaleString('pt-BR')}</Text>
                      </View>
                      <Text style={[styles.rowValue, movement.quantityDelta < 0 && styles.negative]}>{movement.quantityDelta > 0 ? '+' : ''}{formatQuantity(movement.quantityDelta, selected.ingredient.unit)}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

function IngredientEditor({ busy, initial, onCancel, onSave }: { busy: boolean; initial?: InventoryItem; onCancel: () => void; onSave: (input: { code: string; minimumQuantity: number; name: string; unit: IngredientUnit }) => void }) {
  const [name, setName] = useState(initial?.ingredient.name ?? '');
  const [code, setCode] = useState(initial?.ingredient.code ?? '');
  const [minimum, setMinimum] = useState(String(initial?.minimumQuantity ?? 0));
  const [unit, setUnit] = useState<IngredientUnit>(initial?.ingredient.unit ?? 'UNIT');
  return (
    <View style={styles.editor}>
      <Text style={styles.sectionTitle}>{initial ? 'Editar insumo' : 'Novo insumo'}</Text>
      <LabeledInput accessibilityLabel="Nome do insumo" label="Nome" onChangeText={setName} value={name} />
      <LabeledInput accessibilityLabel="Código do insumo" autoCapitalize="characters" label="Código" onChangeText={setCode} value={code} />
      <LabeledInput accessibilityLabel="Estoque mínimo" keyboardType="number-pad" label="Estoque mínimo" onChangeText={setMinimum} value={minimum} />
      <Text style={styles.fieldLabel}>Unidade de medida</Text>
      <View style={styles.actions}>{(['UNIT', 'GRAM', 'MILLILITER'] as IngredientUnit[]).map((value) => <ActionButton key={value} label={unitLabel(value)} onPress={() => setUnit(value)} secondary={unit !== value} />)}</View>
      <View style={styles.actions}><ActionButton disabled={busy} label="Salvar" onPress={() => onSave({ code, minimumQuantity: Number(minimum), name, unit })} /><ActionButton label="Cancelar" onPress={onCancel} secondary /></View>
    </View>
  );
}

function MovementEditor({ busy, editor, item, onCancel, onSave }: { busy: boolean; editor: Exclude<Editor, 'ingredient' | undefined>; item: InventoryItem; onCancel: () => void; onSave: (input: { entry?: Parameters<typeof createInventoryEntry>[2]; movement?: Parameters<typeof createInventoryMovement>[2] }) => void }) {
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [code, setCode] = useState('');
  const [costCents, setCostCents] = useState(0);
  const [expiresAt, setExpiresAt] = useState('');
  const [requestId] = useState(
    () => `inventory-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  const isEntry = editor === 'entry';
  const numericQuantity = Number(quantity.replace(',', '.'));
  const parsedExpiresAt = parseBrazilianDate(expiresAt);
  const invalidExpiresAt = isEntry && expiresAt.length > 0 && parsedExpiresAt === undefined;
  return (
    <View style={styles.editor}>
      <Text style={styles.sectionTitle}>{editorLabel(editor)}</Text>
      <LabeledInput accessibilityLabel="Quantidade" keyboardType="decimal-pad" label="Quantidade" onChangeText={setQuantity} value={quantity} />
      <LabeledInput accessibilityLabel="Motivo" label="Motivo" onChangeText={setReason} value={reason} />
      {isEntry ? (
        <>
          <LabeledInput accessibilityLabel="Código do lote" label="Código do lote (opcional)" onChangeText={setCode} value={code} />
          <LabeledInput
            accessibilityLabel="Validade do lote"
            keyboardType="number-pad"
            label="Validade (DD/MM/AAAA, opcional)"
            maxLength={10}
            onChangeText={(value) => setExpiresAt(formatBrazilianDateInput(value))}
            value={expiresAt}
          />
          {expiresAt.length === 10 && invalidExpiresAt ? (
            <Text style={styles.fieldError}>Informe uma data válida no formato DD/MM/AAAA.</Text>
          ) : null}
          <LabeledInput accessibilityLabel="Custo total em reais" keyboardType="number-pad" label="Custo total (R$)" onChangeText={(value) => setCostCents(centsFromBrlInput(value))} value={formatCentsForBrlInput(costCents)} />
        </>
      ) : null}
      <View style={styles.actions}>
        <ActionButton disabled={busy || invalidExpiresAt} label="Confirmar" onPress={() => {
          if (invalidExpiresAt) return;
          onSave(isEntry ? { entry: { code: code.trim() || null, expiresAt: parsedExpiresAt ?? null, quantity, reason, receivedAt: new Date().toISOString(), requestId, totalCostCents: costCents, unit: item.ingredient.unit } } : { movement: { quantityDelta: editor === 'adjustment' ? numericQuantity : -Math.abs(numericQuantity), reason, requestId, type: editor === 'adjustment' ? 'ADJUSTMENT' : editor === 'loss' ? 'LOSS' : 'EXIT' } });
        }} />
        <ActionButton label="Cancelar" onPress={onCancel} secondary />
      </View>
    </View>
  );
}

function LabeledInput({ label, ...inputProps }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput {...inputProps} style={styles.input} />
    </View>
  );
}

function ActionButton({ disabled, label, onPress, secondary }: { disabled?: boolean; label: string; onPress: () => void; secondary?: boolean }) { return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, (pressed || disabled) && styles.pressed]}><Text style={[styles.buttonText, secondary && styles.buttonSecondaryText]}>{label}</Text></Pressable>; }
function Summary({ label, value }: { label: string; value: string }) { return <View style={styles.summary}><Text style={styles.muted}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>; }
function Badge({ danger, label }: { danger?: boolean; label: string }) { return <Text style={[styles.badge, danger && styles.badgeDanger]}>{label}</Text>; }
function unitLabel(unit: IngredientUnit) { return unit === 'GRAM' ? 'g' : unit === 'MILLILITER' ? 'ml' : 'un'; }
function formatQuantity(quantity: number, unit: IngredientUnit) { return `${quantity.toLocaleString('pt-BR')} ${unitLabel(unit)}`; }
function editorLabel(editor: Exclude<Editor, 'ingredient' | undefined>) { return editor === 'entry' ? 'Registrar entrada' : editor === 'exit' ? 'Registrar retirada' : editor === 'loss' ? 'Registrar perda' : 'Ajustar saldo'; }

function formatBrazilianDateInput(value: string) {
  const digits = value.replace(/\D/gu, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseBrazilianDate(value: string) {
  if (!value) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/u.exec(value);
  if (!match) return undefined;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  if (year < 1000) return undefined;
  const date = new Date(`${yearText}-${monthText}-${dayText}T12:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCDate() !== day ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCFullYear() !== year
  ) {
    return undefined;
  }
  return date.toISOString();
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { backgroundColor: themeColors.statusFreeSurface, borderRadius: 999, color: themeColors.statusFreeText, fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 5 },
  badgeDanger: { backgroundColor: themeColors.dangerSurface, color: themeColors.dangerText },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  balance: { color: themeColors.primary, fontSize: 20, fontWeight: '800' },
  button: { backgroundColor: themeColors.primary, borderColor: themeColors.foregroundOnPrimary, borderRadius: 12, borderWidth: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: 15 },
  buttonSecondary: { backgroundColor: themeColors.surfaceAccent, borderColor: themeColors.primary },
  buttonSecondaryText: { color: themeColors.primary },
  buttonText: { color: themeColors.foregroundOnPrimary, fontWeight: '800', textAlign: 'center' },
  card: { backgroundColor: themeColors.surface, borderColor: themeColors.border, borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 },
  cardHeading: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  cardTitle: { color: themeColors.foreground, fontSize: 17, fontWeight: '800' },
  content: { alignSelf: 'center', flexGrow: 1, gap: 18, maxWidth: 900, padding: 22, width: '100%' },
  details: { backgroundColor: themeColors.surfaceMuted, borderRadius: 18, gap: 14, padding: 16 },
  editor: { backgroundColor: themeColors.surfaceAccent, borderRadius: 16, gap: 10, padding: 16 },
  error: { backgroundColor: themeColors.dangerSurface, borderRadius: 12, color: themeColors.dangerText, padding: 12 },
  field: { gap: 6 },
  fieldError: { color: themeColors.dangerText, fontSize: 13, fontWeight: '700' },
  fieldLabel: { color: themeColors.foreground, fontSize: 13, fontWeight: '700', marginLeft: 2 },
  grow: { flex: 1 },
  input: { backgroundColor: themeColors.surface, borderColor: themeColors.border, borderRadius: 12, borderWidth: 1, color: themeColors.foreground, minHeight: 48, paddingHorizontal: 14 },
  list: { gap: 10 },
  message: { color: themeColors.foregroundOnPrimary, fontWeight: '700' },
  modalBackdrop: { alignItems: 'center', backgroundColor: 'rgba(30, 22, 16, 0.48)', flex: 1, justifyContent: 'center', padding: 18 },
  modalContent: { flexGrow: 1 },
  modalHeading: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  modalMessage: { color: themeColors.primary, fontWeight: '700' },
  modalSheet: { backgroundColor: themeColors.background, borderColor: themeColors.borderStrong, borderRadius: 18, borderWidth: 1, maxHeight: '90%', maxWidth: 560, overflow: 'hidden', width: '100%' },
  muted: { color: themeColors.foregroundMuted, fontSize: 13, lineHeight: 18 },
  negative: { color: themeColors.dangerText },
  pressed: { opacity: 0.65 },
  row: { alignItems: 'center', borderTopColor: themeColors.divider, borderTopWidth: 1, flexDirection: 'row', gap: 12, paddingVertical: 11 },
  rowTitle: { color: themeColors.foreground, fontSize: 14, fontWeight: '700' },
  rowValue: { color: themeColors.primary, fontWeight: '800' },
  safeArea: { backgroundColor: themeColors.primary, flex: 1 },
  sectionTitle: { color: themeColors.primary, fontSize: 21, fontWeight: '800' },
  subheading: { color: themeColors.foreground, fontSize: 16, fontWeight: '800', marginTop: 6 },
  summary: { backgroundColor: themeColors.surfaceAccent, borderRadius: 14, flex: 1, minWidth: 110, padding: 14 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryValue: { color: themeColors.primary, fontSize: 24, fontWeight: '800' },
  toolbar: { gap: 10 },
});
