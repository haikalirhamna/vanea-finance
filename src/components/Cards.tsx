/** The floating action card, duo cards and the one caution card (DESIGN §8.7). */
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';
import { IconTile } from './IconTile';
import { GUTTER, gradients, radius, shadows, space, useTheme } from './theme';
import { formatMoney, speakMoney } from '@/lib/format';

export interface ActionItem {
  icon: IconName;
  label: string;
  onPress: () => void;
}

/** Four destinations on a white card that straddles the hero's edge. It never holds promotions. */
export function FloatingActionCard({ items }: { items: readonly ActionItem[] }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.floating, shadows.float, { backgroundColor: colors.surface }]}>
      {items.map((item) => (
        <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} onPress={item.onPress} style={styles.floatingItem}>
          <IconTile icon={item.icon} />
          <AppText variant="caption" tone="secondary" numberOfLines={1}>{item.label}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

interface DuoProps {
  variant: 'deep' | 'vivid';
  icon: IconName;
  label: string;
  amount: number;
  caption?: string;
  onPress?: () => void;
}

/** Salary and Pool: two cards side by side, with one faint static circle each. */
export function DuoCard({ variant, icon, label, amount, caption, onPress }: DuoProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${label}, ${speakMoney(amount)}${caption ? `, ${caption}` : ''}`}
      onPress={onPress}
      style={styles.duoOuter}
    >
      <LinearGradient {...gradients[variant]} style={styles.duo}>
        <View style={styles.orb} />
        <View style={styles.badge}><Icon name={icon} size={18} color={colors.onDeep} /></View>
        <View>
          <AppText variant="caption" tone="onDeepMuted">{label}</AppText>
          <AppText variant="amountLarge" tone="onDeep" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontSize: 18, lineHeight: 26 }}>{formatMoney(amount)}</AppText>
          {caption ? <AppText variant="caption" tone="onDeepMuted" numberOfLines={1}>{caption}</AppText> : null}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export function DuoRow({ children }: { children: ReactNode }) {
  return <View style={styles.duoRow}>{children}</View>;
}

/** The single caution card: a white surface with a caution-tinted icon tile. Never a colored block. */
export function NoticeCard({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.notice, shadows.soft, { backgroundColor: colors.surface }]}>
      <IconTile icon="alert" tone="caution" />
      <View style={styles.noticeBody}>
        <AppText variant="heading">{title}</AppText>
        {children}
        {actions ? <View style={styles.noticeActions}>{actions}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floating: { marginHorizontal: GUTTER, borderRadius: radius.lg, paddingVertical: space.lg, paddingHorizontal: space.sm, flexDirection: 'row', zIndex: 2 },
  floatingItem: { flex: 1, alignItems: 'center', gap: space.sm, minHeight: 48 },
  duoRow: { flexDirection: 'row', gap: space.md, paddingHorizontal: GUTTER },
  duoOuter: { flex: 1 },
  duo: { borderRadius: radius.lg, padding: space.lg, minHeight: 132, justifyContent: 'space-between', overflow: 'hidden' },
  orb: { position: 'absolute', right: -44, bottom: -52, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.06)' },
  badge: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  notice: { marginHorizontal: GUTTER, borderRadius: radius.lg, padding: space.lg, flexDirection: 'row', gap: space.md },
  noticeBody: { flex: 1, gap: space.xs },
  noticeActions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
});
