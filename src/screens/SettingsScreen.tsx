import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { IconButton, PrimaryPill } from '@/components/Buttons';
import { ErrorNotice } from '@/components/ErrorNotice';
import { TextField } from '@/components/Fields';
import { Note, SectionHeader } from '@/components/Rows';
import { ContentSheet, HeroCanvas, Screen } from '@/components/Surfaces';
import { GUTTER, space, useTheme } from '@/components/theme';
import { NotificationSettings } from '@/data/profile';
import { ExplainedError } from '@/features/errors';
import { changePayday, setNotifications } from '@/features/settings/settings-actions';
import { useApp } from '@/state/AppState';

const REMINDERS: { key: keyof NotificationSettings; label: string }[] = [
  { key: 'payday', label: 'Payday' }, { key: 'subscriptions', label: 'Subscription charges' }, { key: 'debts', label: 'Debt payments' },
  { key: 'month', label: 'Monthly reflection' }, { key: 'pressure', label: 'Salary check-ins' }, { key: 'backup', label: 'Backup reminder' },
];

function ReminderRow({ label, value, onChange }: { label: string; value: boolean; onChange: (next: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.switchRow}>
      <AppText variant="body">{label}</AppText>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: colors.accent }} />
    </View>
  );
}

function PaydaySection() {
  const { snapshot, act } = useApp();
  const [day, setDay] = useState(String(snapshot.profile!.paydayDay));
  const [error, setError] = useState<ExplainedError | null>(null);
  const save = async () => {
    const result = await act((ctx) => changePayday(ctx, Number.parseInt(day, 10)));
    setError(result.ok ? null : result.error);
  };
  return (
    <View style={styles.block}>
      <TextField label="Payday (1–28)" value={day} onChangeText={setDay} keyboardType="number-pad" hint="A new payday applies from the first period not yet paid." />
      {error ? <ErrorNotice error={error} /> : null}
      <PrimaryPill label="Save payday" onPress={save} disabled={!Number.parseInt(day, 10)} />
    </View>
  );
}

export function SettingsScreen() {
  const router = useRouter();
  const { snapshot, act } = useApp();
  const notify = snapshot.profile!.notify;
  return (
    <Screen>
      <HeroCanvas>
        <View style={styles.header}>
          <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} onDeep />
          <AppText variant="title" tone="onDeep" accessibilityRole="header">Settings</AppText>
        </View>
      </HeroCanvas>
      <ContentSheet style={styles.sheet}>
        <SectionHeader title="Payday" />
        <PaydaySection />
        <SectionHeader title="Reminders" />
        <View style={styles.block}>
          {REMINDERS.map((item) => (
            <ReminderRow key={item.key} label={item.label} value={notify[item.key]} onChange={(next) => void act((ctx) => setNotifications(ctx, { [item.key]: next }))} />
          ))}
          <Note>Reminders are private and made on this phone. Nothing is sent anywhere.</Note>
        </View>
      </ContentSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sheet: { paddingTop: space.lg, paddingBottom: space.giant },
  block: { paddingHorizontal: GUTTER, gap: space.md, marginTop: space.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
});
