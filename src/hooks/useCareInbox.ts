// src/hooks/useCareInbox.ts
import { useEffect } from 'react';
import notifee from '@notifee/react-native';
import { auth, db } from '../firebase';
import {
  collection,
  onSnapshot,
  query,
  where,
  updateDoc,
  DocumentData,
  Unsubscribe,
} from 'firebase/firestore';

/**
 * Listens for caregiver inbox events (e.g., missed doses) and
 * shows a local notification once per item, then marks it delivered.
 *
 * Expected doc shape in users/{uid}/inbox/{docId}:
 * {
 *   type: 'missedDose',
 *   patientName?: string,
 *   medName?: string,
 *   delivered: boolean,  // false until shown
 *   createdAt: number|Timestamp
 * }
 */
export default function useCareInbox() {
  useEffect(() => {
    let unsubAuth: Unsubscribe | undefined;
    let unsubInbox: Unsubscribe | undefined;

    // react to sign-in changes
    unsubAuth = auth.onAuthStateChanged((u) => {
      // clean previous listener if user switches
      if (unsubInbox) {
        unsubInbox();
        unsubInbox = undefined;
      }
      if (!u) return;

      const inboxRef = collection(db, 'users', u.uid, 'inbox');
      const q = query(inboxRef, where('delivered', '==', false));

      unsubInbox = onSnapshot(q, (snap) => {
        snap.docChanges().forEach(async (change) => {
          if (change.type !== 'added') return;

          const data = change.doc.data() as DocumentData;

          // build a friendly notification
          if (data?.type === 'missedDose') {
            const who = data.patientName || 'Patient';
            const what = data.medName || 'a dose';
            try {
              await notifee.displayNotification({
                title: 'Missed dose alert',
                body: `${who} missed ${what}`,
                android: { channelId: 'notification' },
                ios: { sound: 'default' },
              });
            } catch (e) {
              // don't block marking delivered if display fails
              console.warn('notifee display failed', e);
            }
          }

          // mark as delivered so we don't notify again
          try {
            await updateDoc(change.doc.ref, { delivered: true });
          } catch (e) {
            console.warn('inbox mark delivered failed', e);
          }
        });
      });
    });

    return () => {
      if (unsubInbox) unsubInbox();
      if (unsubAuth) unsubAuth();
    };
  }, []);
}