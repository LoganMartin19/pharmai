// src/utils/careAlerts.ts
import { auth } from '../firebase';
import type { Medication } from '../types/Medication';

const REPORT_MISSED_DOSE_URL = 'https://reportmisseddose-b7oxnbcw3q-uc.a.run.app';

function localDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
    const todayISO = localDateISO();

    const resp = await withTimeout(
      fetch(REPORT_MISSED_DOSE_URL, {
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
