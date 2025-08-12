// src/context/RemindersContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { TimestampTrigger, TriggerType, RepeatFrequency, AndroidImportance, AndroidCategory } from '@notifee/react-native';

import { Medication } from '../types/Medication';
import { db } from '../firebase';
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

// ---- Types & Context ----
type RemindersContextType = {
  reminders: Medication[];
  addReminder: (reminder: Medication) => Promise<void>;
  updateReminder: (updated: Medication) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
};

const RemindersContext = createContext<RemindersContextType | undefined>(undefined);

// ---- Storage helpers (notification IDs per reminder) ----
const IDS_KEY = (reminderId: string) => `reminder:${reminderId}:notifeeIds`;

async function saveNotificationIds(reminderId: string, ids: string[]) {
  await AsyncStorage.setItem(IDS_KEY(reminderId), JSON.stringify(ids));
}
async function getNotificationIds(reminderId: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(IDS_KEY(reminderId));
  return raw ? (JSON.parse(raw) as string[]) : [];
}
async function clearNotificationIds(reminderId: string) {
  await AsyncStorage.removeItem(IDS_KEY(reminderId));
}

// ---- Time parsing & trigger building ----
function parseTimesCSV(times?: string): { hour: number; minute: number }[] {
  if (!times) return [];
  // accepts "08:00,20:00" or "08:00, 20:00"
  return times
    .split(',')
    .map(s => s.trim())
    .map(t => {
      const [h, m] = t.split(':').map(Number);
      if (Number.isFinite(h) && Number.isFinite(m)) return { hour: h, minute: m };
      return null;
    })
    .filter(Boolean) as { hour: number; minute: number }[];
}

/**
 * Create daily repeating triggers for each HH:mm.
 * We use TimestampTrigger + RepeatFrequency.DAILY for cross‑platform reliability.
 */
function buildDailyTriggers(times: { hour: number; minute: number }[]): TimestampTrigger[] {
  const now = new Date();
  return times.map(({ hour, minute }) => {
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);
    // if the time today already passed, schedule for tomorrow
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return {
      type: TriggerType.TIMESTAMP,
      timestamp: next.getTime(),
      repeatFrequency: RepeatFrequency.DAILY,
      alarmManager: { allowWhileIdle: true },
    } as TimestampTrigger;
  });
}

// ---- Scheduling / cancelling ----
async function scheduleReminderNotifications(med: Medication): Promise<string[]> {
  const times = parseTimesCSV(med.time);
  if (times.length === 0) return [];

  const triggers = buildDailyTriggers(times);

  // Optional: group per reminder
  const androidChannelId = 'notification'; // created in setupNotificationChannel()
  const groupId = `reminder:${med.id}`;

  const ids: string[] = [];
  for (let i = 0; i < triggers.length; i++) {
    const id = await notifee.createTriggerNotification(
      {
        title: `Time to take ${med.name}`,
        body: med.instructions ?? `Dose ${i + 1}${med.dosage ? ` — ${med.dosage}` : ''}`,
        android: {
          channelId: androidChannelId,
          smallIcon: 'ic_stat_name', // ensure you have a small icon, or remove this line
          importance: AndroidImportance.DEFAULT,
          category: AndroidCategory.REMINDER,
          groupId,
          pressAction: { id: 'default' },
        },
        ios: {
          interruptionLevel: 'active',
          sound: 'default',
        },
      },
      triggers[i]
    );
    ids.push(id);
  }
  return ids;
}

async function cancelReminderNotifications(reminderId: string) {
  const existing = await getNotificationIds(reminderId);
  if (existing.length) {
    await notifee.cancelTriggerNotifications(existing);
  }
  await clearNotificationIds(reminderId);
}

// ---- Provider ----
export function RemindersProvider({ children }: { children: ReactNode }) {
  const [reminders, setReminders] = useState<Medication[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        const userRemindersRef = collection(db, 'users', user.uid, 'reminders');
        const snapshot = await getDocs(userRemindersRef);
        const loadedReminders = snapshot.docs.map(d => d.data() as Medication);
        setReminders(loadedReminders);
      } else {
        setUserId(null);
        setReminders([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const addReminder = async (reminder: Medication) => {
    if (!userId) return;
    const ref = doc(db, 'users', userId, 'reminders', reminder.id);

    await setDoc(ref, reminder);
    setReminders(prev => [...prev, reminder]);

    // schedule notifications
    await cancelReminderNotifications(reminder.id); // safety
    const ids = await scheduleReminderNotifications(reminder);
    await saveNotificationIds(reminder.id, ids);
  };

  const updateReminder = async (updated: Medication) => {
    if (!userId) return;
    const ref = doc(db, 'users', userId, 'reminders', updated.id);

    await updateDoc(ref, updated);
    setReminders(prev => prev.map(r => (r.id === updated.id ? updated : r)));

    // re-schedule
    await cancelReminderNotifications(updated.id);
    const ids = await scheduleReminderNotifications(updated);
    await saveNotificationIds(updated.id, ids);
  };

  const deleteReminder = async (id: string) => {
    if (!userId) return;
    const ref = doc(db, 'users', userId, 'reminders', id);

    await deleteDoc(ref);
    setReminders(prev => prev.filter(r => r.id !== id));

    await cancelReminderNotifications(id);
  };

  return (
    <RemindersContext.Provider value={{ reminders, addReminder, updateReminder, deleteReminder }}>
      {children}
    </RemindersContext.Provider>
  );
}

export function useReminders() {
  const ctx = useContext(RemindersContext);
  if (!ctx) throw new Error('useReminders must be used within a RemindersProvider');
  return ctx;
}