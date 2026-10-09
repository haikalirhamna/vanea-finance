/** Encrypted backup file out, and restore from one (PRD BAK-1, BAK-2; DESIGN §12). */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { IconButton, PrimaryPill, SecondaryPill } from '@/components/Buttons';
import { ErrorNotice } from '@/components/ErrorNotice';
import { TextField } from '@/components/Fields';
import { KeyValue, Note, SectionHeader } from '@/components/Rows';
import { ContentSheet, HeroCanvas, Screen } from '@/components/Surfaces';
import { GUTTER, space } from '@/components/theme';
import { backupIo, pickBackupText } from '@/platform/backup-files';
import { ExplainedError } from '@/features/errors';
import { OpenedBackup, exportBackup, openBackup, restoreBackup } from '@/features/backup/backup-actions';
import { formatDate, formatMoney } from '@/lib/format';
import { useApp } from '@/state/AppState';

function ExportSection() {
  const { act, ctx } = useApp();
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<ExplainedError | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const run = async () => {
    setError(null);
    const result = await act(() => exportBackup(ctx, backupIo, { passphrase, confirmation }));
    if (result.ok) setDone(`Saved ${result.value.fileName}. Keep it somewhere safe.`); else setError(result.error);
  };
  return (
    <View style={styles.block}>
      <TextField label="Passphrase" value={passphrase} onChangeText={setPassphrase} secureTextEntry autoCapitalize="none" hint="At least 8 characters. Vanea can't recover a forgotten passphrase." />
      <TextField label="Type it again" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" />
      {error ? <ErrorNotice error={error} /> : null}
      {done ? <Note>{done}</Note> : null}
      <PrimaryPill label="Export backup" onPress={run} disabled={!passphrase || !confirmation} />
    </View>
  );
}

function Preview({ opened, onRestore }: { opened: OpenedBackup; onRestore: () => void }) {
  const { summary } = opened;
  return (
    <View style={styles.block}>
      <KeyValue label="Made on" value={formatDate(summary.exportedAt.slice(0, 10), true)} />
      <KeyValue label="Records" value={String(summary.counts.transactions)} />
      <KeyValue label="Pool" value={formatMoney(summary.balances.pool)} />
      <KeyValue label="Available Spending" value={formatMoney(summary.balances.personal)} />
      <KeyValue label="Savings" value={formatMoney(summary.balances.savings)} />
      <Note tone="caution">Restoring replaces everything on this phone with this backup.</Note>
      <PrimaryPill label="Restore this backup" onPress={onRestore} />
    </View>
  );
}

function RestoreSection() {
  const { ctx, reload } = useApp();
  const [text, setText] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [opened, setOpened] = useState<OpenedBackup | null>(null);
  const [error, setError] = useState<ExplainedError | null>(null);
  const [restored, setRestored] = useState(false);
  const pick = async () => setText(await pickBackupText());
  const open = () => {
    const result = openBackup(text!, passphrase);
    if (result.ok) { setOpened(result.value); setError(null); } else setError(result.error);
  };
  const restore = async () => {
    const result = await restoreBackup(ctx, opened!.payload);
    if (result.ok) { await reload(); setRestored(true); setOpened(null); } else setError(result.error);
  };
  if (restored) return <View style={styles.block}><Note>Restored. Everything on this phone now matches the backup.</Note></View>;
  return (
    <View style={styles.block}>
      <SecondaryPill label={text ? 'Choose another file' : 'Choose a backup file'} onPress={pick} />
      {text ? <TextField label="Passphrase" value={passphrase} onChangeText={setPassphrase} secureTextEntry autoCapitalize="none" /> : null}
      {text ? <PrimaryPill label="Open backup" onPress={open} disabled={!passphrase} /> : null}
      {error ? <ErrorNotice error={error} /> : null}
      {opened ? <Preview opened={opened} onRestore={restore} /> : null}
    </View>
  );
}

export function BackupScreen() {
  const router = useRouter();
  return (
    <Screen>
      <HeroCanvas>
        <View style={styles.header}>
          <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} onDeep />
          <AppText variant="title" tone="onDeep" accessibilityRole="header">Backup</AppText>
        </View>
        <AppText variant="body" tone="onDeepMuted">Your data lives only on this phone. A backup file is encrypted with your passphrase.</AppText>
      </HeroCanvas>
      <ContentSheet style={styles.sheet}>
        <SectionHeader title="Export" />
        <ExportSection />
        <SectionHeader title="Restore" />
        <RestoreSection />
      </ContentSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  sheet: { paddingTop: space.lg, paddingBottom: space.giant },
  block: { paddingHorizontal: GUTTER, gap: space.lg, marginTop: space.md },
});
