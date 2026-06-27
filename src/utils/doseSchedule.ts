import type { Medication } from '../types/Medication';

export const DOSE_ICONS = {
  morning: '🌅',
  afternoon: '☀️',
  evening: '🌆',
  night: '🌙',
  dose: '💊',
} as const;

export function doseCount(frequency?: Medication['frequency']) {
  if (frequency === 'Twice daily') return 2;
  if (frequency === 'Three times daily') return 3;
  if (frequency === 'Four times daily') return 4;

  const match = String(frequency ?? '').match(/^(\d+)\s+times\s+daily$/i);
  if (match) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return 1;
}

export function medicationTimes(medication: Pick<Medication, 'time' | 'times' | 'frequency'>) {
  const fromArray = Array.isArray(medication.times) ? medication.times : [];
  const fromString = medication.time
    ? String(medication.time).split(',').map((part) => part.trim()).filter(Boolean)
    : [];
  const times = fromArray.length ? fromArray : fromString;
  const count = doseCount(medication.frequency);
  return Array.from({ length: count }, (_, index) => times[index]);
}

export function dosePeriod(time?: string) {
  const match = String(time ?? '').trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) return undefined;

  let hour = Number(match[1]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;

  if (hour >= 5 && hour < 12) return { label: 'Morning', icon: DOSE_ICONS.morning };
  if (hour >= 12 && hour < 17) return { label: 'Afternoon', icon: DOSE_ICONS.afternoon };
  if (hour >= 17 && hour < 21) return { label: 'Evening', icon: DOSE_ICONS.evening };
  return { label: 'Night', icon: DOSE_ICONS.night };
}

export function doseLabel(time: string | undefined, index: number) {
  return dosePeriod(time)?.label ?? `Dose ${index + 1}`;
}

export function doseIcon(time: string | undefined) {
  return dosePeriod(time)?.icon ?? DOSE_ICONS.dose;
}
