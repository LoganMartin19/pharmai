import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';

const projectId = 'pharmai-d45ab';
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
after(async () => env.cleanup());
beforeEach(async () => env.clearFirestore());

async function seed(path, data) {
  await env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), path), data));
}

describe('patient isolation', () => {
  test('patient reads own reminder but not another patient reminder', async () => {
    await seed('users/patient-a/reminders/med-1', { name: 'Medicine' });
    const own = env.authenticatedContext('patient-a').firestore();
    const other = env.authenticatedContext('patient-b').firestore();
    await assertSucceeds(getDoc(doc(own, 'users/patient-a/reminders/med-1')));
    await assertFails(getDoc(doc(other, 'users/patient-a/reminders/med-1')));
  });
});

describe('pharmacy tenant access', () => {
  test('member collection-group lookup only returns the signed-in membership', async () => {
    await seed('pharmacyOrganisations/org-a/members/staff-a', { uid: 'staff-a', active: true, role: 'pharmacist' });
    await seed('pharmacyOrganisations/org-b/members/staff-b', { uid: 'staff-b', active: true, role: 'pharmacist' });
    const db = env.authenticatedContext('staff-a').firestore();
    const snap = await assertSucceeds(getDocs(query(collectionGroup(db, 'members'), where('uid', '==', 'staff-a'), where('active', '==', true))));
    assert.equal(snap.size, 1);
  });

  test('staff cannot read another pharmacy patient share', async () => {
    await seed('pharmacyOrganisations/org-a/members/staff-a', { uid: 'staff-a', active: true, role: 'pharmacist' });
    await seed('pharmacyPatientShares/share-b', { patientUid: 'patient-b', pharmacyOrgId: 'org-b', active: true });
    const db = env.authenticatedContext('staff-a').firestore();
    await assertFails(getDoc(doc(db, 'pharmacyPatientShares/share-b')));
  });

  test('browser pharmacy staff cannot directly manufacture pickup events', async () => {
    await seed('pharmacyOrganisations/org-a/members/staff-a', { uid: 'staff-a', active: true, role: 'pharmacist' });
    const db = env.authenticatedContext('staff-a').firestore();
    await assertFails(addDoc(collection(db, 'prescriptionPickupEvents'), {
      patientUid: 'patient-a', pharmacyOrgId: 'org-a', shareId: 'share-a', source: 'browser',
    }));
  });
});

describe('consent scopes', () => {
  test('patient can create an expiring allow-listed consent', async () => {
    const db = env.authenticatedContext('patient-a').firestore();
    await assertSucceeds(addDoc(collection(db, 'patientPharmacyConsents'), {
      patientUid: 'patient-a', pharmacyOrgId: 'org-a', active: true,
      scopes: ['medicine_identity', 'pickup_confirmation'],
      expiresAt: Timestamp.fromMillis(Date.now() + 86_400_000),
    }));
  });

  test('unknown consent scope is rejected', async () => {
    const db = env.authenticatedContext('patient-a').firestore();
    await assertFails(addDoc(collection(db, 'patientPharmacyConsents'), {
      patientUid: 'patient-a', pharmacyOrgId: 'org-a', active: true,
      scopes: ['raw_dose_history'], expiresAt: Timestamp.fromMillis(Date.now() + 86_400_000),
    }));
  });
});

describe('PharmAI administration', () => {
  test('only admin claim can read audit events', async () => {
    await seed('auditEvents/event-1', { action: 'test' });
    const adminDb = env.authenticatedContext('admin-a', { admin: true }).firestore();
    const userDb = env.authenticatedContext('user-a').firestore();
    await assertSucceeds(getDoc(doc(adminDb, 'auditEvents/event-1')));
    await assertFails(getDoc(doc(userDb, 'auditEvents/event-1')));
  });
});
