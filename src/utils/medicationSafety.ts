import type { Medication } from '../types/Medication';

export type MedicationSafetyInfo = {
  title: string;
  notes: string[];
  cautions: string[];
  askPharmacist: string[];
};

const SAFETY_LIBRARY: Array<{
  match: RegExp;
  notes: string[];
  cautions: string[];
  askPharmacist: string[];
}> = [
  {
    match: /paracetamol|acetaminophen/i,
    notes: ['Often used for pain or fever.', 'Check other medicines for paracetamol/acetaminophen to avoid doubling up.'],
    cautions: ['Avoid exceeding the label dose.', 'Be extra careful with liver disease or heavy alcohol use.'],
    askPharmacist: ['You are taking cold/flu products.', 'Pain or fever persists longer than expected.'],
  },
  {
    match: /ibuprofen|naproxen|aspirin/i,
    notes: ['NSAIDs may help with pain and inflammation.', 'Take with food or milk if it upsets your stomach.'],
    cautions: ['May not be suitable with stomach ulcers, kidney disease, blood thinners, or some heart conditions.'],
    askPharmacist: ['You take anticoagulants.', 'You have asthma triggered by anti-inflammatory medicines.'],
  },
  {
    match: /amoxicillin|penicillin|flucloxacillin|cefalexin|cephalexin/i,
    notes: ['Antibiotics work best when taken evenly and finished as prescribed.', 'Set reminders for every dose.'],
    cautions: ['Seek urgent help for swelling, breathing difficulty, or severe rash.'],
    askPharmacist: ['You miss multiple doses.', 'You develop severe diarrhoea or signs of allergy.'],
  },
  {
    match: /metformin/i,
    notes: ['Commonly taken with meals to reduce stomach upset.', 'Adherence matters for long-term blood sugar control.'],
    cautions: ['Speak to a clinician if vomiting, dehydration, or severe illness occurs.'],
    askPharmacist: ['You are starting new medicines.', 'Stomach symptoms are persistent.'],
  },
  {
    match: /warfarin|apixaban|rivaroxaban|edoxaban|dabigatran/i,
    notes: ['Anticoagulants reduce clot risk but can increase bleeding risk.', 'Take exactly as prescribed.'],
    cautions: ['Seek urgent help for unusual bleeding, black stools, or head injury.'],
    askPharmacist: ['Before taking painkillers or supplements.', 'If any dose is missed.'],
  },
];

export function getMedicationSafetyInfo(med: Medication): MedicationSafetyInfo {
  const text = `${med.name} ${med.dosage} ${med.instructions ?? ''}`;
  const match = SAFETY_LIBRARY.find((entry) => entry.match.test(text));

  if (match) {
    return {
      title: 'Safety notes',
      notes: match.notes,
      cautions: match.cautions,
      askPharmacist: match.askPharmacist,
    };
  }

  return {
    title: 'Safety notes',
    notes: [
      'Take this medicine exactly as directed on the label or by your clinician.',
      'Keep a consistent routine and use reminders for each dose.',
    ],
    cautions: [
      'Check with a pharmacist before mixing with new medicines, supplements, or alcohol.',
    ],
    askPharmacist: [
      'You are pregnant, breastfeeding, elderly, or managing long-term conditions.',
      'You notice new side effects or are unsure whether to continue.',
    ],
  };
}
