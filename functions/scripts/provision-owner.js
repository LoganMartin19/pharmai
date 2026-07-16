const admin = require("firebase-admin");

const OWNER_EMAIL = "logan@pharmai.co.uk";
const INTERNAL_ORG_ID = "pharmai-internal";

async function main() {
  admin.initializeApp();
  const auth = admin.auth();
  const db = admin.firestore();
  const user = await auth.getUserByEmail(OWNER_EMAIL);

  if (user.disabled) throw new Error(`${OWNER_EMAIL} is disabled`);
  if (!user.emailVerified) {
    throw new Error(`${OWNER_EMAIL} must verify its email before owner access is granted`);
  }

  await auth.setCustomUserClaims(user.uid, {
    ...(user.customClaims || {}),
    admin: true,
  });

  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  batch.set(db.doc(`pharmacyOrganisations/${INTERNAL_ORG_ID}`), {
    name: "PharmAI Internal",
    status: "internal",
    primaryContactEmail: OWNER_EMAIL,
    updatedAt: now,
  }, { merge: true });
  batch.set(db.doc(`pharmacyOrganisations/${INTERNAL_ORG_ID}/members/${user.uid}`), {
    uid: user.uid,
    email: OWNER_EMAIL,
    displayName: user.displayName || "Logan Martin",
    role: "org_admin",
    active: true,
    branchIds: [],
    updatedAt: now,
  }, { merge: true });
  await batch.commit();

  console.log(`Provisioned ${OWNER_EMAIL} for /admin and /pharmacy-portal/login`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
