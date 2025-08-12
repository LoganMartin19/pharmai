// src/notifications.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
  AndroidCategory,
  AndroidImportance,
  AuthorizationStatus,
  RepeatFrequency,
  TimestampTrigger,
  TriggerType,
} from '@notifee/react-native';
import { Medication } from '../types/Medication';

const CHANNEL_ID = 'notification';
const IDS_KEY = (reminderId: string) => `reminder:${reminderId}:notifeeIds`;

/** Ask the user for notification permission (iOS & Android 13+). */
export async function requestNotificationPermission() {
  try {
    const settings = await notifee.requestPermission();
    if (settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED) {
      console.log('✅ Notifications authorized');
    } else if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
      console.log('❌ Notifications denied');
    } else {
      console.log('ℹ️ Notifications provisional/limited');
    }
  } catch (e) {
    console.warn('requestPermission failed', e);
  }
}

/** Android channel (safe to call on iOS; it no-ops). */
export async function setupNotificationChannel() {
  try {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Reminders',
      importance: AndroidImportance.DEFAULT,
    });
  } catch (e) {
    console.warn('createChannel failed', e);
  }
}

/** Parse "HH:mm, HH:mm, ..." into [{hour, minute}]. */
function parseTimesCSV(times?: string): { hour: number; minute: number }[] {
  if (!times) return [];
  return times
    .split(',')
    .map((s) => s.trim())
    .map((t) => {
      const [h, m] = t.split(':').map(Number);
      return Number.isFinite(h) && Number.isFinite(m) ? { hour: h, minute: m } : null;
    })
    .filter(Boolean) as { hour: number; minute: number }[];
}

/** Build daily timestamp triggers for next occurrences of the times. */
function buildDailyTriggers(
  times: { hour: number; minute: number }[]
): TimestampTrigger[] {
  const now = new Date();
  return times.map(({ hour, minute }) => {
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
    return {
      type: TriggerType.TIMESTAMP,
      timestamp: next.getTime(),
      repeatFrequency: RepeatFrequency.DAILY,
      alarmManager: { allowWhileIdle: true },
    };
  });
}

async function saveIds(reminderId: string, ids: string[]) {
  await AsyncStorage.setItem(IDS_KEY(reminderId), JSON.stringify(ids));
}
async function loadIds(reminderId: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(IDS_KEY(reminderId));
  return raw ? (JSON.parse(raw) as string[]) : [];
}
async function clearIds(reminderId: string) {
  await AsyncStorage.removeItem(IDS_KEY(reminderId));
}

/** Schedule daily notifications for a medication's times. */
export async function scheduleReminderNotifications(med: Medication): Promise<string[]> {
  const times = parseTimesCSV(med.time);
  if (times.length === 0) return [];

  const triggers = buildDailyTriggers(times);
  const groupId = `reminder:${med.id}`;

  const ids: string[] = [];
  for (let i = 0; i < triggers.length; i++) {
    const id = await notifee.createTriggerNotification(
      {
        title: `Time to take ${med.name}`,
        body: med.instructions ?? `Dose ${i + 1}${med.dosage ? ` — ${med.dosage}` : ''}`,
        android: {
          channelId: CHANNEL_ID,
          category: AndroidCategory.REMINDER,
          groupId,
          pressAction: { id: 'default' },
        },
        ios: {
          sound: 'default',
          interruptionLevel: 'active',
        },
      },
      triggers[i]
    );
    ids.push(id);
  }
  await saveIds(med.id, ids);
  return ids;
}

/** Cancel any scheduled notifications for a given reminder. */
export async function cancelReminderNotifications(reminderId: string) {
  const ids = await loadIds(reminderId);
  if (ids.length) {
    await notifee.cancelTriggerNotifications(ids);
  }
  await clearIds(reminderId);
}

/** Quick one-off test notification (manual sanity check). */
export async function debugTestNotification() {
  await notifee.displayNotification({
    title: 'Test notification',
    body: 'If you see this, notifications are working ✅',
    android: { channelId: CHANNEL_ID },
    ios: { sound: 'default' },
  });
}