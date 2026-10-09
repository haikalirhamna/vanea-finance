/** The hero canvas, the sheet that rises over it, and the scrolling screen frame (DESIGN §8.7). */
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useId } from 'react';
import { RefreshControlProps, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { GUTTER, gradients, radius, space, useTheme, violet } from './theme';

/** A soft violet glow in the top right: the one decoration the hero carries. Static, never behind text it could hurt. */
function HeroGlow() {
  const id = useId().replace(/:/g, '');
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="85" cy="8" rx="75" ry="55" fx="85" fy="8" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={violet[500]} stopOpacity="0.38" />
          <Stop offset="1" stopColor={violet[500]} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  );
}

interface HeroProps {
  children: ReactNode;
  /** Extra room at the bottom for a card that floats over the edge. */
  overlap?: number;
  style?: ViewStyle;
}

export function HeroCanvas({ children, overlap = 0, style }: HeroProps) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient {...gradients.hero} style={[styles.hero, { paddingTop: insets.top + space.lg, paddingBottom: space.xxl + radius.xl + overlap }, style]}>
      <HeroGlow />
      {children}
    </LinearGradient>
  );
}

/** The light sheet whose rounded top rises over the hero. */
export function ContentSheet({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return <View style={[styles.sheet, { backgroundColor: colors.canvas }, style]}>{children}</View>;
}

interface ScreenProps {
  children: ReactNode;
  /** Pull-to-refresh and the like. */
  refreshControl?: React.ReactElement<RefreshControlProps>;
  /** Room for the bottom bar. */
  bottomInset?: number;
}

/** A scrolling page on the canvas, with the standard gutter. */
export function Screen({ children, refreshControl, bottomInset = space.huge }: ScreenProps) {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={{ paddingBottom: bottomInset }}
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export const gutter = { paddingHorizontal: GUTTER } satisfies ViewStyle;

const styles = StyleSheet.create({
  hero: { paddingHorizontal: GUTTER, overflow: 'hidden' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, marginTop: -radius.xl, paddingTop: space.xxl, minHeight: 400 },
});
