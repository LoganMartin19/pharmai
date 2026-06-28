import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseMedicationText } from './medParser';

export type MedicineSuggestion = {
  name: string;
  source: 'NHS Scotland Open Data' | 'Local cache';
};

const NHS_SCOTLAND_RESOURCE_ID = '699a7c07-f514-4b56-804a-3a2dcf282f96';
const NHS_SCOTLAND_DATASTORE_URL = 'https://www.opendata.nhs.scot/api/3/action/datastore_search_sql';
const CACHE_PREFIX = 'medicine-directory-v1';

const SEED_MEDICINES = [
  'Amlodipine',
  'Amoxicillin',
  'Aspirin',
  'Atorvastatin',
  'Azithromycin',
  'Bisoprolol',
  'Cetirizine',
  'Clarithromycin',
  'Co-codamol',
  'Codeine',
  'Doxycycline',
  'Flucloxacillin',
  'Fluconazole',
  'Fluoxetine',
  'Folic acid',
  'Furosemide',
  'Gabapentin',
  'Ibuprofen',
  'Lansoprazole',
  'Levothyroxine',
  'Lisinopril',
  'Metformin',
  'Naproxen',
  'Omeprazole',
  'Paracetamol',
  'Penicillin V',
  'Prednisolone',
  'Ramipril',
  'Salbutamol',
  'Sertraline',
  'Simvastatin',
  'Warfarin',
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function displayName(value: string) {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return cleaned;
  if (cleaned !== cleaned.toUpperCase()) return cleaned;
  return cleaned.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function escapeSqlString(value: string) {
  return value.replace(/'/g, "''");
}

function localMatches(query: string) {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length < 2) return [];

  return SEED_MEDICINES
    .filter((name) => normalize(name).startsWith(normalizedQuery))
    .slice(0, 8)
    .map((name) => ({ name, source: 'Local cache' as const }));
}

async function readCache(cacheKey: string) {
  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    if (!raw) return [];
    const names = JSON.parse(raw);
    if (!Array.isArray(names)) return [];
    return names
      .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
      .map((name) => ({ name, source: 'NHS Scotland Open Data' as const }));
  } catch {
    return [];
  }
}

async function writeCache(cacheKey: string, names: string[]) {
  try {
    await AsyncStorage.setItem(cacheKey, JSON.stringify(names));
  } catch {
    // Cache failures should not block medicine entry.
  }
}

async function fetchNhsScotlandMatches(query: string) {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length < 2) return [];
  const rawQuery = query.trim().toLowerCase();

  const sql = [
    'SELECT DISTINCT "BNFItemDescription"',
    `FROM "${NHS_SCOTLAND_RESOURCE_ID}"`,
    'WHERE',
    `lower("BNFItemDescription") LIKE '${escapeSqlString(rawQuery)}%'`,
    'OR',
    `lower(replace("BNFItemDescription", '-', ' ')) LIKE '${escapeSqlString(normalizedQuery)}%'`,
    'ORDER BY "BNFItemDescription"',
    'LIMIT 12',
  ].join(' ');

  const response = await fetch(`${NHS_SCOTLAND_DATASTORE_URL}?sql=${encodeURIComponent(sql)}`);
  if (!response.ok) throw new Error(`NHS Scotland lookup failed: ${response.status}`);

  const json = await response.json();
  const records = json?.result?.records;
  if (!Array.isArray(records)) return [];

  return records
    .map((record) => record?.BNFItemDescription)
    .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
    .map(displayName);
}

export async function searchMedicineNames(query: string): Promise<MedicineSuggestion[]> {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length < 2) return [];

  const cacheKey = `${CACHE_PREFIX}:${normalizedQuery}`;
  const cached = await readCache(cacheKey);
  const local = localMatches(query);

  try {
    const remoteNames = await fetchNhsScotlandMatches(query);
    await writeCache(cacheKey, remoteNames);

    const remote = remoteNames.map((name) => ({ name, source: 'NHS Scotland Open Data' as const }));
    return mergeSuggestions(remote, local);
  } catch {
    return mergeSuggestions(cached, local);
  }
}

function mergeSuggestions(primary: MedicineSuggestion[], fallback: MedicineSuggestion[]) {
  const seen = new Set<string>();
  return [...primary, ...fallback].filter((item) => {
    const key = normalize(item.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

function candidateQueriesFromText(rawText: string) {
  const parsed = parseMedicationText(rawText);
  const candidates = new Set<string>();

  if (parsed.name) candidates.add(parsed.name);

  rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/[^A-Za-z0-9% ]+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 3)
    .forEach((line) => {
      const beforeDose = line.split(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|%)\b/i)[0].trim();
      const words = (beforeDose || line).split(/\s+/).filter(Boolean);
      if (words[0]?.length >= 3) candidates.add(words[0]);
      if (words.length >= 2) candidates.add(words.slice(0, 2).join(' '));
      if (words.length >= 3) candidates.add(words.slice(0, 3).join(' '));
    });

  return [...candidates]
    .map((candidate) => candidate.trim())
    .filter((candidate) => normalize(candidate).length >= 3)
    .slice(0, 8);
}

export async function findMedicineInText(rawText: string): Promise<MedicineSuggestion | undefined> {
  const textKey = normalize(rawText);
  if (!textKey) return undefined;

  for (const query of candidateQueriesFromText(rawText)) {
    const matches = await searchMedicineNames(query);
    const exactInText = matches.find((match) => textKey.includes(normalize(match.name)));
    if (exactInText) return exactInText;
    if (matches[0]) return matches[0];
  }

  return undefined;
}

export async function isRecognisedMedicineName(name: string) {
  const key = normalize(name);
  if (key.length < 2) return false;

  const matches = await searchMedicineNames(name);
  return matches.some((match) => {
    const matchKey = normalize(match.name);
    return matchKey === key || matchKey.startsWith(`${key} `);
  });
}
