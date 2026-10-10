import { useState } from 'react';
import { FormFrame } from '@/components/FormFrame';
import { Segmented, TextField } from '@/components/Fields';
import { Note } from '@/components/Rows';
import { AssetClass, ASSET_CLASS_RISK, RiskLevel } from '@/domain/investments';
import { addHolding } from '@/features/investments/investment-actions';
import { CLASS_WORDS, RISK_WORDS } from '@/features/investments/investment-words';
import { useApp } from '@/state/AppState';

const RISKS: { value: RiskLevel; label: string }[] = [
  { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' },
];
const CLASSES = (Object.keys(CLASS_WORDS) as AssetClass[]).map((value) => ({ value, label: CLASS_WORDS[value] }));

/** A picker of ten classes does not fit a segmented control: choices are listed as rows of pills. */
function ClassChoice({ value, onChange }: { value: AssetClass | null; onChange: (value: AssetClass) => void }) {
  const half = Math.ceil(CLASSES.length / 2);
  return (
    <>
      <Segmented label="Asset class" options={CLASSES.slice(0, half)} value={value} onChange={onChange} />
      <Segmented label=" " options={CLASSES.slice(half)} value={value} onChange={onChange} />
    </>
  );
}

export function AddHoldingScreen() {
  const { act } = useApp();
  const [name, setName] = useState('');
  const [assetClass, setAssetClass] = useState<AssetClass | null>(null);
  const [risk, setRisk] = useState<RiskLevel | null>(null);
  const [platform, setPlatform] = useState('');
  const general = assetClass && assetClass !== 'other' ? RISK_WORDS[ASSET_CLASS_RISK[assetClass]] : null;
  return (
    <FormFrame
      title="Add holding"
      subtitle="Recorded for your own overview. Never counted as spending money."
      submitLabel="Save holding"
      disabled={!name.trim() || !assetClass || (assetClass === 'other' && !risk)}
      onSubmit={() => act((ctx) => addHolding(ctx, { name, assetClass: assetClass!, ...(risk ? { riskOverride: risk } : {}), ...(platform.trim() ? { platform } : {}) }))}
    >
      <TextField label="Name" value={name} onChangeText={setName} placeholder="BBCA, Bitcoin, Bibit RDPU…" />
      <ClassChoice value={assetClass} onChange={setAssetClass} />
      {general ? <Note>{`${general} in general. A label for the class, not advice about this holding.`}</Note> : null}
      {assetClass === 'other' ? <Segmented label="Risk label" options={RISKS} value={risk} onChange={setRisk} /> : null}
      <TextField label="Platform (optional)" value={platform} onChangeText={setPlatform} placeholder="Bibit, Pluang, bank…" />
    </FormFrame>
  );
}
