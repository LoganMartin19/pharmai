// src/utils/notifications.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Medication } from '../types/Medication';
import { auth, db } from '../firebase';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { pingCaregivers } from './careAlerts'; // ✅ use the new util
import { doseCount } from './doseSchedule';

type NotifeeModule = typeof import('@notifee/react-native').default;
type NotifeePackage = typeof import('@notifee/react-native');
type EventTypeValue = NotifeePackage['EventType'][keyof NotifeePackage['EventType']];
type TimestampTrigger = import('@notifee/react-native').TimestampTrigger;

const CHANNEL_ID = 'notification';
const IDS_KEY = (reminderId: string) => `reminder:${reminderId}:notifeeIds`;
const SNOOZE_MINUTES = 15;

let notifeePackage: NotifeePackage | null | undefined;

function getNotifeePackage(): NotifeePackage | null {
  if (notifeePackage !== undefined) return notifeePackage;
  try {
    // Lazy-load so a notification native-module issue cannot crash app startup.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    notifeePackage = require('@notifee/react-native') as NotifeePackage;
  } catch (e) {
    console.warn('notifee unavailable', e);
    notifeePackage = null;
  }
  return notifeePackage;
}

function getNotifee(): NotifeeModule | null {
  return getNotifeePackage()?.default ?? null;
}

/* ---------------- Permissions & Channel ---------------- */

export async function requestNotificationPermission() {
  try {
    const pkg = getNotifeePackage();
    const notifee = pkg?.default;
    if (!pkg || !notifee) return;
    const settings = await notifee.requestPermission();
    if (settings.authorizationStatus >= pkg.AuthorizationStatus.AUTHORIZED) {
      console.log('✅ Notifications authorized');
    } else if (settings.authorizationStatus === pkg.AuthorizationStatus.DENIED) {
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
    const pkg = getNotifeePackage();
    const notifee = pkg?.default;
    if (!pkg || !notifee) return;
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Reminders',
      importance: pkg.AndroidImportance.DEFAULT,
    });
    await notifee.setNotificationCategories([
      {
        id: 'dose-reminder',
        actions: [
          { id: 'taken', title: 'Taken' },
          { id: 'snooze', title: `Snooze ${SNOOZE_MINUTES}m` },
        ],
      },
    ]);
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
      const match = t.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
      if (!match) return null;

      let hour = Number(match[1]);
      const minute = Number(match[2]);
      const meridiem = match[3]?.toUpperCase();

      if (meridiem === 'PM' && hour < 12) hour += 12;
      if (meridiem === 'AM' && hour === 12) hour = 0;

      return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? { hour, minute } : null;
    })
    .filter(Boolean) as { hour: number; minute: number }[];
}

function parseTimeValue(time: string): { hour: number; minute: number } | null {
  return parseTimesCSV(time)[0] ?? null;
}

function buildDailyTriggers(times: { hour: number; minute: number }[]): TimestampTrigger[] {
  const pkg = getNotifeePackage();
  if (!pkg) return [];
  const now = new Date();
  return times.map(({ hour, minute }) => {
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
    return {
      type: pkg.TriggerType.TIMESTAMP,
      timestamp: next.getTime(),
      repeatFrequency: pkg.RepeatFrequency.DAILY,
      alarmManager: { allowWhileIdle: true },
    };
  });
}

