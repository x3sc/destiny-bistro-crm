import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandedScreenHeader } from './branded-screen-header';
import { CreditButton } from './credit-screen-parts';
import { OperationalText as Text } from '../theme/operational-typography';
import { themeColors as colors } from '../theme/tokens';
import { normalizeApiBaseUrl } from '../services/api-base-url';
import { deleteRole, loadRoles, permissionGroupNames, RoleApiError, saveRole, setPermission,
  type AccessRole, type RolesData } from '../services/roles-api';
import { useNavigationGuard, useSafeBack } from '../navigation/safe-navigation';

interface CommonProps { apiBaseUrl?: string; canManage: boolean; loadRequest?: typeof loadRoles; onBack: () => void }
type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; data: RolesData };
const failureMessage = (error: unknown) => error instanceof RoleApiError && error.status === 409 ?
  'Os dados mudaram ou o cargo está em uso. Recarregue antes de continuar.' : error instanceof RoleApiError && error.status === 403 ?
    'Você não tem permissão para esta alteração.' : 'Não foi possível confirmar a alteração. Verifique a conexão e recarregue os cargos.';
function useRoles(base: string | undefined, allowed: boolean, request: typeof loadRoles) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const generation = useRef(0);
  const reload = useCallback(() => {
    const version = ++generation.current;
    setState({ kind: 'loading' });
    if (!base || !allowed) { setState({ kind: 'error' }); return; }
    void request(base).then((data) => { if (generation.current === version) setState({ kind: 'ready', data }); },
      () => { if (generation.current === version) setState({ kind: 'error' }); });
  }, [base, allowed, request]);
  useFocusEffect(useCallback(() => { reload(); return () => { generation.current += 1; }; }, [reload]));
  return { state, reload };
}
function LoadStatus({ state, reload }: { state: State; reload: () => void }) {
  return state.kind === 'loading' ? <ActivityIndicator accessibilityLabel="Carregando cargos" color={colors.primary} /> :
    state.kind === 'error' ? <View style={styles.card}><Text accessibilityRole="alert">Não foi possível carregar os cargos.</Text>
      <CreditButton label="Recarregar cargos" onPress={reload} /></View> : null;
}
function ReviewModal({ title, children, busy, onClose, onConfirm, label }: { title: string; children: React.ReactNode; busy: boolean;
  onClose: () => void; onConfirm: () => void; label: string }) {
  const back = useSafeBack(onClose);
  return <Modal transparent visible animationType="none" onRequestClose={back}>
    <View style={styles.backdrop}><View style={styles.sheet} accessibilityViewIsModal>
      <ScrollView contentContainerStyle={styles.review}><Text fontRole="heading" style={styles.heading}>{title}</Text>{children}
        <CreditButton label={busy ? 'Salvando...' : label} disabled={busy} onPress={onConfirm} />
        <CreditButton label="Continuar editando" disabled={busy} tone="secondary" onPress={onClose} />
      </ScrollView>
    </View></View>
  </Modal>;
}
export function RoleListScreen({ apiBaseUrl = process.env.EXPO_PUBLIC_API_URL, canManage, loadRequest = loadRoles, onBack,
  onCreate, onEdit, deleteRequest = deleteRole }: CommonProps & { onCreate: () => void; onEdit: (roleId: string) => void; deleteRequest?: typeof deleteRole }) {
  const base = normalizeApiBaseUrl(apiBaseUrl) ?? undefined;
  const { state, reload } = useRoles(base, canManage, loadRequest);
  const [selected, setSelected] = useState<AccessRole | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  useNavigationGuard({ busy, closeModal: selected ? () => setSelected(null) : undefined });
  const remove = async () => {
    if (!selected || !base || lock.current || !canManage) return;
    lock.current = true; setBusy(true); setError('');
    try { await deleteRequest(base, selected); setSelected(null); reload(); }
    catch (failure) { setSelected(null); setError(failureMessage(failure)); reload(); }
    finally { lock.current = false; setBusy(false); }
  };
  return <SafeAreaView style={styles.screen}><BrandedScreenHeader title="Cargos" description="Defina os acessos de cada grupo de pessoas" onBack={onBack} />
    <ScrollView contentContainerStyle={styles.content}>
      {!canManage ? <Text>Sem permissão para gerenciar cargos.</Text> : <>
        <Text style={styles.muted}>As mudanças valem para todos os usuários do cargo, somente neste estabelecimento.</Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <LoadStatus state={state} reload={reload} />
        {state.kind === 'ready' && <>
          <CreditButton label="Novo cargo" onPress={onCreate} />
          {!state.data.roles.length && <Text>Nenhum cargo cadastrado.</Text>}
          {state.data.roles.map((role) => <View style={styles.card} key={role.id}>
            <View style={styles.row}><Text fontRole="heading" style={styles.heading}>{role.name}</Text>
              <Text style={styles.tag}>{role.protected ? 'Protegido' : role.permissions.some((p) => ['roles.manage', 'users.manage'].includes(p)) ? 'Administrativo' : 'Operacional'}</Text></View>
            {role.description ? <Text style={styles.muted}>{role.description}</Text> : null}
            <Text>{role.userCount} {role.userCount === 1 ? 'usuário vinculado' : 'usuários vinculados'}</Text>
            {role.canEdit ? <View style={styles.row}>
              <View style={styles.flex}><CreditButton label={`Editar ${role.name}`} onPress={() => onEdit(role.id)} /></View>
              <View style={styles.flex}><CreditButton label={`Excluir ${role.name}`} tone="secondary" disabled={!role.canDelete || busy}
                onPress={() => { setError(''); setSelected(role); }} /></View>
            </View> : <Text style={styles.muted}>{role.protected ? 'O cargo Dono tem acesso integral e não pode ser alterado.' : 'Alteração fora do seu alcance administrativo.'}</Text>}
            {!role.protected && role.userCount > 0 && <Text style={styles.muted}>Transfira os usuários para outro cargo antes de excluir.</Text>}
          </View>)}
        </>}
      </>}
    </ScrollView>
    {selected && <ReviewModal title="Excluir cargo?" busy={busy} onClose={() => setSelected(null)} onConfirm={() => { void remove(); }} label="Confirmar exclusão">
      <Text>{selected.name} será excluído. O histórico de auditoria será preservado.</Text>
    </ReviewModal>}
  </SafeAreaView>;
}
export function RoleEditorScreen({ apiBaseUrl = process.env.EXPO_PUBLIC_API_URL, canManage, loadRequest = loadRoles, onBack,
  roleId, onSaved, saveRequest = saveRole }: CommonProps & { roleId?: string; onSaved: () => void; saveRequest?: typeof saveRole }) {
  const base = normalizeApiBaseUrl(apiBaseUrl) ?? undefined;
  const { state, reload } = useRoles(base, canManage, loadRequest);
  const role = state.kind === 'ready' ? state.data.roles.find((item) => item.id === roleId) : undefined;
  return <SafeAreaView style={styles.screen}>
    {state.kind !== 'ready' ? <><BrandedScreenHeader title={roleId ? 'Editar cargo' : 'Novo cargo'} onBack={onBack} /><LoadStatus state={state} reload={reload} /></> :
      !canManage || (roleId && (!role || !role.canEdit)) ? <><BrandedScreenHeader title="Cargo" onBack={onBack} /><Text style={styles.content}>Sem permissão para editar este cargo.</Text></> :
      <RoleForm key={`${role?.id ?? 'new'}:${role?.version ?? 0}`} role={role} data={state.data} base={base} saveRequest={saveRequest} onSaved={onSaved} onBack={onBack} reload={reload} />}
  </SafeAreaView>;
}
function RoleForm({ role, data, base, saveRequest, onSaved, onBack, reload }: { role?: AccessRole; data: RolesData; base?: string;
  saveRequest: typeof saveRole; onSaved: () => void; onBack: () => void; reload: () => void }) {
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [permissions, setPermissions] = useState(role?.permissions ?? []);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [dependencyNotice, setDependencyNotice] = useState('');
  const lock = useRef(false);
  const dirty = name !== (role?.name ?? '') || description !== (role?.description ?? '') || JSON.stringify([...permissions].sort()) !== JSON.stringify([...(role?.permissions ?? [])].sort());
  useNavigationGuard({ busy, dirty, closeModal: review ? () => setReview(false) : undefined });
  const save = async () => {
    if (!base || lock.current || conflict || name.trim().length < 2) return;
    lock.current = true; setBusy(true); setError('');
    try { await saveRequest(base, { name, description, permissions }, role); setReview(false); onSaved(); }
    catch (failure) { setReview(false); setError(failureMessage(failure)); setConflict(true); }
    finally { lock.current = false; setBusy(false); }
  };
  const added = permissions.filter((code) => !role?.permissions.includes(code));
  const removed = (role?.permissions ?? []).filter((code) => !permissions.includes(code));
  const label = (code: string) => data.permissions.find((permission) => permission.code === code)?.name ?? code;
  const groups = [...new Set(data.permissions.map((permission) => permission.group))];
  return <><BrandedScreenHeader title={role ? 'Editar cargo' : 'Novo cargo'} onBack={onBack} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.card}><Text fontRole="heading" style={styles.heading}>Identificação</Text>
        <Text>Nome do cargo</Text><TextInput accessibilityLabel="Nome do cargo" value={name} onChangeText={setName} maxLength={80} editable={!busy && !conflict} style={styles.input} />
        <Text>Descrição opcional</Text><TextInput accessibilityLabel="Descrição do cargo" value={description} onChangeText={setDescription} maxLength={255} editable={!busy && !conflict} multiline style={styles.input} />
      </View>
      <Text style={styles.muted}>Marque apenas os acessos necessários. Operar exige as permissões de leitura correspondentes.</Text>
      {dependencyNotice ? <Text accessibilityRole="alert" style={styles.muted}>{dependencyNotice}</Text> : null}
      {groups.map((group) => <View style={styles.card} key={group}><Text fontRole="heading" style={styles.heading}>{permissionGroupNames[group] ?? group}</Text>
        {['kitchen', 'statements'].includes(group) && <Text style={styles.muted}>Permite consultar informações agregadas dos fluxos atendidos.</Text>}
        {group === 'inventory' && <Text style={styles.muted}>Alterar estoque também integra a autorização para cancelar itens confirmados.</Text>}
        {data.permissions.filter((permission) => permission.group === group).map((permission) => <Pressable key={permission.code}
          accessibilityRole="checkbox" accessibilityLabel={permission.name} accessibilityState={{ checked: permissions.includes(permission.code), disabled: busy || conflict || permission.ownerOnly }}
          aria-checked={permissions.includes(permission.code)} aria-disabled={busy || conflict || permission.ownerOnly}
          disabled={busy || conflict || permission.ownerOnly} style={[styles.permission, permission.ownerOnly && styles.disabled]}
          onPress={() => {
            const next = setPermission(permissions, permission.code, !permissions.includes(permission.code), data.permissions);
            const changes = [...permissions.filter((p) => !next.includes(p)), ...next.filter((p) => !permissions.includes(p))].filter((p) => p !== permission.code);
            setDependencyNotice(changes.length ? `Dependências ajustadas: ${changes.map(label).join(', ')}.` : ''); setPermissions(next);
          }}>
          <Text style={styles.check}>{permissions.includes(permission.code) ? '✓' : '○'}</Text><View style={styles.flex}><Text>{permission.name}</Text>
            {permission.ownerOnly && <Text style={styles.muted}>Reservado ao dono ou fora do seu alcance.</Text>}</View>
        </Pressable>)}
      </View>)}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {conflict ? <CreditButton label="Recarregar cargos" onPress={reload} /> : <CreditButton label="Revisar alterações" disabled={busy || !base || !dirty || name.trim().length < 2} onPress={() => setReview(true)} />}
    </ScrollView>
    {review && <ReviewModal title="Revisar acessos do cargo" busy={busy} label="Confirmar e salvar cargo" onClose={() => setReview(false)} onConfirm={() => { void save(); }}>
      <Text fontRole="heading" style={styles.heading}>{name.trim()}</Text>
      <Text>Esta alteração afeta {role?.userCount ?? 0} usuários.</Text>
      <Text>Adicionar: {added.length ? added.map(label).join(', ') : 'nenhuma permissão'}.</Text>
      <Text>Remover: {removed.length ? removed.map(label).join(', ') : 'nenhuma permissão'}.</Text>
      {!permissions.length && <Text style={styles.error}>Este cargo ficará sem acesso operacional.</Text>}
    </ReviewModal>}
  </>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { width: '100%', maxWidth: 800, alignSelf: 'center', padding: 20, gap: 16, paddingBottom: 40 },
  card: { borderWidth: 1, borderColor: colors.divider, borderRadius: 16, padding: 16, gap: 12, backgroundColor: colors.background },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' }, flex: { flex: 1 }, heading: { color: colors.primary, fontSize: 20, fontWeight: '800', flexShrink: 1 },
  muted: { color: colors.foregroundMuted, fontSize: 14, lineHeight: 21 }, tag: { color: colors.primary, fontSize: 12, backgroundColor: colors.surfaceAccent, borderRadius: 12, padding: 8 },
  error: { color: colors.dangerText, lineHeight: 21 }, input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, minHeight: 48, padding: 12, color: colors.foreground, fontSize: 16 },
  permission: { flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 48, paddingVertical: 10 }, check: { fontSize: 23, color: colors.primary }, disabled: { opacity: 0.55 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 }, sheet: { maxWidth: 640, width: '100%', maxHeight: '90%', backgroundColor: colors.background, borderRadius: 16 },
  review: { padding: 20, gap: 16 },
});
