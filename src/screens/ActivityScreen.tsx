/** Every record that counts, newest first. Tapping one opens corrections: change or remove, never rewrite (PRD COR-1). */
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BOTTOM_BAR_SPACE } from '@/components/BottomBar';
import { PrimaryPill, SecondaryPill } from '@/components/Buttons';
import { AmountField, DateField } from '@/components/Fields';
import { ErrorNotice } from '@/components/ErrorNotice';
import { BottomSheet } from '@/components/BottomSheet';
import { ListRow, Note } from '@/components/Rows';
import { ContentSheet, HeroCanvas, Screen } from '@/components/Surfaces';
import { space } from '@/components/theme';
import { formatDate, formatMoney } from '@/lib/format';
import { ExplainedError } from '@/features/errors';
import { ActivityItem, activityItems } from '@/features/activity/activity-list';
import { deleteTransaction, editTransaction } from '@/features/corrections/corrections-actions';
import { useApp } from '@/state/AppState';

function signed(item: ActivityItem): string {
  const text = formatMoney(item.amount);
  return item.direction === 'in' ? `+${text}` : text;
}

function Correction({ item, onClose }: { item: ActivityItem; onClose: () => void }) {
  const { act, today } = useApp();
  const [amount, setAmount] = useState<number | null>(item.amount);
  const [date, setDate] = useState(item.date);
  const [error, setError] = useState<ExplainedError | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const finish = (result: { ok: true } | { ok: false; error: ExplainedError }) => (result.ok ? onClose() : setError(result.error));
  const save = async () => finish(await act((ctx) => editTransaction(ctx, item.id, { amount: amount!, date })));
  const remove = async () => {
    const result = await act((ctx) => deleteTransaction(ctx, item.id));
    if (!result.ok) return setError(result.error);
    if (result.value.remainderAsAdvance > 0) setMessage(`${formatMoney(result.value.remainderAsAdvance)} was already paid out as salary, so it became a salary advance.`);
    else onClose();
  };
  if (message) return <><Note>{message}</Note><PrimaryPill label="OK" onPress={onClose} /></>;
  return (
    <View style={styles.correction}>
      {item.editable ? (
        <>
          <AmountField label="Amount" value={amount} onChange={setAmount} />
          <DateField label="Date" value={date} onChange={setDate} max={today} />
          <PrimaryPill label="Save correction" onPress={save} disabled={!amount} />
        </>
      ) : null}
      {item.removable ? <SecondaryPill label="Remove" onPress={remove} /> : <Note>This record can't be changed here.</Note>}
      {error ? <ErrorNotice error={error} /> : null}
      <Note>The original stays in your history as a correction; nothing is erased silently.</Note>
    </View>
  );
}

export function ActivityScreen() {
  const { snapshot } = useApp();
  const [selected, setSelected] = useState<ActivityItem | null>(null);
  const items = useMemo(() => activityItems(snapshot.transactions), [snapshot.transactions]);
  return (
    <Screen bottomInset={BOTTOM_BAR_SPACE}>
      <HeroCanvas><AppText variant="title" tone="onDeep" accessibilityRole="header">Activity</AppText></HeroCanvas>
      <ContentSheet style={{ paddingTop: space.lg }}>
        {items.length === 0 ? <Note>Nothing recorded yet.</Note> : null}
        {items.map((item, index) => (
          <ListRow
            key={item.id} title={item.title} subtitle={[formatDate(item.date, true), item.subtitle].filter(Boolean).join(' · ')}
            trailing={signed(item)} trailingAmount={item.amount} divider={index < items.length - 1}
            onPress={item.editable || item.removable ? () => setSelected(item) : undefined}
          />
        ))}
      </ContentSheet>
      <BottomSheet visible={selected !== null} onClose={() => setSelected(null)} title={selected?.title}>
        {selected ? <Correction key={selected.id} item={selected} onClose={() => setSelected(null)} /> : null}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({ correction: { gap: space.lg, paddingBottom: space.xl } });
