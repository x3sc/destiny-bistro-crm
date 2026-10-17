import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OperationalText as Text } from '../theme/operational-typography';
import { themeColors as colors } from '../theme/tokens';
import { loadUsers, updateUserRole, UserApiError, type AdminUsers } from '../services/users-api';
import { normalizeApiBaseUrl } from '../services/api-base-url';
import { useNavigationGuard, useSafeBack } from '../navigation/safe-navigation';
import { BrandedScreenHeader } from './branded-screen-header';
import { CreditButton } from './credit-screen-parts';
import { permissionDisplayName } from '../services/roles-api';

export function UserRoleAssignmentScreen({ userId, canManage, apiBaseUrl = process.env.EXPO_PUBLIC_API_URL, loadRequest = loadUsers,
  saveRequest = updateUserRole, onBack, onSaved }: { userId: string; canManage: boolean; apiBaseUrl?: string; loadRequest?: typeof loadUsers;
    saveRequest?: typeof updateUserRole; onBack: () => void; onSaved: () => void }) {
  const base = normalizeApiBaseUrl(apiBaseUrl);
  const [data, setData] = useState<AdminUsers | null>(null);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [review, setReview] = useState(false);
  const lock = useRef(false);
  const user = data?.users.find((item) => item.id === userId);
  const role = data?.roles.find((item) => item.id === selected);
  const dirty = Boolean(user && selected !== user.roles[0]?.id);
  useNavigationGuard({ busy, dirty, closeModal: review ? () => setReview(false) : undefined });
  const modalBack = useSafeBack(() => setReview(false));
  const reload = useCallback(() => {
    let active = true;
    setLoading(true); setError(''); setConflict(false);
    if (!base || !canManage) { setLoading(false); return; }
    void loadRequest(base).then((result) => {
      if (!active) return;
      setData(result); setSelected(result.users.find((item) => item.id === userId)?.roles[0]?.id ?? ''); setLoading(false);
    }, () => { if (active) { setError('Não foi possível carregar os usuários.'); setLoading(false); } });
    return () => { active = false; };
  }, [base, canManage, loadRequest, userId]);
  useFocusEffect(reload);
  const save = async () => {
    if (!base || !user || !role || !user.canReassign || !user.roleVersion || lock.current || conflict || !canManage) return;
    lock.current = true; setBusy(true); setError('');
    try { await saveRequest(base, user.id, role.id, user.roleVersion); setReview(false); onSaved(); }
    catch (failure) {
      setReview(false); setConflict(true);
      setError(failure instanceof UserApiError && failure.status === 409 ? 'O acesso mudou. Recarregue os usuários antes de continuar.' :
        failure instanceof UserApiError && failure.status === 403 ? 'Você não pode atribuir este cargo.' : 'Não foi possível confirmar a troca. Verifique a conexão e recarregue os usuários.');
    } finally { lock.current = false; setBusy(false); }
  };
  return <SafeAreaView style={styles.screen}><BrandedScreenHeader title="Alterar cargo" description={user?.name} onBack={onBack} />
    <ScrollView contentContainerStyle={styles.content}>
      {loading ? <ActivityIndicator accessibilityLabel="Carregando usuário" color={colors.primary} /> :
        !canManage || !user?.canReassign ? <Text>Sem permissão para alterar este usuário.</Text> : <>
          <View style={styles.card}><Text fontRole="heading" style={styles.heading}>Cargo atual: {user.roles[0]?.name}</Text>
            <Text style={styles.muted}>Acessos atuais: {user.permissions?.map(permissionDisplayName).join(', ') || 'nenhum'}.</Text></View>
          <Text style={styles.muted}>Escolha um cargo. Os acessos serão substituídos pelos acessos deste grupo.</Text>
          {data?.roles.map((option) => <Pressable key={option.id} accessibilityRole="radio" accessibilityLabel={option.name}
            aria-checked={option.id === selected} aria-disabled={busy || conflict}
            accessibilityState={{ checked: option.id === selected, disabled: busy || conflict }} disabled={busy || conflict}
            style={[styles.card, option.id === selected && styles.selected]} onPress={() => setSelected(option.id)}>
            <Text fontRole="heading" style={styles.heading}>{option.id === selected ? '✓ ' : ''}{option.name}</Text>
            <Text style={styles.muted}>{option.permissions?.map(permissionDisplayName).join(', ') || 'Sem permissões operacionais'}</Text>
          </Pressable>)}
          {!conflict && <CreditButton label="Revisar troca de cargo" disabled={!dirty || !role || busy || !base} onPress={() => setReview(true)} />}
        </>}
      {error ? <><Text accessibilityRole="alert" style={styles.error}>{error}</Text><CreditButton label="Recarregar usuários" onPress={reload} /></> : null}
    </ScrollView>
    {review && <Modal visible transparent animationType="none" onRequestClose={modalBack}><View style={styles.backdrop}><View accessibilityViewIsModal style={styles.sheet}>
      <Text fontRole="heading" style={styles.heading}>Confirmar troca de cargo?</Text>
      <Text>{user?.name}: {user?.roles[0]?.name} → {role?.name}.</Text>
      <Text>As permissões antigas serão substituídas pelas do novo cargo. A API passa a aplicar a mudança na próxima requisição.</Text>
      <CreditButton label={busy ? 'Salvando...' : 'Confirmar troca de cargo'} disabled={busy} onPress={() => { void save(); }} />
      <CreditButton label="Continuar editando" disabled={busy} tone="secondary" onPress={() => setReview(false)} />
    </View></View></Modal>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 800, alignSelf: 'center', padding: 20, gap: 16 },
  card: { borderColor: colors.divider, borderWidth: 1, borderRadius: 16, padding: 16, gap: 10, minHeight: 48 },
  heading: { fontSize: 19, color: colors.primary, fontWeight: '800' }, muted: { color: colors.foregroundMuted, lineHeight: 21 },
  selected: { borderColor: colors.primary, backgroundColor: colors.surfaceMuted }, error: { color: colors.dangerText },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', padding: 20, justifyContent: 'center', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 640, padding: 20, borderRadius: 16, gap: 16, backgroundColor: colors.background },
});
