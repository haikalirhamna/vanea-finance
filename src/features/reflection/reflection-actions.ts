/** The monthly intention and the end-of-month reflection (PRD REF-1..3). */
import { Month, monthOf } from '@/domain/calendar';
import { ReflectionNotes, saveIntentionRecord, insertReflection } from '@/data/reflections';
import { loadSnapshot } from '@/data/snapshot';
import { ActionContext, ActionResult, failure, runAtomic, success } from '../action-runtime';
import { problem } from '../errors';
import { figuresFor } from './reflection-summary';

export interface IntentionInput {
  setAsideAmount: number;
  wantsLimit?: number;
  note?: string;
}

/** An intention for the current month; setting it again replaces it. */
export async function setIntention(ctx: ActionContext, input: IntentionInput): Promise<ActionResult> {
  if (!Number.isSafeInteger(input.setAsideAmount) || input.setAsideAmount < 0) {
    return failure(problem('Check the amount', 'What you want to set aside is a whole number of rupiah, 0 or more.', 'Enter 0 if you do not plan to set anything aside.'));
  }
  return runAtomic(ctx, async () => {
    const now = ctx.now();
    await saveIntentionRecord(ctx.driver, {
      id: ctx.newId(), month: monthOf(ctx.today()), setAsideAmount: input.setAsideAmount, createdAt: now, updatedAt: now,
      ...(input.wantsLimit !== undefined ? { wantsLimit: input.wantsLimit } : {}), ...(input.note ? { note: input.note } : {}),
    });
    return success(undefined);
  });
}

/** Saves the reflection with the numbers as they are now; afterwards it is history. */
export async function saveReflection(ctx: ActionContext, input: { month: Month; notes: ReflectionNotes }): Promise<ActionResult> {
  return runAtomic(ctx, async () => {
    const snapshot = await loadSnapshot(ctx.driver);
    if (snapshot.reflections.some((r) => r.month === input.month && r.completedAt)) {
      return failure(problem('Already reflected', 'This month has a saved reflection.', 'Open it from your history to read it.'));
    }
    if (input.month >= monthOf(ctx.today())) {
      return failure(problem("This month isn't over", 'A reflection looks back on a finished month.', 'Come back after the month ends.'));
    }
    const now = ctx.now();
    const notes = Object.fromEntries(Object.entries(input.notes).filter(([, value]) => value && value.trim())) as ReflectionNotes;
    await insertReflection(ctx.driver, {
      id: ctx.newId(), month: input.month, ...notes, summarySnapshotJson: JSON.stringify(figuresFor(snapshot, input.month)),
      completedAt: now, createdAt: now, updatedAt: now,
    });
    return success(undefined);
  });
}