function buildOneTimeTrigger(date: Date): TimestampTrigger | null {
  const pkg = getNotifeePackage();
  if (!pkg) return null;
  return {
    type: pkg.TriggerType.TIMESTAMP,
    timestamp: date.getTime(),
    alarmManager: { allowWhileIdle: true },
  };
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function doseDateISO(date: Date) {
  return date.toISOString().split('T')[0];
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

async function deleteServerCareAlerts(reminderId: string) {
  const u = auth.currentUser;
  if (!u) return;

  const snap = await getDocs(collection(db, 'users', u.uid, 'carePendingAlerts'));
  await Promise.all(
    snap.docs
      .filter((alertDoc) => alertDoc.data()?.medId === reminderId)
      .map((alertDoc) => deleteDoc(alertDoc.ref))
  );
}

async function scheduleServerCareAlerts(med: Medication, doseDates: Date[]) {
  const u = auth.currentUser;
  if (!u || !doseDates.length) return;

  await deleteServerCareAlerts(med.id);

  const delayMin = await getFollowUpDelayMinutes();
  await Promise.all(
    doseDates.map((doseDate, doseIndex) => {
      const dueAt = new Date(doseDate.getTime() + delayMin * 60 * 1000);
      return setDoc(
        doc(db, 'users', u.uid, 'carePendingAlerts', `${med.id}_${doseIndex}`),
        {
          medId: med.id,
          medName: med.name,
          doseIndex,
          doseTime: doseDate.toTimeString().slice(0, 5),
          doseDate: doseDateISO(doseDate),
          dueAt: Timestamp.fromDate(dueAt),
          delayMinutes: delayMin,
          processed: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );
    })
  );
}

async function markDoseTaken(med: Medication, doseIndex: number) {
  const u = auth.currentUser;
  if (!u) return;

  const today = todayISO();
  const freq = doseCount(med.frequency);
  const history = med.history ?? [];
  const existing = history.find((h) => h.date === today);

  const nextHistory = existing
    ? history.map((h) => {
        if (h.date !== today) return h;
        const taken = [...(h.taken ?? Array(freq).fill(false))];
        taken[doseIndex] = true;
        return { ...h, taken };
      })
    : [
        ...history,
        {
          date: today,
          taken: Array.from({ length: freq }, (_, index) => index === doseIndex),
        },
      ];

  await updateDoc(doc(db, 'users', u.uid, 'reminders', med.id), { history: nextHistory });
}

/* ---------------- Follow-up delay (per-user setting) ---------------- */

async function getFollowUpDelayMinutes(): Promise<number> {
  const u = auth.currentUser;
  if (!u) return 60;
  try {
    const linksSnap = await getDocs(collection(db, 'users', u.uid, 'careLinks'));
    const caregiverDelays = linksSnap.docs
      .map((linkDoc) => linkDoc.data() as any)
      .filter((link) => link?.role === 'caregiver' && link?.notifyCare !== false)
      .map((link) => Number(link?.notifyDelayMinutes))
      .filter((minutes) => Number.isFinite(minutes) && minutes > 0);

    if (caregiverDelays.length) {
      return Math.max(1, Math.min(720, Math.floor(Math.min(...caregiverDelays))));
    }

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
  const pkg = getNotifeePackage();
  const notifee = pkg?.default;
  if (!pkg || !notifee) return [];

  const timesList: { hour: number; minute: number }[] =
    // @ts-ignore — some reminders may carry array form (string[])
    med.times && (med as any).times.length > 0
      ? (med as any).times
          .map((t: string) => parseTimeValue(t))
          .filter((t: { hour: number; minute: number } | null): t is { hour: number; minute: number } => !!t)
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
          category: pkg.AndroidCategory.REMINDER,
          groupId,
          pressAction: { id: 'default' },
          actions: [
            { title: 'Taken', pressAction: { id: 'taken' } },
            { title: `Snooze ${SNOOZE_MINUTES}m`, pressAction: { id: 'snooze' } },
          ],
        },
        ios: { sound: 'default', interruptionLevel: 'active', categoryId: 'dose-reminder' },
        // used later by the handler
        data: { kind: 'dose', medId: med.id, doseIndex: String(i) },
      },
      triggers[i]
    );
    mainIds.push(id);
  }

  const refillIds = await scheduleRefillNotifications(med);
  const ids = [...mainIds, ...refillIds];
  await saveIds(med.id, ids);
  await scheduleServerCareAlerts(
    med,
    triggers.map((trigger) => new Date(trigger.timestamp))
  );
  return ids;
}

async function scheduleRefillNotifications(med: Medication): Promise<string[]> {
  const pkg = getNotifeePackage();
  const notifee = pkg?.default;
  if (!pkg || !notifee) return [];
  if (!med.endDate || !med.repeatPrescription) return [];

  const endDate = new Date(`${med.endDate}T09:00:00`);
  if (Number.isNaN(endDate.getTime())) return [];

  const offsets = [7, 3, 0];
  const ids: string[] = [];

  for (const daysBefore of offsets) {
    const reminderDate = new Date(endDate);
    reminderDate.setDate(endDate.getDate() - daysBefore);
    if (reminderDate.getTime() <= Date.now()) continue;
    const trigger = buildOneTimeTrigger(reminderDate);
    if (!trigger) continue;

    const id = await notifee.createTriggerNotification(
      {
        title: daysBefore === 0 ? `Refill ${med.name} today` : `${med.name} refill coming up`,
        body:
          daysBefore === 0
            ? 'Your prescription end date is today.'
            : `${daysBefore} days until your prescription end date.`,
        android: {
          channelId: CHANNEL_ID,
          category: pkg.AndroidCategory.REMINDER,
          pressAction: { id: 'default' },
        },
        ios: { sound: 'default', interruptionLevel: 'active' },
        data: { kind: 'refill', medId: med.id, daysBefore: String(daysBefore) },
      },
      trigger
    );
    ids.push(id);
  }

  return ids;
}

