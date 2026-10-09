/** Onboarding step: what you owe today. PayLater and cards are not income and not spending money. */
import { useState } from 'react';
import { View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { PrimaryPill, SecondaryPill } from '@/components/Buttons';
import { AmountField, DateField, Segmented, TextField } from '@/components/Fields';
import { ListRow, Note } from '@/components/Rows';
import { formatMoney } from '@/lib/format';
import { OnboardingCreditLine, OnboardingDebt, OnboardingLoan } from '@/features/onboarding/onboarding-actions';
import { CreditLineType } from '@/data/debts';
import { useApp } from '@/state/AppState';

const TYPES = [{ value: 'paylater', label: 'PayLater' }, { value: 'credit_card', label: 'Credit card' }] as const;
const SET_ASIDE = [{ value: 'yes', label: 'Take it out now' }, { value: 'no', label: 'Older debt' }] as const;
const toInt = (text: string): number => Number.parseInt(text, 10) || 0;

function CreditLineForm({ onAdd }: { onAdd: (debt: OnboardingCreditLine) => void }) {
  const [type, setType] = useState<CreditLineType | null>(null);
  const [name, setName] = useState('');
  const [statement, setStatement] = useState('');
  const [due, setDue] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [setAside, setSetAside] = useState<'yes' | 'no' | null>(null);
  const ready = type && name.trim() && toInt(statement) && toInt(due) && balance !== null && setAside;
  return (
    <View style={{ gap: 16 }}>
      <Segmented label="What is it?" options={TYPES} value={type} onChange={setType} />
      <TextField label="Name" value={name} onChangeText={setName} placeholder="ShopeePayLater" />
      <AmountField label="What you owe today" value={balance} onChange={setBalance} />
      <TextField label="Statement day" value={statement} onChangeText={setStatement} keyboardType="number-pad" />
      <TextField label="Due day" value={due} onChangeText={setDue} keyboardType="number-pad" />
      <Segmented label="This balance" options={SET_ASIDE} value={setAside} onChange={setSetAside}
        hint="Taking it out reserves it from Available Spending so the bill is already covered." />
      <PrimaryPill label="Add" disabled={!ready} onPress={() => onAdd({
        kind: 'credit_line', name: name.trim(), type: type!, statementDay: toInt(statement), dueDay: toInt(due), balance: balance!, setAside: setAside === 'yes',
      })} />
    </View>
  );
}

function LoanForm({ onAdd, today }: { onAdd: (debt: OnboardingLoan) => void; today: string }) {
  const [name, setName] = useState('');
  const [installment, setInstallment] = useState<number | null>(null);
  const [remaining, setRemaining] = useState('');
  const [next, setNext] = useState(today);
  const ready = name.trim() && installment && toInt(remaining);
  return (
    <View style={{ gap: 16 }}>
      <TextField label="Lender" value={name} onChangeText={setName} placeholder="Kredivo, bank…" />
      <AmountField label="Installment" value={installment} onChange={setInstallment} />
      <TextField label="Installments left" value={remaining} onChangeText={setRemaining} keyboardType="number-pad" />
      <DateField label="Next payment due" value={next} onChange={setNext} min={today} />
      <PrimaryPill label="Add" disabled={!ready} onPress={() => onAdd({
        kind: 'installment_loan', name: name.trim(), type: 'online_loan', purpose: 'personal',
        installmentAmount: installment!, remainingInstallments: toInt(remaining), nextDueDate: next,
      })} />
    </View>
  );
}

interface Props {
  debts: readonly OnboardingDebt[];
  onChange: (debts: OnboardingDebt[]) => void;
}

export function OnboardingDebtsStep({ debts, onChange }: Props) {
  const { today } = useApp();
  const [adding, setAdding] = useState<'line' | 'loan' | null>(null);
  const add = (debt: OnboardingDebt) => { onChange([...debts, debt]); setAdding(null); };
  return (
    <View style={{ gap: 12 }}>
      <Note>PayLater, credit cards and loans are tracked separately. They never count as income.</Note>
      {debts.map((debt, index) => (
        <ListRow key={index} icon={debt.kind === 'credit_line' ? 'card' : 'receipt'} title={debt.name}
          subtitle={debt.kind === 'credit_line' ? 'Credit line' : `${debt.remainingInstallments} installments left`}
          trailing={formatMoney(debt.kind === 'credit_line' ? debt.balance : debt.installmentAmount * debt.remainingInstallments)}
          onPress={() => onChange(debts.filter((_, i) => i !== index))} />
      ))}
      {debts.length > 0 ? <Note>Tap a debt to remove it.</Note> : null}
      <SecondaryPill label="Add PayLater or credit card" onPress={() => setAdding('line')} />
      <SecondaryPill label="Add a loan" onPress={() => setAdding('loan')} />
      <BottomSheet visible={adding !== null} onClose={() => setAdding(null)} title={adding === 'loan' ? 'Add a loan' : 'Add a credit line'}>
        {adding === 'line' ? <CreditLineForm onAdd={add} /> : adding === 'loan' ? <LoanForm onAdd={add} today={today} /> : null}
      </BottomSheet>
    </View>
  );
}
