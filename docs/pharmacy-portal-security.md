# PharmAI Partner Portal — security and privacy baseline

This is the minimum engineering baseline before live patient or pharmacy use. It does not replace legal, clinical-safety or information-governance review.

## Data boundaries

- Pharmacy users never receive access to raw reminder or dose history.
- A patient creates a time-limited `patientPharmacyConsents` record naming the organisation, branch, medicine and exact scopes.
- The backend derives a minimum-necessary `pharmacyPatientShares` record. Adherence is a 30-day aggregate only.
- Pickup recording requires an active share containing `pickup_confirmation`.
- Revocation disables the derived share.
- Partner data is isolated by `pharmacyOrgId`.
- PharmAI administrators require the Firebase custom claim `admin: true`.

## Required before a live pilot

1. Complete a DPIA and agree controller/processor responsibilities with each partner.
2. Complete clinical risk management under applicable NHS clinical-safety standards, with a named Clinical Safety Officer and hazard log.
3. Complete or confirm the applicable DSP Toolkit scope.
4. Enforce MFA for partner and PharmAI administrator accounts through Identity Platform.
5. Apply least-privilege roles and quarterly access reviews.
6. Set retention periods for requests, support, consent, pickup and audit records.
7. Document subject-access, correction, deletion, incident-response and consent-revocation procedures.
8. Keep patient and medicine data out of notification previews, analytics and error logs.
9. Use separate Firebase projects for development, staging and production.
10. Enable App Check where supported, budget alerts, monitoring, backup tests and breach-response contacts.

## Consent scopes

- `medicine_identity`: share the medicine name.
- `adherence_summary`: share only a calculated aggregate.
- `pickup_confirmation`: allow the selected pharmacy to record collection.
- `nms_follow_up`: allow New Medicine Service follow-up.
- `service_messages`: allow pharmacy service messages.

Consent must be freely given, specific, informed, revocable and expiring. Dispensing must not be conditional on optional adherence sharing.

## Deliberately excluded

- No EPS ordering or prescription authorisation.
- No PMR access or replacement.
- No automated clinical triage or prescribing.
- No assertion of live medicine stock.
- No raw adherence timeline exposed to pharmacies.
