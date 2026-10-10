/** Shows the lock screen until the owner authenticates; locks again after the app was away for a while (USER-FLOWS §20). */
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { PrimaryPill } from '@/components/Buttons';
import { IconTile } from '@/components/IconTile';
import { HeroCanvas } from '@/components/Surfaces';
import { GUTTER, space } from '@/components/theme';
import { authenticate } from '@/platform/lock';
import { useApp } from './AppState';

/** How long the app may be in the background before it asks again. */
export const RELOCK_AFTER_MS = 60_000;

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [busy, setBusy] = useState(false);
  const attempt = useCallback(async () => {
    setBusy(true);
    const ok = await authenticate('Unlock Vanea');
    setBusy(false);
    if (ok) onUnlock();
  }, [onUnlock]);
  useEffect(() => { void attempt(); }, [attempt]);
  return (
    <HeroCanvas style={styles.fill}>
      <View style={styles.center}>
        <IconTile icon="lock" tone="onDeep" size={64} />
        <AppText variant="title" tone="onDeep" accessibilityRole="header">Vanea is locked</AppText>
        <AppText variant="body" tone="onDeepMuted" style={styles.text}>Your money data stays on this phone. Unlock to continue.</AppText>
        <PrimaryPill label="Unlock" onDeep onPress={attempt} busy={busy} />
      </View>
    </HeroCanvas>
  );
}

export function LockGate({ children }: { children: ReactNode }) {
  const { snapshot } = useApp();
  const wanted = snapshot.profile?.appLockEnabled === true;
  const [unlocked, setUnlocked] = useState(false);
  const leftAt = useRef<number | null>(null);

  useEffect(() => {
    if (!snapshot.profile) setUnlocked(true);
  }, [snapshot.profile]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') leftAt.current = Date.now();
      if (state === 'active' && leftAt.current !== null && Date.now() - leftAt.current > RELOCK_AFTER_MS) setUnlocked(false);
      if (state === 'active') leftAt.current = null;
    });
    return () => subscription.remove();
  }, []);

  if (wanted && !unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />;
  return <>{children}</>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'center' },
  center: { alignItems: 'center', gap: space.lg, paddingHorizontal: GUTTER },
  text: { textAlign: 'center' },
});
