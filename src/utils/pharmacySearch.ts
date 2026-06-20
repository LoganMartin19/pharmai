import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

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
  availabilityStatus?: 'available_now' | 'usually_available' | 'order_by_tomorrow' | 'call_to_confirm' | 'out_of_stock';
  acceptsRefillRequests?: boolean;
  responseWindowMinutes?: number;
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
const SEARCH_RADIUS_METERS = 10000;

type SponsoredPartner = {
  id: string;
  matcher: string;
  tier: number;
  availabilityStatus?: Pharmacy['availabilityStatus'];
  acceptsRefillRequests?: boolean;
  responseWindowMinutes?: number;
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
          matcher: String(data.matcher || data.name || '').trim().toLowerCase(),
          tier: Math.max(1, Number(data.tier || 1)),
          availabilityStatus,
          acceptsRefillRequests: data.acceptsRefillRequests !== false,
          responseWindowMinutes: Number(data.responseWindowMinutes || 60),
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

  return {
    id: `${element.type}-${element.id}`,
    name,
    latitude,
    longitude,
    distanceMiles: distanceMiles(origin, { latitude, longitude }),
    address: formatAddress(tags) || undefined,
    phone: tags.phone || tags['contact:phone'],
    openingHours: tags.opening_hours,
    sponsored: typeof partner?.tier === 'number',
    partnerTier: partner?.tier,
    partnerId: partner?.id,
    availabilityStatus: partner?.availabilityStatus,
    acceptsRefillRequests: partner?.acceptsRefillRequests,
    responseWindowMinutes: partner?.responseWindowMinutes,
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
  const pharmacies = ((json.elements ?? []) as OverpassElement[])
    .map((element) => parsePharmacy(element, location, partners))
    .filter((pharmacy): pharmacy is Pharmacy => !!pharmacy)
    .sort((a, b) => {
      const tierA = a.partnerTier ?? Number.MAX_SAFE_INTEGER;
      const tierB = b.partnerTier ?? Number.MAX_SAFE_INTEGER;
      if (tierA !== tierB) return tierA - tierB;
      return a.distanceMiles - b.distanceMiles;
    });

  return pharmacies.slice(0, 20);
}
