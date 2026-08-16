import { Pressable, Text, View } from 'react-native';

import { deliveryOrderStyles as styles } from './delivery-order-screens.styles';

export function DeliverySectionTabs({
  active,
  onCouriers,
  onOrders,
}: {
  active: 'couriers' | 'orders';
  onCouriers: () => void;
  onOrders: () => void;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.tabBar}>
      <Tab active={active === 'orders'} label="Pedidos" onPress={onOrders} />
      <Tab
        active={active === 'couriers'}
        label="Entregadores"
        onPress={onCouriers}
      />
    </View>
  );
}

function Tab({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}
