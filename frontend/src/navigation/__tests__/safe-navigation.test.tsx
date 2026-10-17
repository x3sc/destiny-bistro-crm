import { useState } from 'react';
import { Alert, BackHandler, Button, Platform, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, testRouter } from 'expo-router/testing-library';
import { SafeNavigationProvider, SafeRouteBoundary, useSafeBack, useNavigationGuard, useSafeNavigationCompletion } from '../safe-navigation';

let dirty = false;
let busy = false;
let modal = false;
const discard = jest.fn();
const permissions = (permission: string) => ['comandas.read', 'credits.read', 'quick-sales.read', 'counter-sales.read'].includes(permission);
function Page() {
  const back = useSafeBack();
  const complete = useSafeNavigationCompletion();
  const [writing, setWriting] = useState(busy);
  const [modalOpen, setModalOpen] = useState(modal);
  useNavigationGuard({ dirty, busy: writing, discard, resource: { comandaId: 'one', kind: 'counter' }, closeModal: modalOpen ? () => setModalOpen(false) : undefined });
  return <View><Button title="Voltar seguro" onPress={back} />
    <Button title="Voltar duas vezes" onPress={() => { back(); back(); }} />
    <Button title="Falha na gravação" onPress={() => setWriting(false)} />
    <Button title="Sucesso" onPress={() => complete(() => router.replace('/'))} />
    {modalOpen ? <Button title="Modal aberto" onPress={() => {}} /> : null}</View>;
}
const routes = {
  _layout: () => <SafeNavigationProvider canAccess={permissions}><Stack screenOptions={{ headerShown: false }}
    screenLayout={({ children }) => <SafeRouteBoundary>{children}</SafeRouteBoundary>} /></SafeNavigationProvider>,
  index: Page,
  'quick-sales': Page,
  'tables/index': Page,
  'counter-sales/index': Page,
  'counter-sales/[comandaId]': Page,
  'comandas/[comandaId]/products': Page,
  'comandas/[comandaId]': Page,
  'credits/_layout': () => <Stack screenLayout={({ children }) => <SafeRouteBoundary>{children}</SafeRouteBoundary>} />,
  'credits/index': Page,
  'credits/[customerId]': Page,
};
beforeEach(() => { dirty = false; busy = false; modal = false; jest.clearAllMocks(); });
afterEach(() => jest.restoreAllMocks());
it('returns from a direct list entry to home without dispatching an unhandled GO_BACK', () => {
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  const view = renderRouter(routes, { initialUrl: '/quick-sales' });
  fireEvent.press(screen.getByRole('button', { name: 'Voltar seguro' }));
  expect(view.getPathname()).toBe('/');
  expect(testRouter.canGoBack()).toBe(false);
  expect(errors).not.toHaveBeenCalled();
  errors.mockRestore();
});
it('releases the return lock after reconstructing the parent stack of a direct detail entry', () => {
  const view = renderRouter(routes, { initialUrl: '/counter-sales/one' });
  fireEvent.press(screen.getByRole('button', { name: 'Voltar seguro' }));
  expect(view.getPathname()).toBe('/counter-sales');
  fireEvent.press(screen.getByRole('button', { name: 'Voltar seguro' }));
  expect(view.getPathname()).toBe('/');
});
it('preserves safe nested credit history', () => {
  const view = renderRouter(routes, { initialUrl: '/' });
  testRouter.push('/credits'); testRouter.push('/credits/person');
  fireEvent.press(screen.getByRole('button', { name: 'Voltar seguro' }));
  expect(view.getPathname()).toBe('/credits');
  fireEvent.press(screen.getByRole('button', { name: 'Voltar seguro' }));
  expect(view.getPathname()).toBe('/');
});
it('rejects history destinations without permission', () => {
  const view = renderRouter(routes, { initialUrl: '/tables' });
  testRouter.push('/quick-sales');
  fireEvent.press(screen.getByRole('button', { name: 'Voltar seguro' }));
  expect(view.getPathname()).toBe('/');
});
it('asks before discarding and navigates only after explicit confirmation', () => {
  dirty = true;
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const view = renderRouter(routes, { initialUrl: '/quick-sales' });
  fireEvent.press(screen.getByRole('button', { name: 'Voltar seguro' }));
  expect(view.getPathname()).toBe('/quick-sales');
  expect(discard).not.toHaveBeenCalled();
  const buttons = alert.mock.calls[0][2]!;
  act(() => buttons.find((button) => button.text === 'Descartar e voltar')!.onPress!());
  expect(discard).toHaveBeenCalledTimes(1);
  expect(view.getPathname()).toBe('/');
  alert.mockRestore();
});
it('blocks critical writes and informs the operator', () => {
  busy = true;
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const view = renderRouter(routes, { initialUrl: '/quick-sales' });
  fireEvent.press(screen.getByRole('button', { name: 'Voltar seguro' }));
  expect(view.getPathname()).toBe('/quick-sales');
  expect(alert).toHaveBeenCalledWith('Aguarde a conclusão', expect.any(String));
  fireEvent.press(screen.getByRole('button', { name: 'Falha na gravação' }));
  fireEvent.press(screen.getByRole('button', { name: 'Voltar seguro' }));
  expect(view.getPathname()).toBe('/');
  alert.mockRestore();
});
it.each(['/quick-sales', '/credits/person'])('protects replacement from %s and permits a successful operation to bypass its own guard', (path) => {
  busy = true;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const view = renderRouter(routes, { initialUrl: path });
  act(() => router.replace('/'));
  expect(view.getPathname()).toBe(path);
  fireEvent.press(screen.getByRole('button', { name: 'Sucesso' }));
  expect(view.getPathname()).toBe('/');
});
it('ignores a second return from the screen that just lost focus', () => {
  const view = renderRouter(routes, { initialUrl: '/' });
  testRouter.push('/quick-sales');
  testRouter.push('/comandas/one');
  fireEvent.press(screen.getByRole('button', { name: 'Voltar duas vezes' }));
  expect(view.getPathname()).toBe('/quick-sales');
});
it('closes a modal before leaving the current screen', () => {
  modal = true;
  const view = renderRouter(routes, { initialUrl: '/quick-sales' });
  fireEvent.press(screen.getByRole('button', { name: 'Voltar seguro' }));
  expect(view.getPathname()).toBe('/quick-sales');
  expect(screen.queryByRole('button', { name: 'Modal aberto' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Voltar seguro' }));
  expect(view.getPathname()).toBe('/');
});
it('asks to exit Android only at home and removes listeners when focus changes', () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const subscriptions: { handler: () => boolean | null | undefined; remove: jest.Mock }[] = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, handler) => {
    const remove = jest.fn(); subscriptions.push({ handler: () => handler({ type: 'hardwareBackPress', timeStamp: 0 }), remove }); return { remove };
  });
  const exit = jest.spyOn(BackHandler, 'exitApp').mockImplementation(() => {});
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const view = renderRouter(routes, { initialUrl: '/' });
  const homeSubscription = subscriptions.at(-1)!;
  act(() => { subscriptions.at(-1)!.handler(); });
  expect(alert.mock.calls[0][0]).toBe('Sair do aplicativo?');
  act(() => { alert.mock.calls[0][2]!.find((button) => button.text === 'Permanecer')!.onPress!(); });
  expect(exit).not.toHaveBeenCalled();
  testRouter.push('/quick-sales');
  expect(homeSubscription.remove).toHaveBeenCalled();
  act(() => { subscriptions.at(-1)!.handler(); });
  expect(view.getPathname()).toBe('/');
  act(() => { subscriptions.at(-1)!.handler(); });
  act(() => { alert.mock.calls.at(-1)![2]!.find((button) => button.text === 'Sair')!.onPress!(); });
  expect(exit).toHaveBeenCalledTimes(1);
});
