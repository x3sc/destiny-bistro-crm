import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, BackHandler, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';

import { normalizeApiBaseUrl } from '../services/api-base-url';
import {
  createUser, isUserRoleCode, loadUsers, UserApiError,
  type AdminUser, type AdminUsers, type CreateUserInput, type UserRole,
} from '../services/users-api';
import { themeColors as colors, themeRadii, themeSpacing, themeTypography } from '../theme/tokens';
import { BrandedScreenHeader } from './branded-screen-header';

type ListState = { kind: 'loading' } | { kind: 'error'; forbidden: boolean } | { kind: 'ready'; data: AdminUsers };

export function UserManagementScreen({
  apiBaseUrl = process.env.EXPO_PUBLIC_API_URL, canManageUsers, bottomNavigation,
  loadRequest = loadUsers, createRequest = createUser, onBack,
}: {
  apiBaseUrl?: string; canManageUsers: boolean; bottomNavigation?: ReactNode;
  loadRequest?: typeof loadUsers; createRequest?: typeof createUser; onBack: () => void;
}) {
  const [state, setState] = useState<ListState>({ kind: 'loading' });
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState(false);
  const baseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const generation = useRef(0);
  const refresh = useCallback(() => {
    if (!canManageUsers) return Promise.resolve();
    const current = ++generation.current;
    const request = baseUrl ? loadRequest(baseUrl) : Promise.reject(new UserApiError(503));
    return request.then(
      (data) => {
        if (current === generation.current) setState({ kind: 'ready', data });
      },
      (error: unknown) => {
        if (current === generation.current) setState({ kind: 'error', forbidden: error instanceof UserApiError && error.status === 403 });
      },
    );
  }, [baseUrl, canManageUsers, loadRequest]);

  useEffect(() => {
    void refresh();
    return () => { generation.current += 1; };
  }, [refresh]);

  if (!canManageUsers || (state.kind === 'error' && state.forbidden)) {
    return <SafeAreaView style={styles.screen}>
      <BrandedScreenHeader title="Usuários" onBack={onBack} />
      <View style={styles.center}><Text style={styles.body}>Acesso exclusivo do dono.</Text></View>
    </SafeAreaView>;
  }
  if (creating && state.kind === 'ready' && baseUrl) {
    return <UserForm
      apiBaseUrl={baseUrl} roles={state.data.roles} createRequest={createRequest}
      onCancel={() => setCreating(false)}
      onCreated={(user) => {
        setState({ kind: 'ready', data: {
          ...state.data,
          users: [...state.data.users.filter(({ id }) => id !== user.id), user]
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        } });
        setSuccess(true); setCreating(false);
      }}
    />;
  }
  return <SafeAreaView style={styles.screen}>
    <BrandedScreenHeader title="Usuários" description="Pessoas com acesso ao estabelecimento" onBack={onBack} />
    <ScrollView style={styles.canvas} contentContainerStyle={styles.listContent}>
      {state.kind === 'loading' && <ActivityIndicator accessibilityLabel="Carregando usuários" color={colors.primary} />}
      {state.kind === 'error' && <View style={styles.card}>
        <Text accessibilityRole="alert" style={styles.body}>Não foi possível carregar os usuários.</Text>
        <Action label="Tentar novamente" onPress={() => { setState({ kind: 'loading' }); void refresh(); }} secondary />
      </View>}
      {state.kind === 'ready' && <>
        {success && <View accessibilityRole="alert" style={styles.success}>
          <FontAwesome6 name="circle-check" color={colors.statusFreeText} size={20} />
          <View style={styles.flex}>
            <Text style={styles.successTitle}>Usuário criado com sucesso.</Text>
            <Text style={styles.successText}>O acesso com nome e senha já está disponível.</Text>
          </View>
        </View>}
        {state.data.users.length === 0 && <Text style={styles.body}>Nenhum usuário cadastrado.</Text>}
        {state.data.users.map((user) => <UserCard key={user.id} user={user} />)}
      </>}
    </ScrollView>
    {state.kind === 'ready' && <View style={styles.actions}>
      <Action label="Novo usuário" onPress={() => { setSuccess(false); setCreating(true); }} icon="plus" />
    </View>}
    {bottomNavigation}
  </SafeAreaView>;
}

