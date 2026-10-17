import { type Href, type NativeStackNavigationProp, useNavigation, useRouter } from 'expo-router';
import { useSafeNavigationCompletion } from './safe-navigation';

type CompletedFlowRoutes = {
  index: undefined;
  'admin/index': undefined;
  'admin/roles/index': undefined;
  'admin/users/index': undefined;
  'tables/index': undefined;
  'quick-sales': undefined;
  'counter-sales/index': undefined;
  credits: undefined;
  'deliveries/index': undefined;
  'deliveries/orders/[orderId]/index': { orderId: string };
};

export type CompletedFlowDestination =
  | { kind: 'roles' | 'users' }
  | { kind: 'counter' }
  | { kind: 'tables' }
  | { kind: 'quick-sales' }
  | { kind: 'credit'; customerId: string }
  | { kind: 'delivery'; orderId: string };

export function useCompletedFlowNavigation() {
  const navigation = useNavigation<NativeStackNavigationProp<CompletedFlowRoutes>>('/');
  const router = useRouter();
  const complete = useSafeNavigationCompletion();
  return (destination: CompletedFlowDestination) => complete(() => {
    if (destination.kind === 'roles' || destination.kind === 'users') {
      navigation.reset({ index: 2, routes: [{ name: 'index' }, { name: 'admin/index' },
        { name: destination.kind === 'roles' ? 'admin/roles/index' : 'admin/users/index' }] });
      return;
    }
    if (destination.kind === 'credit') {
      navigation.reset({
        index: 1,
        routes: [
          { name: 'index' },
          { name: 'credits' },
        ],
      });
      router.push(`/credits/${encodeURIComponent(destination.customerId)}` as Href);
      return;
    }
    if (destination.kind === 'delivery') {
      navigation.reset({
        index: 2,
        routes: [
          { name: 'index' },
          { name: 'deliveries/index' },
          { name: 'deliveries/orders/[orderId]/index', params: { orderId: destination.orderId } },
        ],
      });
      return;
    }
    navigation.reset({
      index: 1,
      routes: [
        { name: 'index' },
        { name: destination.kind === 'counter' ? 'counter-sales/index' : destination.kind === 'tables' ? 'tables/index' : 'quick-sales' },
      ],
    });
  });
}
