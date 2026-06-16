// src/context/RemindersContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { Medication } from '../types/Medication';
import { db, auth } from '../firebase';
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  cancelReminderNotifications,
  scheduleReminderNotifications,
} from '../utils/notifications';

// ---- Types & Context ----
type RemindersContextType = {
  reminders: Medication[];
  addReminder: (reminder: Medication) => Promise<void>;
  updateReminder: (updated: Medication) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
};

const RemindersContext = createContext<RemindersContextType | undefined>(undefined);

function parseTimesCSV(times?: string): { hour: number; minute: number }[] {
  if (!times) return [];
  return times
    .split(',')
    .map(s => s.trim())
    .map(t => {
      const match = t.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
      if (!match) return null;

      let hour = Number(match[1]);
      const minute = Number(match[2]);
      const meridiem = match[3]?.toUpperCase();

      if (meridiem === 'PM' && hour < 12) hour += 12;
      if (meridiem === 'AM' && hour === 12) hour = 0;

      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) return { hour, minute };
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

function normalizeReminderTimes(med: Medication): string[] {
  const fromTime = csvToArray(med.time);
  if (fromTime.length > 0) return fromTime;
  return (med.times ?? []).flatMap((time) => csvToArray(time));
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
    const timesArray = normalizeReminderTimes(reminder);
    await setDoc(ref, { ...reminder, times: timesArray });

    setReminders(prev => [...prev, { ...reminder, times: timesArray }]);

    await cancelReminderNotifications(reminder.id);
    await scheduleReminderNotifications({ ...reminder, times: timesArray });
  };

  const updateReminder = async (updated: Medication) => {
    if (!userId) return;
    const ref = doc(db, 'users', userId, 'reminders', updated.id);

    const timesArray = normalizeReminderTimes(updated);
    await updateDoc(ref, { ...updated, times: timesArray });

    setReminders(prev => prev.map(r => (r.id === updated.id ? { ...updated, times: timesArray } : r)));

    await cancelReminderNotifications(updated.id);
    await scheduleReminderNotifications({ ...updated, times: timesArray });
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
