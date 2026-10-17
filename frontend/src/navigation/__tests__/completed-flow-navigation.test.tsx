import { Button, Text } from 'react-native';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen, testRouter } from 'expo-router/testing-library';

import { type CompletedFlowDestination, useCompletedFlowNavigation } from '../use-completed-flow-navigation';

let destination: CompletedFlowDestination;

function CompletedFlow() {
  const finish = useCompletedFlowNavigation();
  return <Button title="Concluir fluxo" onPress={() => finish(destination)} />;
}

const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  index: () => <Text>Início</Text>,
  'tables/index': () => <Text>Mesas</Text>,
  'quick-sales': () => <Text>Venda rápida</Text>,
  'counter-sales/index': () => <Text>Balcão</Text>,
  'comandas/[comandaId]': () => <Text>Comanda antiga</Text>,
  'comandas/[comandaId]/checkout': CompletedFlow,
  'deliveries/index': () => <Text>Delivery</Text>,
  'deliveries/orders/[orderId]/index': () => <Text>Pedido</Text>,
  'credits/_layout': () => <Stack screenOptions={{ headerShown: false }} />,
  'credits/index': () => <Text>Fiados</Text>,
  'credits/[customerId]': () => <Text>Cliente</Text>,
  'credits/[customerId]/orders/[orderId]/payment': CompletedFlow,
};

it.each(['tables', 'quick-sales', 'counter-sales'] as const)('clears completed comandas and returns from %s to home', (kind) => {
  destination = { kind: kind === 'counter-sales' ? 'counter' : kind };
  const view = renderRouter(routes, { initialUrl: '/' });
  testRouter.push(`/${kind}`);
  testRouter.push('/comandas/closed');
  testRouter.push('/comandas/closed/checkout');
  fireEvent.press(screen.getByRole('button', { name: 'Concluir fluxo' }));
  expect(view.getPathname()).toBe(`/${kind}`);
  testRouter.back('/');
  expect(testRouter.canGoBack()).toBe(false);
});

it('clears a completed deep link even when home was not in the stack', () => {
  destination = { kind: 'tables' };
  const view = renderRouter(routes, { initialUrl: '/comandas/closed/checkout' });
  fireEvent.press(screen.getByRole('button', { name: 'Concluir fluxo' }));
  expect(view.getPathname()).toBe('/tables');
  testRouter.back('/');
});

it('clears nested credit payment history and preserves customer, credits and home', () => {
  destination = { kind: 'credit', customerId: 'person' };
  const view = renderRouter(routes, { initialUrl: '/' });
  testRouter.push('/credits');
  testRouter.push('/credits/person');
  testRouter.push('/credits/person/orders/paid/payment');
  fireEvent.press(screen.getByRole('button', { name: 'Concluir fluxo' }));
  expect(view.getPathname()).toBe('/credits/person');
  testRouter.back('/credits');
  testRouter.back('/');
  expect(testRouter.canGoBack()).toBe(false);
});

it('keeps delivery details followed by the list, without returning to the completed checkout', () => {
  destination = { kind: 'delivery', orderId: 'paid' };
  const view = renderRouter(routes, { initialUrl: '/comandas/closed/checkout' });
  fireEvent.press(screen.getByRole('button', { name: 'Concluir fluxo' }));
  expect(view.getPathname()).toBe('/deliveries/orders/paid');
  testRouter.back('/deliveries');
  testRouter.back('/');
});
