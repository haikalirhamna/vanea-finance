import { ReactNode, createContext, useContext } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { IconName } from './Icon';
import { IconTile } from './IconTile';
import { GUTTER, space, useTheme } from './theme';
import { speakMoney } from '@/lib/format';

interface RowProps {
  icon?: IconName;
  title: string;
  subtitle?: string;
  /** Already formatted, right-aligned. */
  trailing?: string;
  /** For screen readers when the trailing text is money. */
  trailingAmount?: number;
  onPress?: () => void;
  divider?: boolean;
}

/** A list row that sits straight on the sheet: no box of its own (DESIGN §8.7). */
export function ListRow({ icon, title, subtitle, trailing, trailingAmount, onPress, divider = true }: RowProps) {
  const { colors } = useTheme();
  const spoken = [title, subtitle, trailingAmount === undefined ? trailing : speakMoney(trailingAmount)].filter(Boolean).join(', ');
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={spoken}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, divider ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line } : null]}
    >
      {icon ? <IconTile icon={icon} size={44} /> : null}
      <View style={styles.rowText}>
        <AppText variant="bodyStrong" numberOfLines={1}>{title}</AppText>
        {subtitle ? <AppText variant="caption" tone="secondary" numberOfLines={2}>{subtitle}</AppText> : null}
      </View>
      {trailing ? <AppText variant="amount" numeric style={styles.trailing} numberOfLines={1}>{trailing}</AppText> : null}
    </Pressable>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="heading">{title}</AppText>
      {action}
    </View>
  );
}

/** Inside a form the body already has the gutter, so notes must not add their own. */
export const FlushContext = createContext(false);

/** Quiet explanatory text under a figure. */
export function Note({ children, tone = 'secondary' }: { children: ReactNode; tone?: 'secondary' | 'caution' }) {
  const flush = useContext(FlushContext);
  return <AppText variant="caption" tone={tone === 'caution' ? 'caution' : 'secondary'} style={flush ? styles.noteFlush : styles.note}>{children}</AppText>;
}

/** A label with its value on one line: used for plain figures in previews. */
export function KeyValue({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.keyValue}>
      <AppText variant="body" tone="secondary" style={styles.keyLabel}>{label}</AppText>
      <AppText variant={strong ? 'amount' : 'body'} numeric style={styles.keyValueText}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingVertical: space.sm, marginHorizontal: GUTTER },
  rowText: { flex: 1, gap: 2 },
  trailing: { textAlign: 'right', maxWidth: '45%' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GUTTER, marginTop: space.xxl, marginBottom: space.xs },
  note: { paddingHorizontal: GUTTER, marginTop: space.sm },
  noteFlush: { marginTop: space.xs },
  keyValue: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md, paddingVertical: space.xs },
  keyLabel: { flexShrink: 1 },
  keyValueText: { textAlign: 'right', flexShrink: 0 },
});
