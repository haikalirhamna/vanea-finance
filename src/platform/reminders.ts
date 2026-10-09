/** Schedules the planned reminders with Android: replace everything, since the plan is recomputed after each change. */
import * as Notifications from 'expo-notifications';
import { PlannedNotification } from '@/features/dashboard/notification-plan';

const CHANNEL = 'reminders';

export async function scheduleReminders(plan: readonly PlannedNotification[]): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (plan.length === 0) return;
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return;
  await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Reminders', importance: Notifications.AndroidImportance.DEFAULT });
  for (const item of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: item.id,
      content: { title: item.title, body: item.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(item.at), channelId: CHANNEL },
    });
  }
}