export async function cancelReminderNotifications(reminderId: string) {
  const notifee = getNotifee();
  const ids = await loadIds(reminderId);
  if (notifee && ids.length) {
    await notifee.cancelTriggerNotifications(ids);
  }
  await clearIds(reminderId);
  await deleteServerCareAlerts(reminderId);
}

/* ---------------- Smart follow-up handler (foreground + background) ---------------- */

async function coreNotificationHandler({ type, detail }: { type: EventTypeValue; detail: any }) {
  const pkg = getNotifeePackage();
  const notifee = pkg?.default;
  if (!pkg || !notifee) return;

  const n = detail?.notification;
  const data = n?.data as any;
  if (!data) return;

  const kind = data.kind as 'dose' | 'followup' | 'refill' | undefined;
  const medId = data.medId as string | undefined;
  const doseIndex = Number(data.doseIndex);

  if (!medId || (kind !== 'refill' && Number.isNaN(doseIndex))) return;

  try {
    const u = auth.currentUser;
    if (!u) return;

    const medSnap = await getDoc(doc(db, 'users', u.uid, 'reminders', medId));
    const med = medSnap.exists() ? (medSnap.data() as Medication) : null;
    if (!med) return;

    if (type === pkg.EventType.ACTION_PRESS && kind === 'dose') {
      const actionId = detail?.pressAction?.id;
      if (actionId === 'taken') {
        await markDoseTaken({ ...med, id: medId }, doseIndex);
        if (n.id) await notifee.cancelNotification(n.id);
        return;
      }

      if (actionId === 'snooze') {
        const snoozeTime = new Date(Date.now() + SNOOZE_MINUTES * 60 * 1000);
        const snoozeTrigger = buildOneTimeTrigger(snoozeTime);
        if (!snoozeTrigger) return;
        const snoozeId = await notifee.createTriggerNotification(
          {
            title: `Time to take ${med.name}`,
            body: `Snoozed for ${SNOOZE_MINUTES} minutes.`,
            android: {
              channelId: CHANNEL_ID,
              category: pkg.AndroidCategory.REMINDER,
              pressAction: { id: 'default' },
              actions: [
                { title: 'Taken', pressAction: { id: 'taken' } },
                { title: `Snooze ${SNOOZE_MINUTES}m`, pressAction: { id: 'snooze' } },
              ],
            },
            ios: { sound: 'default', interruptionLevel: 'active', categoryId: 'dose-reminder' },
            data: { kind: 'dose', medId, doseIndex: String(doseIndex) },
          },
          snoozeTrigger
        );
        await appendIds(medId, [snoozeId]);
        if (n.id) await notifee.cancelNotification(n.id);
        return;
      }
    }

    if (type !== pkg.EventType.DELIVERED) return;
    if (kind === 'refill') return;

    const today = todayISO();
    const todayHist = med.history?.find((h) => h.date === today);
    const isTaken = !!todayHist && !!todayHist.taken?.[doseIndex];

    if (kind === 'dose') {
      // Schedule follow-up only if not yet taken
      if (isTaken) return;

      const delayMin = await getFollowUpDelayMinutes();
      const followUpTime = new Date(Date.now() + delayMin * 60 * 1000);
      const triggerType = pkg.TriggerType.TIMESTAMP;
      const followUpTrigger: TimestampTrigger = {
        type: triggerType,
        timestamp: followUpTime.getTime(),
      };

      const followUpId = await notifee.createTriggerNotification(
        {
          title: `Still need to take ${med.name}?`,
          body: `It's been ${delayMin} minutes since your dose time.`,
          android: {
            channelId: CHANNEL_ID,
            category: pkg.AndroidCategory.REMINDER,
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
  const notifee = getNotifee();
  if (!notifee) return;
  try {
    notifee.onForegroundEvent(coreNotificationHandler);
  } catch (e) {
    console.warn('notifee foreground registration failed', e);
  }
}

// Background handler (register in index.js)
export async function backgroundNotificationHandler(event: { type: EventTypeValue; detail: any }) {
  await coreNotificationHandler(event);
}

/* ---------------- Manual test ---------------- */

export async function debugTestNotification() {
  const notifee = getNotifee();
  if (!notifee) return;
  await notifee.displayNotification({
    title: 'Test notification',
    body: 'If you see this, notifications are working ✅',
    android: { channelId: CHANNEL_ID },
    ios: { sound: 'default' },
  });
}
