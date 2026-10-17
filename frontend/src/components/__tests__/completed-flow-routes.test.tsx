import { fireEvent, render, screen } from '@testing-library/react-native';
import Checkout from '../../app/comandas/[comandaId]/checkout';
import Details from '../../app/comandas/[comandaId]';
import CreditPayment from '../../app/credits/[customerId]/orders/[orderId]/payment';
import DeliveryCheckout from '../../app/deliveries/orders/[orderId]/checkout';
import Catalog from '../../app/comandas/[comandaId]/products';

const mockFinish = jest.fn();
const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true };
let mockParams: Record<string, string>;
let mockCustomerId: string | undefined;

jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));
jest.mock('@/auth/auth-context', () => ({ useAuth: () => ({ user: {} }), hasPermission: () => true }));
jest.mock('@/navigation/use-completed-flow-navigation', () => ({ useCompletedFlowNavigation: () => mockFinish }));
jest.mock('@/components/comanda-checkout-screen', () => {
  const { Button, View } = jest.requireActual('react-native');
  return {
  ComandaCheckoutScreen: ({ onBack, onFinished }: { onBack: () => void; onFinished: (customerId?: string) => void }) =>
    <View><Button title="Concluir" onPress={() => onFinished(mockCustomerId)} /><Button title="Voltar" onPress={onBack} /></View>,
  };
});
jest.mock('@/components/comanda-details-screen', () => {
  const { Button, View } = jest.requireActual('react-native');
  return {
  ComandaDetailsScreen: ({ onAddProducts, onCancelled, onCreditFinished }: { onAddProducts: (id: string) => void; onCancelled: () => void; onCreditFinished: (id: string) => void }) =>
    <View><Button title="Abrir catálogo" onPress={() => onAddProducts('comanda')} /><Button title="Cancelar comanda" onPress={onCancelled} /><Button title="Concluir fiado" onPress={() => onCreditFinished('customer')} /></View>,
  };
});
jest.mock('@/components/credit-payment-screen', () => {
  const { Button } = jest.requireActual('react-native');
  return {
  CreditPaymentScreen: ({ onFinished }: { onFinished: () => void }) => <Button title="Concluir" onPress={onFinished} />,
  };
});
jest.mock('@/components/delivery-order-comanda-loader', () => ({
  DeliveryOrderComandaLoader: ({ children }: { children: (id: string) => React.ReactNode }) => children('comanda'),
}));
jest.mock('@/components/product-catalog-screen', () => {
  const { Button } = jest.requireActual('react-native');
  return { ProductCatalogScreen: ({ onAdded }: { onAdded: (comanda: { id: string }) => void }) =>
    <Button title="Adicionar produtos" onPress={() => onAdded({ id: 'comanda' })} /> };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { comandaId: 'comanda', customerId: 'customer', orderId: 'order' };
  mockCustomerId = undefined;
});

it.each(['tables', 'quick-sales'] as const)('finishes checkout in %s using the clean navigation stack', (kind) => {
  if (kind === 'quick-sales') mockParams.origin = 'quick-sale';
  render(<Checkout />);
  fireEvent.press(screen.getByRole('button', { name: 'Concluir' }));
  expect(mockFinish).toHaveBeenCalledWith({ kind });
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('preserves the responsible customer when checkout leaves a credit balance', () => {
  mockCustomerId = 'customer';
  render(<Checkout />);
  fireEvent.press(screen.getByRole('button', { name: 'Concluir' }));
  expect(mockFinish).toHaveBeenCalledWith({ kind: 'credit', customerId: 'customer' });
});

it('keeps normal back navigation before checkout is completed', () => {
  render(<Checkout />);
  fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(mockFinish).not.toHaveBeenCalled();
});

it.each(['tables', 'quick-sales'] as const)('removes cancelled comandas from %s history', (kind) => {
  if (kind === 'quick-sales') mockParams.origin = 'quick-sale';
  render(<Details />);
  fireEvent.press(screen.getByRole('button', { name: 'Cancelar comanda' }));
  expect(mockFinish).toHaveBeenCalledWith({ kind });
});

it('removes the payment screen after receiving a credit installment', () => {
  render(<CreditPayment />);
  fireEvent.press(screen.getByRole('button', { name: 'Concluir' }));
  expect(mockFinish).toHaveBeenCalledWith({ kind: 'credit', customerId: 'customer' });
});

it('removes the checkout stack while retaining the paid delivery details', () => {
  render(<DeliveryCheckout />);
  fireEvent.press(screen.getByRole('button', { name: 'Concluir' }));
  expect(mockFinish).toHaveBeenCalledWith({ kind: 'delivery', orderId: 'order' });
});

it('preserves quick-sale origin across catalog so the completed flow returns to the right list', () => {
  mockParams.origin = 'quick-sale';
  const details = render(<Details />);
  fireEvent.press(screen.getByRole('button', { name: 'Abrir catálogo' }));
  expect(mockRouter.push).toHaveBeenCalledWith('/comandas/comanda/products?origin=quick-sale');
  details.unmount();
  render(<Catalog />);
  fireEvent.press(screen.getByRole('button', { name: 'Adicionar produtos' }));
  expect(mockRouter.replace).toHaveBeenCalledWith('/comandas/comanda?origin=quick-sale');
});

it('returns counter catalog additions to the dedicated Balcão details instead of tables or quick sales', () => {
  mockParams.origin = 'counter';
  render(<Catalog />);
  fireEvent.press(screen.getByRole('button', { name: 'Adicionar produtos' }));
  expect(mockRouter.replace).toHaveBeenCalledWith('/counter-sales/comanda');
});
