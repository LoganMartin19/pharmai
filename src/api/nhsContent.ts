import { auth } from '../firebase';

const NHS_CONTENT_URL =
  'https://us-central1-pharmai-d45ab.cloudfunctions.net/nhsContent';

export type NhsContent = {
  name?: string;
  description?: string;
  url?: string;
  dateModified?: string;
  author?: {
    name?: string;
    url?: string;
    logo?: string;
  };
  [key: string]: unknown;
};

export type NhsMedicineSection = {
  title: string;
  text: string;
  healthAspect?: string;
};

export type NhsMedicineInformation = {
  name: string;
  description?: string;
  sourceUrl?: string;
  attributionLogo?: string;
  lastReviewed?: string;
  dateModified?: string;
  sections: NhsMedicineSection[];
};

const NHS_MEDICINE_SLUG_ALIASES: Record<string, string> = {
  paracetamol: 'paracetamol-for-adults',
};

export function medicineNameToNhsSlug(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .split(/\b\d+(?:\.\d+)?\s*(?:micrograms?|mcg|milligrams?|mg|grams?|g|ml|%)\b/i)[0]
    .replace(/\b(?:tablets?|capsules?|oral|solution|suspension|cream|ointment|gel|injection|inhaler|spray)\b.*$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return NHS_MEDICINE_SLUG_ALIASES[slug] || slug;
}

function htmlToText(value: string) {
  return value
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|li|h[1-6])\s*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function collectSections(value: unknown, output: NhsMedicineSection[]) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectSections(item, output));
    return;
  }

  const item = value as Record<string, unknown>;
  const rawText = typeof item.text === 'string' ? item.text : typeof item.description === 'string' ? item.description : '';
  const text = htmlToText(rawText);
  const title = typeof item.name === 'string' ? htmlToText(item.name) : '';
  const healthAspect = typeof item.healthAspect === 'string' ? item.healthAspect : undefined;
  if (title && text && text !== title && !output.some((section) => section.title === title && section.text === text)) {
    output.push({ title, text, healthAspect });
  }

  ['hasPart', 'mainEntityOfPage'].forEach((key) => collectSections(item[key], output));
}

export function parseNhsMedicineContent(content: NhsContent): NhsMedicineInformation {
  const sections: NhsMedicineSection[] = [];
  collectSections(content.hasPart, sections);
  collectSections(content.mainEntityOfPage, sections);
  sections.sort((a, b) => {
    const priority = (section: NhsMedicineSection) => /side.?effects?/i.test(`${section.healthAspect || ''} ${section.title}`) ? 0 : 1;
    return priority(a) - priority(b);
  });
  return {
    name: content.name || 'Medicine information',
    description: content.description,
    sourceUrl: content.url,
    attributionLogo: content.author?.logo,
    lastReviewed: typeof content.lastReviewed === 'string' ? content.lastReviewed : undefined,
    dateModified: content.dateModified,
    sections,
  };
}

export async function getNhsContent(
  path: string,
  query: Record<string, string | number | boolean> = {},
): Promise<NhsContent> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('You must be signed in to view NHS content.');

  const url = new URL(NHS_CONTENT_URL);
  url.searchParams.set('path', path);
  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('NHS content is temporarily unavailable.');
  return response.json();
}

export function getNhsMedicine(slug: string, modules = true) {
  return getNhsContent(`medicines/${slug}`, { modules });
}

export async function getNhsMedicineInformation(nameOrSlug: string) {
  const slug = medicineNameToNhsSlug(nameOrSlug);
  if (!slug) throw new Error('A medicine name is required.');
  return parseNhsMedicineContent(await getNhsMedicine(slug, true));
}

export function getNhsCondition(slug: string, modules = true) {
  return getNhsContent(`conditions/${slug}`, { modules });
}