function UserCard({ user }: { user: AdminUser }) {
  return <View style={styles.userCard}>
    <View style={styles.avatar}><FontAwesome6 name="user" color={colors.foregroundMuted} size={18} /></View>
    <View style={styles.flex}>
      <Text style={styles.userName}>{user.name}</Text>
      <View style={styles.badges}>{user.roles.map((role) => <Text key={role.id} style={[styles.roleBadge, role.code === 'OWNER' && styles.ownerBadge]}>{role.name}</Text>)}</View>
    </View>
    <View style={[styles.status, !user.active && styles.inactive]}>
      <FontAwesome6 name={user.active ? 'circle-check' : 'circle-pause'} size={12} color={user.active ? colors.statusFreeText : colors.foregroundMuted} />
      <Text style={[styles.statusText, !user.active && styles.inactiveText]}>{user.active ? 'Ativo' : 'Inativo'}</Text>
    </View>
  </View>;
}

type FormErrors = Partial<Record<'name' | 'password' | 'confirmation' | 'role' | 'request', string>>;
function UserForm({ apiBaseUrl, roles, createRequest, onCancel, onCreated }: {
  apiBaseUrl: string; roles: UserRole[]; createRequest: typeof createUser;
  onCancel: () => void; onCreated: (user: AdminUser) => void;
}) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!inFlight.current) onCancel();
      return true;
    });
    return () => { mounted.current = false; back.remove(); };
  }, [onCancel]);
  const submit = async () => {
    if (inFlight.current) return;
    const normalizedName = name.trim().replace(/\s+/gu, ' ');
    const next: FormErrors = {};
    if (normalizedName.length < 2 || normalizedName.length > 80) next.name = 'Use um nome de acesso de 2 a 80 caracteres.';
    if (password.length < 8 || password.length > 128) next.password = 'Use uma senha de 8 a 128 caracteres.';
    if (confirmation !== password) next.confirmation = 'As senhas não coincidem.';
    if (!isUserRoleCode(roleCode) || !roles.some((role) => role.code === roleCode)) next.role = 'Selecione um perfil.';
    setErrors(next);
    if (Object.keys(next).length || !isUserRoleCode(roleCode)) return;
    inFlight.current = true; setSaving(true);
    try {
      const input: CreateUserInput = { name: normalizedName, password, roleCode };
      const user = await createRequest(apiBaseUrl, input);
      if (mounted.current) {
        setPassword(''); setConfirmation('');
        onCreated(user);
      }
    } catch (error) {
      if (!mounted.current) return;
      if (error instanceof UserApiError && error.status === 409) setErrors({ name: 'Este nome de acesso já está em uso.' });
      else if (error instanceof UserApiError && error.status === 403) setErrors({ request: 'Acesso exclusivo do dono.' });
      else if (error instanceof UserApiError && error.status === 400) setErrors({ request: 'Confira o nome, a senha e o perfil informado.' });
      else setErrors({ request: 'Não foi possível confirmar o cadastro. Verifique a conexão e consulte a lista antes de tentar novamente.' });
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  const cancel = () => { if (!inFlight.current) onCancel(); };
  return <SafeAreaView style={styles.screen}>
    <BrandedScreenHeader title="Novo usuário" onBack={cancel} />
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.canvas} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Field label="Nome de acesso" value={name} onChangeText={setName} editable={!saving} error={errors.name} helper="Use este nome para entrar no sistema." />
          <Field label="Senha" value={password} onChangeText={setPassword} editable={!saving} password error={errors.password} helper="Use de 8 a 128 caracteres." />
          <Field label="Confirmar senha" value={confirmation} onChangeText={setConfirmation} editable={!saving} password error={errors.confirmation} />
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Perfil</Text>
          {roles.filter((role) => isUserRoleCode(role.code)).map((role) => <Pressable key={role.id} accessibilityRole="radio" accessibilityLabel={role.name}
            accessibilityState={{ checked: roleCode === role.code, disabled: saving }} disabled={saving}
            onPress={() => setRoleCode(role.code)} style={[styles.radioRow, roleCode === role.code && styles.selectedRow]}>
            <View style={[styles.radio, roleCode === role.code && styles.selectedRadio]}>{roleCode === role.code && <View style={styles.radioDot} />}</View>
            <Text style={styles.body}>{role.name}</Text>
          </Pressable>)}
          <ErrorText message={errors.role} />
        </View>
        <ErrorText message={errors.request} />
      </ScrollView>
      <View style={styles.actions}>
        <Action label={saving ? 'Criando usuário…' : 'Criar usuário'} onPress={() => { void submit(); }} disabled={saving} />
        <Action label="Cancelar" onPress={cancel} disabled={saving} secondary />
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function Field({ label, value, onChangeText, editable, password, error, helper }: {
  label: string; value: string; onChangeText: (value: string) => void; editable: boolean;
  password?: boolean; error?: string; helper?: string;
}) {
  const [visible, setVisible] = useState(false);
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.inputRow, error && styles.inputError]}>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} editable={editable}
        secureTextEntry={Boolean(password && !visible)} autoCapitalize="none" autoCorrect={false}
        style={styles.input} placeholder={password ? undefined : 'Ex.: joao.silva'}
        placeholderTextColor={colors.placeholder} />
      {password && <Pressable accessibilityRole="button" accessibilityLabel={(visible ? 'Ocultar ' : 'Mostrar ') + (label === 'Senha' ? 'senha' : 'confirmação de senha')}
        disabled={!editable} onPress={() => setVisible((current) => !current)} style={styles.eye}>
        <FontAwesome6 name={visible ? 'eye-slash' : 'eye'} size={18} color={colors.foregroundMuted} />
      </Pressable>}
    </View>
    {helper && !error && <Text style={styles.helper}>{helper}</Text>}
    <ErrorText message={error} />
  </View>;
}
function ErrorText({ message }: { message?: string }) {
  return message ? <View accessibilityRole="alert" style={styles.errorRow}>
    <FontAwesome6 name="circle-exclamation" size={14} color={colors.dangerText} />
    <Text style={styles.errorText}>{message}</Text>
  </View> : null;
}
function Action({ label, onPress, secondary, disabled, icon }: {
  label: string; onPress: () => void; secondary?: boolean; disabled?: boolean; icon?: 'plus';
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: Boolean(disabled) }}
    disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.secondaryButton, (pressed || disabled) && styles.dimmed]}>
    {icon && <FontAwesome6 name={icon} size={18} color={colors.foregroundOnPrimary} />}
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.primary },
  canvas: { flex: 1, backgroundColor: '#fcf9f8' },
  flex: { flex: 1 },
  listContent: { padding: themeSpacing.mobileMargin, gap: 12, maxWidth: 760, width: '100%', alignSelf: 'center', flexGrow: 1 },
  formContent: { padding: themeSpacing.mobileMargin, gap: 24, maxWidth: 760, width: '100%', alignSelf: 'center' },
  center: { flex: 1, backgroundColor: '#fcf9f8', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, borderRadius: themeRadii.standard, padding: 16, gap: 16 },
  body: { ...themeTypography.body, color: colors.foreground },
  sectionTitle: { ...themeTypography.sectionTitle, color: colors.foreground },
  label: { ...themeTypography.label, color: colors.foreground },
  field: { gap: 6 },
  helper: { ...themeTypography.auxiliary, color: colors.foregroundSoft },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 22, minHeight: 48, backgroundColor: colors.surface },
  input: { ...themeTypography.body, color: colors.foreground, flex: 1, minWidth: 0, minHeight: 46, paddingHorizontal: 16, paddingVertical: 10 },
  inputError: { borderColor: colors.dangerSolid },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  actions: { backgroundColor: colors.surface, padding: 20, gap: 12, borderTopWidth: 1, borderTopColor: colors.divider },
  button: { minHeight: 48, borderRadius: 22, backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { ...themeTypography.label, color: colors.foregroundOnPrimary },
  secondaryButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
  secondaryText: { color: colors.primary },
  dimmed: { opacity: 0.65 },
  radioRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', padding: 8, gap: 12, borderRadius: 12 },
  selectedRow: { backgroundColor: colors.surfaceMuted },
  radio: { height: 22, width: 22, borderRadius: 11, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  selectedRadio: { borderColor: colors.primary },
  radioDot: { height: 12, width: 12, borderRadius: 6, backgroundColor: colors.primary },
  errorRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  errorText: { ...themeTypography.auxiliary, color: colors.dangerText, flex: 1 },
  userCard: { minHeight: 76, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  userName: { ...themeTypography.label, color: colors.foreground },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  roleBadge: { ...themeTypography.auxiliary, color: colors.foregroundMuted, backgroundColor: colors.surfaceMuted, paddingHorizontal: 8, paddingVertical: 2, borderRadius: themeRadii.pill },
  ownerBadge: { backgroundColor: colors.accent, color: colors.foreground },
  status: { flexDirection: 'row', gap: 4, alignItems: 'center', borderRadius: themeRadii.pill, backgroundColor: colors.statusFreeSurface, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { ...themeTypography.auxiliary, color: colors.statusFreeText },
  inactive: { backgroundColor: colors.surfaceMuted },
  inactiveText: { color: colors.foregroundMuted },
  success: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 16, borderRadius: 22, borderWidth: 1, borderColor: colors.statusFreeBorder, backgroundColor: colors.statusFreeSurface },
  successTitle: { ...themeTypography.label, color: colors.statusFreeText },
  successText: { ...themeTypography.auxiliary, color: colors.statusFreeText, marginTop: 4 },
});
