// utils/careApi.ts
import { auth } from '../firebase';

const BASE = 'https://us-central1-pharmai-d45ab.cloudfunctions.net';

export async function createInvite() {
  const user = auth.currentUser!;
  const token = await user.getIdToken();
  const res = await fetch(`${BASE}/createInvite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{ inviteId: string; expiresAt: string }>;
}

export async function acceptInvite(inviteId: string, displayName?: string) {
  const user = auth.currentUser!;
  const token = await user.getIdToken();
  const res = await fetch(`${BASE}/acceptInvite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ inviteId, caregiverDisplayName: displayName })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{ ok: true; patientUid: string }>;
}