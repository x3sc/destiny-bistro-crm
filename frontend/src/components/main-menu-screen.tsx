import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function MainMenuScreen({
  onCredits,
  onStatements,
  onTables,
}: {
  onCredits: () => void;
  onStatements: () => void;
  onTables: () => void;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>Destiny Bistro CRM</Text>
        <Text style={styles.title}>Menu principal</Text>
        <Text style={styles.description}>
          Escolha a área que deseja acessar.
        </Text>

        <View style={styles.cards}>
          <MenuCard
            description="Abra e acompanhe as comandas do salão."
            label="Mesas"
            onPress={onTables}
          />
          <MenuCard
            description="Registre pedidos e acompanhe valores a receber."
            label="Fiados"
            onPress={onCredits}
          />
          <MenuCard
            description="Consulte vendas, recebimentos e comandas por período."
            label="Extratos"
            onPress={onStatements}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function MenuCard({
  description,
  disabled = false,
  label,
  onPress,
}: {
  description: string;
  disabled?: boolean;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        disabled && styles.disabledCard,
        pressed && !disabled && styles.pressedCard,
      ]}
    >
      <View style={styles.cardHeading}>
        <Text style={styles.cardTitle}>{label}</Text>
        {disabled && <Text style={styles.badge}>Em breve</Text>}
      </View>
      <Text style={styles.cardDescription}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#e7ddd4',
    borderRadius: 999,
    color: '#6f4e37',
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  card: {
    backgroundColor: '#fff',
    borderColor: '#d8c5b4',
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 20,
  },
  cardDescription: {
    color: '#6c5d54',
    fontSize: 15,
    lineHeight: 21,
  },
  cardHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: '#382b25',
    fontSize: 22,
    fontWeight: '800',
  },
  cards: {
    gap: 14,
    marginTop: 24,
  },
  content: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: 680,
    padding: 22,
    width: '100%',
  },
  description: {
    color: '#6c5d54',
    fontSize: 16,
    marginTop: 8,
  },
  disabledCard: {
    opacity: 0.65,
  },
  eyebrow: {
    color: '#8a5f48',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  pressedCard: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  safeArea: {
    backgroundColor: '#f7f3ed',
    flex: 1,
  },
  title: {
    color: '#382b25',
    fontSize: 32,
    fontWeight: '800',
    marginTop: 12,
  },
});
