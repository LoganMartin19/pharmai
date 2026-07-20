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

describe('care notifications', () => {
  test('patient can schedule own care alert but another user cannot', async () => {
    const patientDb = env.authenticatedContext('patient-a').firestore();
    const otherDb = env.authenticatedContext('patient-b').firestore();
    const payload = {
      medId: 'med-1',
      doseIndex: 0,
      doseDate: '2026-07-20',
      dueAt: Timestamp.fromMillis(Date.now() + 60_000),
    };

    await assertSucceeds(
      setDoc(doc(patientDb, 'users/patient-a/carePendingAlerts/med-1_0'), payload)
    );
    await assertFails(
      setDoc(doc(otherDb, 'users/patient-a/carePendingAlerts/med-1_1'), payload)
    );
  });

  test('caregiver can read linked patient medication but cannot alter it', async () => {
    await seed('users/patient-a/careLinks/caregiver-a', { role: 'caregiver' });
    await seed('users/patient-a/reminders/med-1', { name: 'Medicine' });
    const caregiverDb = env.authenticatedContext('caregiver-a').firestore();

    await assertSucceeds(getDoc(doc(caregiverDb, 'users/patient-a/reminders/med-1')));
    await assertFails(
      setDoc(doc(caregiverDb, 'users/patient-a/reminders/med-1'), { name: 'Changed' })
    );
  });

  test('caregiver can read and acknowledge only their own inbox alert', async () => {
    await seed('users/caregiver-a/inbox/alert-1', { unread: true, delivered: false });
    const caregiverDb = env.authenticatedContext('caregiver-a').firestore();
    const otherDb = env.authenticatedContext('caregiver-b').firestore();
    const alertRef = doc(caregiverDb, 'users/caregiver-a/inbox/alert-1');

    await assertSucceeds(getDoc(alertRef));
    await assertSucceeds(setDoc(alertRef, { unread: false, delivered: true }, { merge: true }));
    await assertFails(getDoc(doc(otherDb, 'users/caregiver-a/inbox/alert-1')));
  });

  test('client cannot manufacture a caregiver inbox alert', async () => {
    const caregiverDb = env.authenticatedContext('caregiver-a').firestore();
    await assertFails(
      setDoc(doc(caregiverDb, 'users/caregiver-a/inbox/fake-alert'), {
        type: 'missedDose',
        unread: true,
      })
    );
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
