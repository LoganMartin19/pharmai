// utils/careApi.ts
import { doc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

const CREATE_INVITE_URL = 'https://createinvite-b7oxnbcw3q-uc.a.run.app';
const ACCEPT_INVITE_URL = 'https://acceptinvite-b7oxnbcw3q-uc.a.run.app';

function randomInviteId(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function createInvite() {
  const user = auth.currentUser!;
  const token = await user.getIdToken();
  try {
    const res = await fetch(CREATE_INVITE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<{ inviteId: string; expiresAt: string }>;
  } catch (error) {
    const inviteId = randomInviteId();
    const expires = new Date(Date.now() + 30 * 60 * 1000);
    await setDoc(doc(db, 'careInvites', inviteId), {
      patientUid: user.uid,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expires),
      status: 'active',
    });
    return { inviteId, expiresAt: expires.toISOString() };
  }
}

export async function acceptInvite(inviteId: string, displayName?: string) {
  const user = auth.currentUser!;
  const token = await user.getIdToken();
  const res = await fetch(ACCEPT_INVITE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ inviteId, caregiverDisplayName: displayName })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{ ok: true; patientUid: string }>;
}
