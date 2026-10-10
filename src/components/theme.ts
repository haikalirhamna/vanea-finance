/** Design tokens (DESIGN §8): color, gradient, shape, depth and type. The only source for all of them. */
import { TextStyle, useColorScheme } from 'react-native';

export const violet = {
  950: '#1A0B45', 900: '#26105F', 800: '#35168A', 700: '#4A20B8', 600: '#6230E0',
  500: '#7C52F0', 300: '#B8A2F7', 200: '#D9CCFB', 100: '#ECE6FD', 50: '#F5F2FE',
} as const;

export interface Colors {
  canvas: string;
  surface: string;
  field: string;
  line: string;
  ink900: string;
  ink600: string;
  ink400: string;
  /** Icon tile fill on the sheet. */
  tile: string;
  tileIcon: string;
  accent: string;
  accentSoft: string;
  caution600: string;
  caution100: string;
  caution300: string;
  onDeep: string;
  onDeepMuted: string;
  onDeepFaint: string;
}

const light: Colors = {
  canvas: '#F6F5FA', surface: '#FFFFFF', field: '#EFEDF5', line: '#E9E7F0',
  ink900: '#15121F', ink600: '#5F5A70', ink400: '#6B677D',
  tile: violet[50], tileIcon: violet[700], accent: violet[600], accentSoft: violet[100],
  caution600: '#9A5B13', caution100: '#FDF1DE', caution300: '#F4C27A',
  onDeep: '#FFFFFF', onDeepMuted: 'rgba(255,255,255,0.72)', onDeepFaint: 'rgba(255,255,255,0.16)',
};

const dark: Colors = {
  ...light,
  canvas: '#0F0B1A', surface: '#18132A', field: '#221B38', line: 'rgba(255,255,255,0.08)',
  ink900: '#F3F1F8', ink600: '#ADA8BD', ink400: '#9A94AE',
  tile: 'rgba(124,82,240,0.16)', tileIcon: violet[300], accent: violet[500], accentSoft: 'rgba(124,82,240,0.22)',
  caution600: '#F4C27A', caution100: 'rgba(244,194,122,0.14)',
};

export const gradients = {
  hero: { colors: [violet[950], violet[800]], start: { x: 0.2, y: 0 }, end: { x: 0.8, y: 1 } },
  primary: { colors: ['#7C52F0', '#5626D6'], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  deep: { colors: [violet[950], violet[900]], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  vivid: { colors: ['#5A2BD8', violet[700]], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
} as const;

export const radius = { xs: 8, sm: 12, md: 16, lg: 20, xl: 28, full: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, huge: 32, giant: 40 } as const;
export const GUTTER = space.xl;

export const shadows = {
  soft: { boxShadow: '0 2px 8px rgba(26,11,69,0.05)' },
  float: { boxShadow: '0 12px 32px rgba(26,11,69,0.10)' },
  glow: { boxShadow: '0 10px 24px rgba(98,48,224,0.35)' },
  none: {},
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  heading: 'PlusJakartaSans_600SemiBold',
} as const;

export type TextVariant = 'hero' | 'title' | 'heading' | 'amount' | 'amountLarge' | 'body' | 'bodyStrong' | 'caption' | 'overline';

export const typography: Record<TextVariant, { fontFamily: string; fontSize: number; lineHeight: number; letterSpacing?: number; textTransform?: 'uppercase' }> = {
  hero: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 48, letterSpacing: -0.5 },
  title: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 32 },
  heading: { fontFamily: fonts.heading, fontSize: 16, lineHeight: 24 },
  amount: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24 },
  amountLarge: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  overline: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: 'uppercase' },
};

export interface Theme {
  dark: boolean;
  colors: Colors;
}

export const lightTheme: Theme = { dark: false, colors: light };
export const darkTheme: Theme = { dark: true, colors: dark };

/** The theme for the system's current setting. */
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}

/** Tabular figures keep amounts aligned (DESIGN §3.3). */
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };
