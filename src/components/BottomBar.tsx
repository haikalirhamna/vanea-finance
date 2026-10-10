/** The bottom bar: four tabs around the center action that adds an expense (DESIGN §4.1, §8.7). */
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';
import { Icon, IconName } from './Icon';
import { ListRow } from './Rows';
import { gradients, radius, shadows, space, useTheme } from './theme';

interface TabRoute { key: string; name: string }

/** The part of the tab bar props this bar uses (the navigation package is not a direct dependency). */
interface TabBarProps {
  state: { routes: TabRoute[]; index: number };
  navigation: {
    emit(event: { type: 'tabPress'; target: string; canPreventDefault: true }): { defaultPrevented: boolean };
    navigate(name: string): void;
  };
}

const TAB_ICONS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'home', label: 'Home' },
  salary: { icon: 'wallet', label: 'Salary' },
  activity: { icon: 'list', label: 'Activity' },
  more: { icon: 'dots', label: 'More' },
};

const BAR_HEIGHT = 64;
const CENTER_SIZE = 60;
export const BOTTOM_BAR_SPACE = BAR_HEIGHT + 48;

function Tab({ route, focused, onPress }: { route: { key: string; name: string }; focused: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const meta = TAB_ICONS[route.name];
  if (!meta) return null;
  const color = focused ? colors.accent : colors.ink400;
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={meta.label} accessibilityState={{ selected: focused }} onPress={onPress} style={styles.tab}>
      <Icon name={meta.icon} size={24} color={color} strokeWidth={focused ? 2.25 : 1.75} />
      <AppText variant="caption" style={{ color, fontSize: 11, lineHeight: 14 }}>{meta.label}</AppText>
    </Pressable>
  );
}

function CenterAction({ onPress, onLongPress }: { onPress: () => void; onLongPress: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.centerSlot}>
      <View style={[styles.cradle, { backgroundColor: colors.canvas }]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add expense"
        accessibilityHint="Long press for more things to add"
        onPress={onPress}
        onLongPress={onLongPress}
        style={({ pressed }) => [styles.centerButton, shadows.glow, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}
      >
        <LinearGradient {...gradients.primary} style={styles.centerFill}><Icon name="plus" size={28} color="#FFFFFF" strokeWidth={2.25} /></LinearGradient>
      </Pressable>
    </View>
  );
}

function AddMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const go = (path: '/add-expense' | '/add-income' | '/add-business-cost') => { onClose(); router.push(path); };
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add">
      <View style={styles.menu}>
        <ListRow icon="arrowUp" title="Expense" subtitle="Spent from Available Spending, or with a credit line" onPress={() => go('/add-expense')} />
        <ListRow icon="arrowDown" title="Income" subtitle="Money received: it goes to your Pool" onPress={() => go('/add-income')} />
        <ListRow icon="repeat" title="Business cost" subtitle="Subscriptions, tools, tax: paid from the Pool" onPress={() => go('/add-business-cost')} divider={false} />
      </View>
    </BottomSheet>
  );
}

export function AppTabBar({ state, navigation }: TabBarProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const tabs = state.routes.map((route, index) => ({ route, focused: state.index === index }));
  const press = (route: { key: string; name: string }, focused: boolean) => {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
  };
  const render = (item: (typeof tabs)[number]) => <Tab key={item.route.key} route={item.route} focused={item.focused} onPress={() => press(item.route, item.focused)} />;
  return (
    <View style={[styles.bar, shadows.float, { backgroundColor: colors.surface, paddingBottom: insets.bottom, height: BAR_HEIGHT + insets.bottom }]}>
      <View accessibilityRole="tablist" style={styles.tabGroup}>{tabs.slice(0, 2).map(render)}</View>
      <CenterAction onPress={() => router.push('/add-expense')} onLongPress={() => setMenuOpen(true)} />
      <View accessibilityRole="tablist" style={styles.tabGroup}>{tabs.slice(2).map(render)}</View>
      <AddMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: space.sm },
  tabGroup: { flex: 1, flexDirection: 'row' },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 2 },
  centerSlot: { width: CENTER_SIZE + 24, alignItems: 'center', justifyContent: 'flex-start', height: BAR_HEIGHT },
  cradle: { position: 'absolute', top: -34, width: CENTER_SIZE + 16, height: CENTER_SIZE + 16, borderRadius: (CENTER_SIZE + 16) / 2 },
  centerButton: { position: 'absolute', top: -26, width: CENTER_SIZE, height: CENTER_SIZE, borderRadius: CENTER_SIZE / 2, overflow: 'hidden' },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  menu: { marginHorizontal: -space.xl },
});
