// src/api/care.ts
import { auth, db } from '../firebase';
import { getAuth, fetchSignInMethodsForEmail } from 'firebase/auth'; // web SDK you already use
import { doc, setDoc, serverTimestamp, getDocs, query, where, collection } from 'firebase/firestore';

/** Look up caregiver uid by email via your own "users" collection or Auth */
export async function lookupUidByEmail(email: string): Promise<string | null> {
  // If you store user profiles: /users/{uid} { email }
  const q = query(collection(db, 'users'), where('email','==',email));
  const snap = await getDocs(q);
  const match = snap.docs[0];
  return match ? match.id : null;
}

export async function linkCaregiver(caregiverEmail: string) {
  const patient = auth.currentUser;
  if (!patient) throw new Error('Not signed in');

  const caregiverUid = await lookupUidByEmail(caregiverEmail);
  if (!caregiverUid) throw new Error('No account for that email');

  const linkRef = doc(db, 'users', patient.uid, 'careLinks', caregiverUid);
  await setDoc(linkRef, {
    role: 'caregiver',
    createdAt: serverTimestamp(),
  });
}