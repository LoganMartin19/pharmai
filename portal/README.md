# PharmAI Partner Portal

Browser portal for pharmacy partners and PharmAI internal administrators.

## Local setup

```bash
npm install
npm run dev
```

Build with `npm run build`. Firebase Hosting serves `portal/dist`.

## Access model

- Internal administrators require a Firebase Auth custom claim: `{ admin: true }`.
- Pharmacy users require an active document at `pharmacyOrganisations/{orgId}/members/{uid}`.
- Assign the first administrator claim only from a trusted Admin SDK environment or Firebase Auth administration process. Never add a public bootstrap route.
- An internal administrator can then create organisations and add existing Firebase users through Partnerships.

## Deployment

```bash
firebase deploy --only functions:adminMetrics,functions:adminProvisionPortal,functions:pharmacyPortalAction,functions:syncPharmacyPatientShare,firestore:rules,firestore:indexes
npm run build --prefix portal
firebase deploy --only hosting
```

Review `docs/pharmacy-portal-security.md` before any live pilot.
## Environments

- Production alias: `pharmai-d45ab` (`firebase use prod`)
- Staging alias: `pharmai-staging-2026` (`firebase use staging`)
- Copy `.env.example` to an ignored environment file. Never point a staging build at production.
- Build staging with `npm run build -- --mode staging`.

The staging project must be upgraded to Firebase Blaze before Cloud Functions can be deployed. Enable Email/Password authentication, configure MFA and register reCAPTCHA Enterprise App Check in the Firebase console before inviting testers. Turn on App Check enforcement only after clients are confirmed to send valid tokens.
