import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import {
  PharmacyService,
  PharmacyServiceId,
  buildPharmacyServices,
  inferOsmServices,
  normalizeServiceIds,
} from './pharmacyServices';

export type Pharmacy = {
  id: string;
  name: string;
  distanceMiles: number;
  latitude: number;
  longitude: number;
  address?: string;
  phone?: string;
  openingHours?: string;
  sponsored?: boolean;
  partnerTier?: number;
  partnerId?: string;
  partnerOrgId?: string;
  availabilityStatus?: 'available_now' | 'usually_available' | 'order_by_tomorrow' | 'call_to_confirm' | 'out_of_stock';
  acceptsRefillRequests?: boolean;
  responseWindowMinutes?: number;
  services?: PharmacyService[];
  scotlandContractorCode?: string;
  postcode?: string;
};

type OverpassElement = {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const NHS_SCOTLAND_ACTIVITY_RESOURCE_ID = 'dedc3aba-9351-412f-b890-7df4f97f3d1a';
const NHS_SCOTLAND_DISPENSER_RESOURCE_ID = 'f1f22bee-6ec2-4d33-a041-9cebaffd992e';
const NHS_SCOTLAND_DATASTORE_SQL_URL = 'https://www.opendata.nhs.scot/api/3/action/datastore_search_sql';
const SEARCH_RADIUS_METERS = 10000;

type NhsScotlandDispenserRecord = {
  DispCode?: string | number;
  DispLocationName?: string;
  DispLocationAddress1?: string;
  DispLocationAddress2?: string;
  DispLocationAddress3?: string;
  DispLocationAddress4?: string;
  DispLocationPostcode?: string;
  DispLocationTelNo?: string;
};

type SponsoredPartner = {
  id: string;
  organisationId?: string;
  matcher: string;
  tier: number;
  availabilityStatus?: Pharmacy['availabilityStatus'];
  acceptsRefillRequests?: boolean;
  responseWindowMinutes?: number;
  services?: PharmacyServiceId[];
  scotlandContractorCode?: string;
};

const AVAILABILITY_STATUSES: Array<NonNullable<Pharmacy['availabilityStatus']>> = [
  'available_now',
  'usually_available',
  'order_by_tomorrow',
  'call_to_confirm',
  'out_of_stock',
];

function timestampMillis(value: any): number | undefined {
  if (!value) return undefined;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceMiles(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
) {
  const earthMiles = 3958.8;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return earthMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatAddress(tags: Record<string, string>) {
  return [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:city'],
    tags['addr:postcode'],
  ]
    .filter(Boolean)
    .join(', ');
}

function normalizePostcode(value?: string) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function extractPostcode(value?: string) {
  const match = String(value || '').match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
  return match ? normalizePostcode(match[0]) : undefined;
}

function normalizeLookupText(value?: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PHARMACY_MATCH_STOP_WORDS = new Set([
  'a',
  'and',
  'chemist',
  'chemists',
  'co',
  'company',
  'department',
  'limited',
  'ltd',
  'pharmacy',
  'pharmacies',
  'plc',
  'stores',
  'store',
  'the',
  'uk',
]);

function lookupTokens(value?: string) {
  return normalizeLookupText(value)
    .split(' ')
    .filter((token) => token.length > 2 && !PHARMACY_MATCH_STOP_WORDS.has(token));
}

function addressNumbers(value?: string) {
  return new Set(String(value || '').match(/\d+[a-z]?/gi)?.map((number) => number.toLowerCase()) ?? []);
}

async function getSponsoredPartners(): Promise<SponsoredPartner[]> {
  try {
    const snap = await getDocs(query(collection(db, 'pharmacyPartners'), where('active', '==', true)));
    const now = Date.now();
    return snap.docs
      .map((docSnap): SponsoredPartner | null => {
        const data = docSnap.data() as any;
        const startsAt = timestampMillis(data.startsAt);
        const endsAt = timestampMillis(data.endsAt);
        if (startsAt && startsAt > now) return null;
        if (endsAt && endsAt < now) return null;
        const availabilityStatus = AVAILABILITY_STATUSES.includes(data.availabilityStatus)
          ? data.availabilityStatus
          : undefined;

        return {
          id: docSnap.id,
          organisationId: data.organisationId ? String(data.organisationId) : undefined,
          matcher: String(data.matcher || data.name || '').trim().toLowerCase(),
          tier: Math.max(1, Number(data.tier || 1)),
          availabilityStatus,
          acceptsRefillRequests: data.acceptsRefillRequests !== false,
          responseWindowMinutes: Number(data.responseWindowMinutes || 60),
          services: normalizeServiceIds(data.services),
          scotlandContractorCode: data.scotlandContractorCode ? String(data.scotlandContractorCode).trim() : undefined,
        };
      })
      .filter((partner): partner is SponsoredPartner => !!partner && partner.matcher.length > 0)
      .sort((a, b) => a.tier - b.tier);
  } catch (e) {
    console.warn('Unable to load sponsored pharmacy partners', e);
    return [];
  }
}

function getPartner(name: string, partners: SponsoredPartner[]) {
  const normalized = name.toLowerCase();
  return partners.find((entry) => normalized.includes(entry.matcher));
}

function numericValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function contractorCodeFromTags(tags: Record<string, string>) {
  const raw =
    tags['ref:nhs_scotland:contractor'] ||
    tags['ref:nhs:contractor'] ||
    tags['ref:nhs'] ||
    tags.ref;
  const match = String(raw || '').match(/\d{3,}/);
  return match?.[0];
}

function escapeSqlString(value: string) {
  return value.replace(/'/g, "''");
}

function selectNhsScotlandDispenserMatch(pharmacy: Pharmacy, candidates: NhsScotlandDispenserRecord[]) {
  const postcode = normalizePostcode(pharmacy.postcode || pharmacy.address);
  if (!postcode) return undefined;

  const pharmacyNameTokens = new Set(lookupTokens(pharmacy.name));
  const pharmacyAddressTokens = new Set(lookupTokens(pharmacy.address));
  const pharmacyNumbers = addressNumbers(pharmacy.address);

  let best: { record: NhsScotlandDispenserRecord; score: number } | undefined;

  candidates.forEach((record) => {
    if (normalizePostcode(record.DispLocationPostcode) !== postcode) return;

    const candidateAddress = [
      record.DispLocationAddress1,
      record.DispLocationAddress2,
      record.DispLocationAddress3,
      record.DispLocationAddress4,
    ]
      .filter((part) => part && part !== 'NA')
      .join(' ');
    const candidateNameTokens = lookupTokens(record.DispLocationName);
    const candidateAddressTokens = lookupTokens(candidateAddress);
    const candidateNumbers = addressNumbers(candidateAddress);

    let score = 50;
    candidateNameTokens.forEach((token) => {
      if (pharmacyNameTokens.has(token)) score += 16;
    });
    candidateAddressTokens.forEach((token) => {
      if (pharmacyAddressTokens.has(token)) score += 5;
    });
    candidateNumbers.forEach((number) => {
      if (pharmacyNumbers.has(number)) score += 14;
    });

    if (!best || score > best.score) best = { record, score };
  });

  return best && best.score >= 66 ? best.record : undefined;
}

function serviceIdsFromActivity(row: Record<string, unknown>): PharmacyServiceId[] {
  const services = new Set<PharmacyServiceId>();

  if (
    numericValue(row.PFPayment) > 0 ||
    numericValue(row.PFItems) > 0 ||
    numericValue(row.PFConsultations) > 0 ||
    numericValue(row.PFItemDispensed) > 0
  ) {
    services.add('pharmacy_first');
  }
  if (numericValue(row.MCRItems) > 0 || numericValue(row.MCRRegistrations) > 0 || numericValue(row.MCRPayment) > 0) {
    services.add('medicines_care_review');
  }
  if (numericValue(row.EHCItems) > 0) services.add('emergency_contraception');
  if (numericValue(row.SmokingCessationItems) > 0 || numericValue(row.SmokingCessationPayment) > 0) {
    services.add('stop_smoking');
  }
  if (
    numericValue(row.MethadoneDispensingFeeNumber) > 0 ||
    numericValue(row.SupervisedDispensingFeeNumber) > 0 ||
    numericValue(row.InstalmentDispensings) > 0
  ) {
    services.add('substance_misuse');
  }

  return [...services];
}

async function getNhsScotlandActivityServices(contractorCodes: string[]) {
  const codes = [...new Set(contractorCodes.filter(Boolean))];
  if (codes.length === 0) return new Map<string, PharmacyServiceId[]>();

  try {
    const quotedCodes = codes.map((code) => `'${escapeSqlString(code)}'`).join(',');
    const sql = [
      'SELECT *',
      `FROM "${NHS_SCOTLAND_ACTIVITY_RESOURCE_ID}"`,
      `WHERE CAST("Contractor" AS TEXT) IN (${quotedCodes})`,
      'ORDER BY "PaidDateMonth" DESC',
      `LIMIT ${Math.max(12, codes.length * 12)}`,
    ].join(' ');

    const response = await fetch(`${NHS_SCOTLAND_DATASTORE_SQL_URL}?sql=${encodeURIComponent(sql)}`);
    if (!response.ok) throw new Error(`NHS Scotland activity lookup failed: ${response.status}`);

    const json = await response.json();
    const records = json?.result?.records;
    if (!Array.isArray(records)) return new Map<string, PharmacyServiceId[]>();

    const latestByContractor = new Map<string, Record<string, unknown>>();
    records.forEach((record) => {
      const code = String(record.Contractor || '').trim();
      if (code && !latestByContractor.has(code)) latestByContractor.set(code, record);
    });

    const servicesByContractor = new Map<string, PharmacyServiceId[]>();
    latestByContractor.forEach((record, code) => {
      servicesByContractor.set(code, serviceIdsFromActivity(record));
    });
    return servicesByContractor;
  } catch (e) {
    console.warn('Unable to load NHS Scotland pharmacy activity', e);
    return new Map<string, PharmacyServiceId[]>();
  }
}

async function getNhsScotlandDispenserMatches(pharmacies: Pharmacy[]) {
  const postcodeByPharmacy = new Map(
    pharmacies
      .map((pharmacy) => [pharmacy.id, normalizePostcode(pharmacy.postcode || pharmacy.address)] as const)
      .filter(([, postcode]) => postcode.length > 0)
  );
  const postcodes = [...new Set([...postcodeByPharmacy.values()])];
  if (postcodes.length === 0) return new Map<string, NhsScotlandDispenserRecord>();

  try {
    const quotedPostcodes = postcodes.map((postcode) => `'${escapeSqlString(postcode)}'`).join(',');
    const sql = [
      'SELECT *',
      `FROM "${NHS_SCOTLAND_DISPENSER_RESOURCE_ID}"`,
      `WHERE UPPER(REPLACE("DispLocationPostcode",' ','')) IN (${quotedPostcodes})`,
      `LIMIT ${Math.max(25, postcodes.length * 6)}`,
    ].join(' ');

    const response = await fetch(`${NHS_SCOTLAND_DATASTORE_SQL_URL}?sql=${encodeURIComponent(sql)}`);
    if (!response.ok) throw new Error(`NHS Scotland dispenser lookup failed: ${response.status}`);

    const json = await response.json();
    const records = json?.result?.records;
    if (!Array.isArray(records)) return new Map<string, NhsScotlandDispenserRecord>();

    const byPostcode = new Map<string, NhsScotlandDispenserRecord[]>();
    records.forEach((record: NhsScotlandDispenserRecord) => {
      const postcode = normalizePostcode(record.DispLocationPostcode);
      if (!postcode) return;
      byPostcode.set(postcode, [...(byPostcode.get(postcode) ?? []), record]);
    });

    const matches = new Map<string, NhsScotlandDispenserRecord>();
    pharmacies.forEach((pharmacy) => {
      const postcode = postcodeByPharmacy.get(pharmacy.id);
      if (!postcode) return;
      const match = selectNhsScotlandDispenserMatch(pharmacy, byPostcode.get(postcode) ?? []);
      if (match) matches.set(pharmacy.id, match);
    });
    return matches;
  } catch (e) {
    console.warn('Unable to load NHS Scotland dispenser details', e);
    return new Map<string, NhsScotlandDispenserRecord>();
  }
}

function parsePharmacy(
  element: OverpassElement,
  origin: { latitude: number; longitude: number },
  partners: SponsoredPartner[]
): Pharmacy | null {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;

  const tags = element.tags ?? {};
  const name = tags.name || tags.brand || 'Pharmacy';
  const partner = getPartner(`${name} ${tags.brand ?? ''}`, partners);
  const scotlandContractorCode = partner?.scotlandContractorCode ?? contractorCodeFromTags(tags);
  const address = formatAddress(tags) || undefined;
  const postcode = extractPostcode(tags['addr:postcode'] || address);

  return {
    id: `${element.type}-${element.id}`,
    name,
    latitude,
    longitude,
    distanceMiles: distanceMiles(origin, { latitude, longitude }),
    address,
    phone: tags.phone || tags['contact:phone'],
    openingHours: tags.opening_hours,
    sponsored: typeof partner?.tier === 'number',
    partnerTier: partner?.tier,
    partnerId: partner?.id,
    partnerOrgId: partner?.organisationId,
    availabilityStatus: partner?.availabilityStatus,
    acceptsRefillRequests: partner?.acceptsRefillRequests,
    responseWindowMinutes: partner?.responseWindowMinutes,
    scotlandContractorCode,
    postcode,
    services: buildPharmacyServices({
      verified: partner?.services,
      osm: inferOsmServices(tags),
    }),
  };
}

export async function findNearbyPharmacies(
  location: { latitude: number; longitude: number }
): Promise<Pharmacy[]> {
  const partners = await getSponsoredPartners();
  const query = `
    [out:json][timeout:15];
    (
      node["amenity"="pharmacy"](around:${SEARCH_RADIUS_METERS},${location.latitude},${location.longitude});
      way["amenity"="pharmacy"](around:${SEARCH_RADIUS_METERS},${location.latitude},${location.longitude});
      relation["amenity"="pharmacy"](around:${SEARCH_RADIUS_METERS},${location.latitude},${location.longitude});
    );
    out center tags 40;
  `;

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) throw new Error(`Pharmacy search failed: HTTP ${res.status}`);

  const json = await res.json();
  const parsedPharmacies = ((json.elements ?? []) as OverpassElement[])
    .map((element) => parsePharmacy(element, location, partners))
    .filter((pharmacy): pharmacy is Pharmacy => !!pharmacy);

  const dispenserMatches = await getNhsScotlandDispenserMatches(parsedPharmacies);
  const pharmaciesWithContractors = parsedPharmacies.map((pharmacy) => {
    const dispenser = dispenserMatches.get(pharmacy.id);
    const contractorCode = pharmacy.scotlandContractorCode || (dispenser?.DispCode ? String(dispenser.DispCode).trim() : undefined);
    return {
      ...pharmacy,
      scotlandContractorCode: contractorCode,
      phone: pharmacy.phone || dispenser?.DispLocationTelNo,
    };
  });

  const activityServices = await getNhsScotlandActivityServices(
    pharmaciesWithContractors.map((pharmacy) => pharmacy.scotlandContractorCode).filter((code): code is string => !!code)
  );

  const pharmacies = pharmaciesWithContractors
    .map((pharmacy) => ({
      ...pharmacy,
      services: buildPharmacyServices({
        verified: pharmacy.services?.filter((service) => service.source === 'verified').map((service) => service.id),
        osm: pharmacy.services?.filter((service) => service.source === 'osm').map((service) => service.id),
        nhsScotlandActivity: pharmacy.scotlandContractorCode
          ? activityServices.get(pharmacy.scotlandContractorCode)
          : undefined,
      }),
    }))
    .sort((a, b) => {
      const tierA = a.partnerTier ?? Number.MAX_SAFE_INTEGER;
      const tierB = b.partnerTier ?? Number.MAX_SAFE_INTEGER;
      if (tierA !== tierB) return tierA - tierB;
      return a.distanceMiles - b.distanceMiles;
    });

  return pharmacies.slice(0, 20);
}
