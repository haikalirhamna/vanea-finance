/** The monthly salary review on the Salary tab (DESIGN §6.2). The three decisions are equal-weight pills. */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { PrimaryPill, SecondaryPill } from '@/components/Buttons';
import { AmountField } from '@/components/Fields';
import { ErrorNotice } from '@/components/ErrorNotice';
import { KeyValue, Note, SectionHeader } from '@/components/Rows';
import { GUTTER, space } from '@/components/theme';
import { anchorPeriod } from '@/domain/salary-change';
import { ExplainedError } from '@/features/errors';
import { describeReview } from '@/features/salary/review-copy';
import { acceptRaise, declineRaise } from '@/features/salary/salary-review-actions';
import { salaryOptions } from '@/features/salary/salary-review';
import { formatMoney, formatPercent } from '@/lib/format';
import { useApp } from '@/state/AppState';

function SmallerRaise({ current, max, onClose }: { current: number; max: number; onClose: () => void }) {
  const { act } = useApp();
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<ExplainedError | null>(null);
  const save = async () => {
    const result = await act((ctx) => acceptRaise(ctx, { amount: amount! }));
    if (result.ok) onClose(); else setError(result.error);
  };
  return (
    <View style={styles.sheet}>
      <AmountField label="New salary" value={amount} onChange={setAmount} hint={`Between ${formatMoney(current + 1)} and ${formatMoney(max)}.`} />
      {error ? <ErrorNotice error={error} /> : null}
      <PrimaryPill label="Save new salary" onPress={save} disabled={!amount} />
    </View>
  );
}

export function SalaryReviewSection() {
  const { snapshot, today, act } = useApp();
  const [smaller, setSmaller] = useState(false);
  const [error, setError] = useState<ExplainedError | null>(null);
  const { status, review } = salaryOptions(snapshot, today);
  if (!status) return null;
  const view = describeReview(status, anchorPeriod(snapshot.salarySettings));
  const decide = async (run: Parameters<typeof act>[0]) => {
    const result = await act(run);
    setError(result.ok ? null : result.error);
  };
  return (
    <>
      <SectionHeader title="Salary review" />
      <View style={styles.block}>
        <AppText variant="body" tone="secondary">{view.message}</AppText>
        {view.rows.map((row) => <KeyValue key={row.label} label={row.label} value={row.value} />)}
        {review ? (
          <>
            <Note>{`You may increase your salary by up to ${formatMoney(review.maxNewSalary! - review.currentSalary)} (${formatPercent((review.maxNewSalary! - review.currentSalary) / review.currentSalary)}).`}</Note>
            <SecondaryPill label={`Increase to ${formatMoney(review.maxNewSalary!)}`} onPress={() => decide((ctx) => acceptRaise(ctx, { amount: review.maxNewSalary! }))} />
            <SecondaryPill label="Choose a smaller increase" onPress={() => setSmaller(true)} />
            <SecondaryPill label={`Keep ${formatMoney(review.currentSalary)}`} onPress={() => decide(declineRaise)} />
          </>
        ) : null}
        {error ? <ErrorNotice error={error} /> : null}
      </View>
      <BottomSheet visible={smaller} onClose={() => setSmaller(false)} title="A smaller increase">
        {review ? <SmallerRaise current={review.currentSalary} max={review.maxNewSalary!} onClose={() => setSmaller(false)} /> : null}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: GUTTER, gap: space.md, marginTop: space.sm },
  sheet: { gap: space.lg, paddingBottom: space.xl },
});
