/** The frame every form screen shares: a deep header, the fields on the sheet, one primary action (DESIGN §8.7, §12). */
import { useRouter } from 'expo-router';
import { ReactNode, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActionResult } from '@/features/action-runtime';
import { ExplainedError } from '@/features/errors';
import { AppText } from './AppText';
import { IconButton, PrimaryPill } from './Buttons';
import { ErrorNotice } from './ErrorNotice';
import { FlushContext } from './Rows';
import { ContentSheet, HeroCanvas } from './Surfaces';
import { GUTTER, space, useTheme } from './theme';

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  submitLabel: string;
  /** Runs the action; the screen closes when it succeeds. */
  onSubmit: () => Promise<ActionResult<unknown>>;
  /** Called with the result before the screen closes; return false to stay (e.g. to show a summary). */
  onSuccess?: (value: unknown) => boolean | void;
  disabled?: boolean;
  /** Where "close" goes. Defaults to back. */
  onClose?: () => void;
}

/** Runs the action, keeps its busy flag and shows the explanation when it is refused. */
export function useSubmit(onSubmit: Props['onSubmit'], onSuccess: Props['onSuccess'], close: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ExplainedError | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await onSubmit();
      if (!result.ok) setError(result.error);
      else if (onSuccess?.(result.value) !== false) close();
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, submit };
}

export function FormFrame({ title, subtitle, children, submitLabel, onSubmit, onSuccess, disabled, onClose }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const close = onClose ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  const { busy, error, submit } = useSubmit(onSubmit, onSuccess, close);
  return (
    <ScrollView style={{ backgroundColor: colors.canvas }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <HeroCanvas style={styles.hero}>
        <View style={styles.headerRow}>
          <AppText variant="title" tone="onDeep" accessibilityRole="header" style={styles.title}>{title}</AppText>
          <IconButton icon="close" label="Close" onPress={close} onDeep />
        </View>
        {subtitle ? <AppText variant="body" tone="onDeepMuted">{subtitle}</AppText> : null}
      </HeroCanvas>
      <ContentSheet style={styles.sheet}>
        <View style={styles.body}>
          <FlushContext.Provider value>{children}</FlushContext.Provider>
          {error ? <ErrorNotice error={error} /> : null}
          <PrimaryPill label={submitLabel} onPress={submit} busy={busy} disabled={disabled} />
        </View>
      </ContentSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  hero: { gap: space.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  title: { flex: 1 },
  sheet: { flex: 1 },
  body: { paddingHorizontal: GUTTER, gap: space.xl, paddingBottom: space.giant },
});
