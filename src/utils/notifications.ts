// src/utils/notifications.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
  AndroidCategory,
  AndroidImportance,
  AuthorizationStatus,
  EventType,
  RepeatFrequency,
  TimestampTrigger,
  TriggerType,
} from '@notifee/react-native';
import { Medication } from '../types/Medication';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { pingCaregivers } from './careAlerts'; // ✅ use the new util

const CHANNEL_ID = 'notification';
const IDS_KEY = (reminderId: string) => `reminder:${reminderId}:notifeeIds`;

/* ---------------- Permissions & Channel ---------------- */

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

/* ---------------- Time helpers ---------------- */

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

function buildDailyTriggers(times: { hour: number; minute: number }[]): TimestampTrigger[] {
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

/* ---------------- Notification ID helpers ---------------- */

async function saveIds(reminderId: string, ids: string[]) {
  await AsyncStorage.setItem(IDS_KEY(reminderId), JSON.stringify(ids));
}
async function loadIds(reminderId: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(IDS_KEY(reminderId));
  return raw ? (JSON.parse(raw) as string[]) : [];
}
async function appendIds(reminderId: string, ids: string[]) {
  const existing = await loadIds(reminderId);
  await saveIds(reminderId, [...existing, ...ids]);
}
async function clearIds(reminderId: string) {
  await AsyncStorage.removeItem(IDS_KEY(reminderId));
}

/* ---------------- Follow-up delay (per-user setting) ---------------- */

async function getFollowUpDelayMinutes(): Promise<number> {
  const u = auth.currentUser;
  if (!u) return 60;
  try {
    const snap = await getDoc(doc(db, 'users', u.uid));
    const data = snap.exists() ? (snap.data() as any) : null;
    // Support both root field and nested under settings
    const root = data?.followUpDelayMinutes;
    const nested = data?.settings?.followUpDelayMinutes;
    const n = Number(root ?? nested);
    return Number.isFinite(n) && n > 0 ? n : 60;
  } catch {
    return 60;
  }
}

/** Optional helper: set per-user follow-up delay (minutes). Clamped to 1..720. */
export async function setFollowUpDelayMinutes(minutes: number) {
  const u = auth.currentUser;
  if (!u) throw new Error('Not signed in');
  const val = Math.max(1, Math.min(720, Math.floor(Number(minutes) || 60)));
  await setDoc(doc(db, 'users', u.uid), { followUpDelayMinutes: val }, { merge: true });
}

/* ---------------- Main scheduling (primary dose notifications) ---------------- */

export async function scheduleReminderNotifications(med: Medication): Promise<string[]> {
  const timesList =
    // @ts-ignore — some reminders may carry array form (string[])
    med.times && (med as any).times.length > 0
      ? (med as any).times.map((t: string) => {
          const [h, m] = t.split(':').map(Number);
          return { hour: h, minute: m };
        })
      : parseTimesCSV(med.time);

  if (timesList.length === 0) return [];

  const triggers = buildDailyTriggers(timesList);
  const groupId = `reminder:${med.id}`;
  const mainIds: string[] = [];

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
        ios: { sound: 'default', interruptionLevel: 'active' },
        // used later by the handler
        data: { kind: 'dose', medId: med.id, doseIndex: String(i) },
      },
      triggers[i]
    );
    mainIds.push(id);
  }

  await saveIds(med.id, mainIds);
  return mainIds;
}

export async function cancelReminderNotifications(reminderId: string) {
  const ids = await loadIds(reminderId);
  if (ids.length) {
    await notifee.cancelTriggerNotifications(ids);
  }
  await clearIds(reminderId);
}

/* ---------------- Smart follow-up handler (foreground + background) ---------------- */

async function coreNotificationHandler({ type, detail }: { type: EventType; detail: any }) {
  if (type !== EventType.DELIVERED) return;

  const n = detail?.notification;
  const data = n?.data as any;
  if (!data) return;

  const kind = data.kind as 'dose' | 'followup' | undefined;
  const medId = data.medId as string | undefined;
  const doseIndex = Number(data.doseIndex);

  if (!medId || Number.isNaN(doseIndex)) return;

  try {
    const u = auth.currentUser;
    if (!u) return;

    const medSnap = await getDoc(doc(db, 'users', u.uid, 'reminders', medId));
    const med = medSnap.exists() ? (medSnap.data() as Medication) : null;
    if (!med) return;

    const today = new Date().toISOString().split('T')[0];
    const todayHist = med.history?.find((h) => h.date === today);
    const isTaken = !!todayHist && !!todayHist.taken?.[doseIndex];

    if (kind === 'dose') {
      // Schedule follow-up only if not yet taken
      if (isTaken) return;

      const delayMin = await getFollowUpDelayMinutes();
      const followUpTime = new Date(Date.now() + delayMin * 60 * 1000);
      const followUpTrigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: followUpTime.getTime(),
      };

      const followUpId = await notifee.createTriggerNotification(
        {
          title: `Still need to take ${med.name}?`,
          body: `It's been ${delayMin} minutes since your dose time.`,
          android: {
            channelId: CHANNEL_ID,
            category: AndroidCategory.REMINDER,
            pressAction: { id: 'default' },
          },
          ios: { sound: 'default', interruptionLevel: 'active' },
          data: { kind: 'followup', medId, doseIndex: String(doseIndex) },
        },
        followUpTrigger
      );

      await appendIds(medId, [followUpId]);
      return;
    }

    if (kind === 'followup') {
      // Escalate ONLY if still not taken at follow-up time
      if (!isTaken) {
        await pingCaregivers(med, doseIndex);
      }
      return;
    }
  } catch (e) {
    console.warn('notification handler failed', e);
  }
}

// Foreground registration (call once in App.tsx)
export function registerForegroundNotificationHandlers() {
  notifee.onForegroundEvent(coreNotificationHandler);
}

// Background handler (register in index.js)
export async function backgroundNotificationHandler(event: { type: EventType; detail: any }) {
  await coreNotificationHandler(event);
}

/* ---------------- Manual test ---------------- */

export async function debugTestNotification() {
  await notifee.displayNotification({
    title: 'Test notification',
    body: 'If you see this, notifications are working ✅',
    android: { channelId: CHANNEL_ID },
    ios: { sound: 'default' },
  });
}