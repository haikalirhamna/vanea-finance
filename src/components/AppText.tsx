import { ReactNode } from 'react';
import { Text, TextProps, TextStyle } from 'react-native';
import { TextVariant, tabular, typography, useTheme } from './theme';

type Tone = 'primary' | 'secondary' | 'faint' | 'accent' | 'onDeep' | 'onDeepMuted' | 'caution';

interface Props extends TextProps {
  variant?: TextVariant;
  tone?: Tone;
  /** Digits that must line up: amounts, dates, percentages. */
  numeric?: boolean;
  children: ReactNode;
}

const NUMERIC_VARIANTS: readonly TextVariant[] = ['hero', 'amount', 'amountLarge'];

export function AppText({ variant = 'body', tone = 'primary', numeric, style, children, ...rest }: Props) {
  const { colors } = useTheme();
  const colorByTone: Record<Tone, string> = {
    primary: colors.ink900, secondary: colors.ink600, faint: colors.ink400, accent: colors.accent,
    onDeep: colors.onDeep, onDeepMuted: colors.onDeepMuted, caution: colors.caution600,
  };
  const base: TextStyle = { ...typography[variant], color: colorByTone[tone] };
  const isNumeric = numeric ?? NUMERIC_VARIANTS.includes(variant);
  return (
    <Text {...rest} style={[base, isNumeric ? tabular : null, style]}>
      {children}
    </Text>
  );
}
