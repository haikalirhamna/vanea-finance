import { useState } from 'react';
import { FormFrame } from '@/components/FormFrame';
import { AmountField, TextField } from '@/components/Fields';
import { Note } from '@/components/Rows';
import { setIntention } from '@/features/reflection/reflection-actions';
import { formatMonthName } from '@/lib/format';
import { monthOf } from '@/domain/calendar';
import { useApp } from '@/state/AppState';

export function IntentionScreen() {
  const { act, today } = useApp();
  const [setAside, setSetAside] = useState<number | null>(null);
  const [wantsLimit, setWantsLimit] = useState<number | null>(null);
  const [note, setNote] = useState('');
  return (
    <FormFrame
      title={`${formatMonthName(monthOf(today))} intention`}
      subtitle="What do you want to set aside this month?"
      submitLabel="Save intention"
      disabled={setAside === null}
      onSubmit={() => act((ctx) => setIntention(ctx, {
        setAsideAmount: setAside!, ...(wantsLimit ? { wantsLimit } : {}), ...(note.trim() ? { note: note.trim() } : {}),
      }))}
    >
      <AmountField label="Set aside" value={setAside} onChange={setSetAside} large autoFocus hint="Enter 0 if you don't plan to." />
      <AmountField label="Limit for Wants (optional)" value={wantsLimit} onChange={setWantsLimit} />
      <TextField label="Note (optional)" value={note} onChangeText={setNote} />
      <Note>An intention is a reference for your reflection, not a rule. Nothing is blocked.</Note>
    </FormFrame>
  );
}
