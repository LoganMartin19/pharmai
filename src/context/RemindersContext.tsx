// src/context/RemindersContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { TimestampTrigger, TriggerType, RepeatFrequency, AndroidImportance, AndroidCategory } from '@notifee/react-native';

import { Medication } from '../types/Medication';
import { db, auth } from '../firebase';
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

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

/** Build array of HH:mm strings from CSV */
function csvToArray(times?: string): string[] {
  return parseTimesCSV(times).map(
    ({ hour, minute }) => `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
  );
}

/**
 * Create daily repeating triggers for each HH:mm.
 */
function buildDailyTriggers(times: string[]): TimestampTrigger[] {
  const now = new Date();
  return times.map(t => {
    const [hour, minute] = t.split(':').map(Number);
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);
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
  const timesArray = med.times && med.times.length > 0 ? med.times : csvToArray(med.time);
  if (timesArray.length === 0) return [];

  const triggers = buildDailyTriggers(timesArray);

  const androidChannelId = 'notification';
  const groupId = `reminder:${med.id}`;

  const ids: string[] = [];
  for (let i = 0; i < triggers.length; i++) {
    const id = await notifee.createTriggerNotification(
      {
        title: `Time to take ${med.name}`,
        body: med.instructions ?? `Dose ${i + 1}${med.dosage ? ` — ${med.dosage}` : ''}`,
        android: {
          channelId: androidChannelId,
          smallIcon: 'ic_stat_name',
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

    // Store times array alongside CSV
    const timesArray = csvToArray(reminder.time);
    await setDoc(ref, { ...reminder, times: timesArray });

    setReminders(prev => [...prev, { ...reminder, times: timesArray }]);

    await cancelReminderNotifications(reminder.id);
    const ids = await scheduleReminderNotifications({ ...reminder, times: timesArray });
    await saveNotificationIds(reminder.id, ids);
  };

  const updateReminder = async (updated: Medication) => {
    if (!userId) return;
    const ref = doc(db, 'users', userId, 'reminders', updated.id);

    const timesArray = csvToArray(updated.time);
    await updateDoc(ref, { ...updated, times: timesArray });

    setReminders(prev => prev.map(r => (r.id === updated.id ? { ...updated, times: timesArray } : r)));

    await cancelReminderNotifications(updated.id);
    const ids = await scheduleReminderNotifications({ ...updated, times: timesArray });
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