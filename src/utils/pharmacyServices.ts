export type PharmacyServiceSource = 'verified' | 'osm' | 'nhs_general';

export type PharmacyServiceId =
  | 'prescription_refill'
  | 'pharmacy_first'
  | 'contraceptive_pill'
  | 'emergency_contraception'
  | 'blood_pressure'
  | 'flu_vaccine'
  | 'covid_tests'
  | 'new_medicine_service'
  | 'medicine_disposal'
  | 'weight_management'
  | 'stop_smoking'
  | 'chlamydia'
  | 'cholesterol_blood_sugar'
  | 'substance_misuse'
  | 'delivery'
  | 'wheelchair_access'
  | 'private_consultations';

export type PharmacyService = {
  id: PharmacyServiceId;
  label: string;
  icon: string;
  source: PharmacyServiceSource;
};

export const PHARMACY_SERVICE_META: Record<PharmacyServiceId, { label: string; icon: string }> = {
  prescription_refill: { label: 'Refills', icon: 'Rx' },
  pharmacy_first: { label: 'Pharmacy First', icon: '+' },
  contraceptive_pill: { label: 'Contraceptive pill', icon: 'Pill' },
  emergency_contraception: { label: 'Emergency contraception', icon: 'EC' },
  blood_pressure: { label: 'Blood pressure', icon: 'BP' },
  flu_vaccine: { label: 'Flu vaccine', icon: 'Flu' },
  covid_tests: { label: 'COVID tests', icon: 'Test' },
  new_medicine_service: { label: 'New Medicine Service', icon: 'NMS' },
  medicine_disposal: { label: 'Medicine disposal', icon: 'Bin' },
  weight_management: { label: 'Weight management', icon: 'Wt' },
  stop_smoking: { label: 'Stop smoking', icon: 'Quit' },
  chlamydia: { label: 'Chlamydia service', icon: 'STI' },
  cholesterol_blood_sugar: { label: 'Cholesterol/blood sugar', icon: 'Lab' },
  substance_misuse: { label: 'Substance misuse', icon: 'Care' },
  delivery: { label: 'Delivery', icon: 'Van' },
  wheelchair_access: { label: 'Wheelchair access', icon: 'Acc' },
  private_consultations: { label: 'Private consultations', icon: 'Room' },
};

const NHS_GENERAL_SERVICES: PharmacyServiceId[] = [
  'pharmacy_first',
  'prescription_refill',
  'medicine_disposal',
  'new_medicine_service',
  'emergency_contraception',
  'blood_pressure',
  'contraceptive_pill',
  'weight_management',
  'stop_smoking',
];

const SERVICE_ALIASES: Record<string, PharmacyServiceId> = {
  refill: 'prescription_refill',
  refills: 'prescription_refill',
  prescription_refill: 'prescription_refill',
  prescription_refills: 'prescription_refill',
  pharmacy_first: 'pharmacy_first',
  contraception: 'contraceptive_pill',
  contraceptive_pill: 'contraceptive_pill',
  emergency_contraception: 'emergency_contraception',
  blood_pressure: 'blood_pressure',
  hypertension: 'blood_pressure',
  flu: 'flu_vaccine',
  flu_vaccine: 'flu_vaccine',
  covid_tests: 'covid_tests',
  covid_test: 'covid_tests',
  lateral_flow: 'covid_tests',
  nms: 'new_medicine_service',
  new_medicine_service: 'new_medicine_service',
  medicine_disposal: 'medicine_disposal',
  disposal: 'medicine_disposal',
  weight_management: 'weight_management',
  weight_loss: 'weight_management',
  stop_smoking: 'stop_smoking',
  smoking_cessation: 'stop_smoking',
  chlamydia: 'chlamydia',
  cholesterol: 'cholesterol_blood_sugar',
  blood_sugar: 'cholesterol_blood_sugar',
  substance_misuse: 'substance_misuse',
  needle_exchange: 'substance_misuse',
  delivery: 'delivery',
  wheelchair: 'wheelchair_access',
  wheelchair_access: 'wheelchair_access',
  consultation_room: 'private_consultations',
  private_consultations: 'private_consultations',
};

function makeService(id: PharmacyServiceId, source: PharmacyServiceSource): PharmacyService {
  return { id, source, ...PHARMACY_SERVICE_META[id] };
}

export function normalizeServiceIds(values: unknown): PharmacyServiceId[] {
  if (!Array.isArray(values)) return [];

  return values
    .map((value) => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''))
    .map((value) => SERVICE_ALIASES[value])
    .filter((id): id is PharmacyServiceId => !!id);
}

export function inferOsmServices(tags: Record<string, string>): PharmacyServiceId[] {
  const services = new Set<PharmacyServiceId>();
  const searchable = Object.entries(tags)
    .map(([key, value]) => `${key} ${value}`)
    .join(' ')
    .toLowerCase();

  if (tags.delivery === 'yes' || tags['delivery:medicine'] === 'yes' || tags['healthcare:delivery'] === 'yes') {
    services.add('delivery');
  }
  if (tags.wheelchair === 'yes' || tags.wheelchair === 'limited') services.add('wheelchair_access');
  if (searchable.includes('blood pressure') || searchable.includes('hypertension')) services.add('blood_pressure');
  if (searchable.includes('flu')) services.add('flu_vaccine');
  if (searchable.includes('covid')) services.add('covid_tests');
  if (searchable.includes('needle') || searchable.includes('substance')) services.add('substance_misuse');
  if (searchable.includes('smoking')) services.add('stop_smoking');
  if (searchable.includes('weight')) services.add('weight_management');
  if (searchable.includes('consultation')) services.add('private_consultations');

  return [...services];
}

export function buildPharmacyServices({
  verified,
  osm,
  includeGeneral = true,
}: {
  verified?: PharmacyServiceId[];
  osm?: PharmacyServiceId[];
  includeGeneral?: boolean;
}) {
  const services = new Map<PharmacyServiceId, PharmacyService>();

  if (includeGeneral) {
    NHS_GENERAL_SERVICES.forEach((id) => services.set(id, makeService(id, 'nhs_general')));
  }

  osm?.forEach((id) => services.set(id, makeService(id, 'osm')));
  verified?.forEach((id) => services.set(id, makeService(id, 'verified')));

  return [...services.values()];
}
