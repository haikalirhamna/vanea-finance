import { getProfile } from '@/data/profile';
import { onboardedApp } from '../../__tests__/helpers';
import { changePayday, setAppLock, setBufferMonths, setNotifications } from '../settings-actions';

describe('settings', () => {
  it('changes the payday within 1 to 28', async () => {
    const app = await onboardedApp();
    expect((await changePayday(app.ctx, 1)).ok).toBe(true);
    expect((await getProfile(app.driver))!.paydayDay).toBe(1);
    for (const bad of [0, 29, 12.5]) expect(await changePayday(app.ctx, bad)).toMatchObject({ ok: false, error: { title: 'Pick a payday from 1 to 28' } });
    expect((await getProfile(app.driver))!.paydayDay).toBe(1);
  });

  it('turns single notifications on and off', async () => {
    const app = await onboardedApp();
    await setNotifications(app.ctx, { debts: false, backup: false });
    expect((await getProfile(app.driver))!.notify).toEqual({ payday: true, subscriptions: true, debts: false, month: true, pressure: true, backup: false });
  });

  it('sets the buffer in whole months', async () => {
    const app = await onboardedApp();
    expect((await setBufferMonths(app.ctx, 6)).ok).toBe(true);
    expect((await getProfile(app.driver))!.bufferMonths).toBe(6);
    expect((await setBufferMonths(app.ctx, 25)).ok).toBe(false);
    expect((await setBufferMonths(app.ctx, -1)).ok).toBe(false);
  });
});

describe('setAppLock', () => {
  it('turns the lock off and on', async () => {
    const app = await onboardedApp();
    expect((await app.snapshot()).profile!.appLockEnabled).toBe(true);
    await setAppLock(app.ctx, false);
    expect((await app.snapshot()).profile!.appLockEnabled).toBe(false);
    await setAppLock(app.ctx, true);
    expect((await app.snapshot()).profile!.appLockEnabled).toBe(true);
  });
});
