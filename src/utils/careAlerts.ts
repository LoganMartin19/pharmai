// src/utils/careAlerts.ts
import { auth } from '../firebase';
import type { Medication } from '../types/Medication';

const PROJECT_ID = 'pharmai-d45ab';
const REGION = 'us-central1';

// Base for Firebase Functions
const FUNCTIONS_BASE = __DEV__
  // Emulator (ensure you run: firebase emulators:start)
  ? `http://127.0.0.1:5001/${PROJECT_ID}/${REGION}`
  // Deployed URL
  : `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;

function withTimeout<T>(p: Promise<T>, ms = 8000) {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('fetch timeout')), ms)
    ),
  ]);
}

export async function pingCaregivers(med: Medication, doseIndex: number) {
  try {
    const u = auth.currentUser;
    if (!u) return;

    const idToken = await u.getIdToken();
    const todayISO = new Date().toISOString().slice(0, 10);

    const url = `${FUNCTIONS_BASE}/reportMissedDose`;

    const resp = await withTimeout(
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          medId: med.id,
          medName: med.name,
          doseDate: todayISO,
          doseIndex,
        }),
      })
    );

    const json = await resp.json().catch(() => null);
    if (!resp.ok) {
      console.warn('reportMissedDose non-200:', resp.status, json);
    } else {
      console.log('reportMissedDose success:', json);
    }
    return json;
  } catch (e) {
    console.warn('reportMissedDose failed', e);
    return null;
  }
}