/** Settings that change how the app behaves (PRD SET-1..3). */
import { CONFIG } from '@/domain/config';
import { NotificationSettings, updateProfile } from '@/data/profile';
import { ActionContext, ActionResult, failure, requireProfile, runAtomic, success } from '../action-runtime';
import { problem } from '../errors';

/** The new payday applies from the first period that has no payment yet. */
export async function changePayday(ctx: ActionContext, day: number): Promise<ActionResult> {
  if (!Number.isInteger(day) || day < CONFIG.PAYDAY_MIN || day > CONFIG.PAYDAY_MAX) {
    return failure(problem('Pick a payday from 1 to 28', 'Paydays after the 28th do not exist in every month.', 'Choose a day between 1 and 28.'));
  }
  return runAtomic(ctx, async () => {
    const profile = await requireProfile(ctx.driver);
    await updateProfile(ctx.driver, profile.id, { paydayDay: day }, ctx.now());
    return success(undefined);
  });
}

export async function setNotifications(ctx: ActionContext, change: Partial<NotificationSettings>): Promise<ActionResult> {
  return runAtomic(ctx, async () => {
    const profile = await requireProfile(ctx.driver);
    await updateProfile(ctx.driver, profile.id, { notify: change }, ctx.now());
    return success(undefined);
  });
}

export async function setBufferMonths(ctx: ActionContext, months: number): Promise<ActionResult> {
  if (!Number.isInteger(months) || months < 0 || months > 24) {
    return failure(problem('Check the buffer', 'The buffer is a whole number of months from 0 to 24.', 'Enter the months again.'));
  }
  return runAtomic(ctx, async () => {
    const profile = await requireProfile(ctx.driver);
    await updateProfile(ctx.driver, profile.id, { bufferMonths: months }, ctx.now());
    return success(undefined);
  });
}
