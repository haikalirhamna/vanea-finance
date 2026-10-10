/** One subscription: confirm or skip a billing, announce a price change, edit, delete (USER-FLOWS §4.1–4.3). */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { IconButton, PrimaryPill, SecondaryPill } from '@/components/Buttons';
import { AmountField, DateField, Segmented, TextField } from '@/components/Fields';
import { ErrorNotice } from '@/components/ErrorNotice';
import { KeyValue, Note } from '@/components/Rows';
import { ContentSheet, HeroCanvas, Screen } from '@/components/Surfaces';
import { GUTTER, space } from '@/components/theme';
import { PriceChoice, needsPriceQuestion } from '@/domain/subscriptions';
import { ExplainedError } from '@/features/errors';
import { announcePriceChange, confirmBilling, editSubscription, removeSubscription, skipBilling } from '@/features/subscriptions/subscription-actions';
import { SubscriptionRow, previewPriceChange, subscriptionList } from '@/features/subscriptions/subscription-summary';
import { formatDate, formatMoney, formatMonthsCount } from '@/lib/format';
import { useApp } from '@/state/AppState';

type Mode = 'bill' | 'price' | 'edit' | 'delete';

const CHOICES = [{ value: 'from_now_on', label: 'From now on' }, { value: 'only_this_time', label: 'Only this time' }] as const;

function BillingForm({ id, expected, onDone }: { id: string; expected: number; onDone: () => void }) {
  const { act } = useApp();
  const [amount, setAmount] = useState<number | null>(expected);
  const [choice, setChoice] = useState<PriceChoice | null>(null);
  const [error, setError] = useState<ExplainedError | null>(null);
  const differs = amount !== null && needsPriceQuestion(expected, amount);
  const save = async () => {
    const result = await act((ctx) => confirmBilling(ctx, { id, amount: amount!, ...(choice ? { choice } : {}) }));
    if (result.ok) onDone(); else setError(result.error);
  };
  return (
    <View style={styles.form}>
      <AmountField label="Amount charged" value={amount} onChange={setAmount} />
      {differs ? <Segmented label="Did the price change?" options={CHOICES} value={choice} onChange={setChoice} /> : null}
      {error ? <ErrorNotice error={error} /> : null}
      <PrimaryPill label="Record billing" onPress={save} disabled={!amount || (differs && !choice)} />
    </View>
  );
}

function PriceForm({ id, onDone }: { id: string; onDone: () => void }) {
  const { act, snapshot, today } = useApp();
  const [price, setPrice] = useState<number | null>(null);
  const [from, setFrom] = useState(today);
  const [error, setError] = useState<ExplainedError | null>(null);
  const impact = price ? previewPriceChange(snapshot, today, id, price) : null;
  const save = async () => {
    const result = await act((ctx) => announcePriceChange(ctx, { id, price: price!, effectiveFrom: from }));
    if (result.ok) onDone(); else setError(result.error);
  };
  return (
    <View style={styles.form}>
      <AmountField label="New price" value={price} onChange={setPrice} />
      <DateField label="From" value={from} onChange={setFrom} />
      {impact ? (
        <Note>{`Your monthly commitments ${impact.monthlyDelta >= 0 ? 'rise' : 'fall'} by ${formatMoney(Math.abs(impact.monthlyDelta))}, to ${formatMoney(impact.commitmentAfter)}.${impact.runwayAfter === null ? '' : ` Your Pool covers ${formatMonthsCount(impact.runwayAfter)}.`}`}</Note>
      ) : null}
      {error ? <ErrorNotice error={error} /> : null}
      <PrimaryPill label="Save price" onPress={save} disabled={!price} />
    </View>
  );
}

function EditForm({ id, name, next, onDone }: { id: string; name: string; next: string; onDone: () => void }) {
  const { act } = useApp();
  const [newName, setNewName] = useState(name);
  const [date, setDate] = useState(next);
  const [error, setError] = useState<ExplainedError | null>(null);
  const save = async () => {
    const result = await act((ctx) => editSubscription(ctx, id, { name: newName, nextBillingDate: date }));
    if (result.ok) onDone(); else setError(result.error);
  };
  return (
    <View style={styles.form}>
      <TextField label="Name" value={newName} onChangeText={setNewName} />
      <DateField label="Next billing date" value={date} onChange={setDate} />
      {error ? <ErrorNotice error={error} /> : null}
      <PrimaryPill label="Save" onPress={save} disabled={!newName.trim()} />
    </View>
  );
}

const TITLES: Record<Mode, string> = { bill: 'Record billing', price: 'New price', edit: 'Edit', delete: 'Delete this subscription?' };

function ModeForm({ mode, id, row, onDone, onDelete }: { mode: Mode; id: string; row: SubscriptionRow; onDone: () => void; onDelete: () => void }) {
  switch (mode) {
    case 'bill': return <BillingForm id={id} expected={row.price ?? 0} onDone={onDone} />;
    case 'price': return <PriceForm id={id} onDone={onDone} />;
    case 'edit': return <EditForm id={id} name={row.name} next={row.nextBillingDate} onDone={onDone} />;
    case 'delete':
      return (
        <View style={styles.form}>
          <Note>Reminders stop and it leaves your monthly commitments. Costs already recorded stay in your history.</Note>
          <PrimaryPill label="Delete" onPress={onDelete} />
        </View>
      );
  }
}

export function SubscriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot, today, act } = useApp();
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const row = subscriptionList(snapshot, today).rows.find((r) => r.id === id);
  if (!row) return <Note>That subscription no longer exists.</Note>;
  const close = () => setMode(null);
  const remove = async () => { await act((ctx) => removeSubscription(ctx, id!)); router.back(); };
  return (
    <Screen>
      <HeroCanvas>
        <View style={styles.header}>
          <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} onDeep />
          <AppText variant="title" tone="onDeep" accessibilityRole="header">{row.name}</AppText>
        </View>
        <AppText variant="hero" tone="onDeep">{formatMoney(row.price ?? 0)}</AppText>
        <AppText variant="body" tone="onDeepMuted">{row.cycle === 'yearly' ? `Yearly · about ${formatMoney(row.monthly)} a month` : 'Monthly'}</AppText>
      </HeroCanvas>
      <ContentSheet style={styles.sheet}>
        <View style={styles.block}>
          <KeyValue label={row.dueToday ? 'Billing was due' : 'Next billing'} value={formatDate(row.nextBillingDate, true)} />
          <PrimaryPill label="Record billing" onPress={() => setMode('bill')} />
          <SecondaryPill label="Skip this time" onPress={() => act((ctx) => skipBilling(ctx, id!))} />
          <SecondaryPill label="New price" onPress={() => setMode('price')} />
          <SecondaryPill label="Edit" onPress={() => setMode('edit')} />
          <SecondaryPill label="Delete" onPress={() => setMode('delete')} />
        </View>
      </ContentSheet>
      <BottomSheet visible={mode !== null} onClose={close} title={mode ? TITLES[mode] : undefined}>
        {mode ? <ModeForm mode={mode} id={id!} row={row} onDone={close} onDelete={remove} /> : null}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  sheet: { paddingTop: space.xl },
  block: { paddingHorizontal: GUTTER, gap: space.md },
  form: { gap: space.lg, paddingBottom: space.xl },
});
