/** Pills and icon buttons (DESIGN §8.7). One primary action per screen; neutral decisions use equal-weight secondary pills. */
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';
import { gradients, radius, shadows, space, useTheme, violet } from './theme';

interface PillProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** On a deep surface the primary pill inverts: white fill, no glow. */
  onDeep?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

const PILL_HEIGHT = 52;

function PillFrame({ children, disabled, onPress, busy, label, style, accessibilityHint }: PillProps & { children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, { opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }, style]}
    >
      {children}
    </Pressable>
  );
}

export function PrimaryPill(props: PillProps) {
  const { colors } = useTheme();
  const labelTone = props.onDeep ? violet[800] : '#FFFFFF';
  const content = props.busy ? <ActivityIndicator color={labelTone} /> : <AppText variant="bodyStrong" style={{ color: labelTone }}>{props.label}</AppText>;
  if (props.onDeep) {
    return <PillFrame {...props} style={[{ backgroundColor: colors.onDeep }, props.style]}>{content}</PillFrame>;
  }
  return (
    <PillFrame {...props} style={[shadows.glow, props.style]}>
      <LinearGradient {...gradients.primary} style={styles.fill}>{content}</LinearGradient>
    </PillFrame>
  );
}

/** Equal-weight alternatives (accept / smaller / keep) and everyday secondary actions. */
export function SecondaryPill(props: PillProps) {
  const { colors } = useTheme();
  return (
    <PillFrame {...props} style={[{ backgroundColor: colors.tile }, props.style]}>
      <AppText variant="bodyStrong" style={{ color: colors.tileIcon }}>{props.label}</AppText>
    </PillFrame>
  );
}

export function TextButton({ label, onPress, tone = 'accent' }: { label: string; onPress: () => void; tone?: 'accent' | 'caution' }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={styles.textButton}>
      <AppText variant="bodyStrong" style={{ color: tone === 'caution' ? colors.caution600 : colors.tileIcon }}>{label}</AppText>
    </Pressable>
  );
}

interface IconButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  onDeep?: boolean;
}

/** A 40 dp rounded-square button: back, close, history. */
export function IconButton({ icon, label, onPress, onDeep }: IconButtonProps) {
  const { colors } = useTheme();
  const frame: ViewStyle = onDeep
    ? { backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.18)' }
    : { backgroundColor: colors.surface, borderColor: colors.line };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4} style={[styles.iconButton, frame]}>
      <Icon name={icon} size={22} color={onDeep ? colors.onDeep : colors.ink900} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { height: PILL_HEIGHT, minWidth: 48, borderRadius: radius.full, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fill: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xxl },
  textButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  iconButton: { width: 44, height: 44, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});

