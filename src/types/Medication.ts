// src/types/Medication.ts
import type { PillStyle } from './PillStyle';

export type Medication = {
  id: string;
  name: string;
  dosage: string;

  /**
   * CSV of times for legacy UI input, e.g. "08:00, 20:00".
   * Kept for backwards compatibility with existing screens.
   */
  time?: string;

  /**
   * Normalized times used by scheduling + backend checks.
   * Each entry must be "HH:mm" in 24h format, e.g. ["08:00","14:00","20:00"].
   */
  times?: string[];

  frequency?: 'Once daily' | 'Twice daily' | 'Three times daily';
  instructions?: string;
  taken?: boolean;
  repeatPrescription?: boolean;
  startDate?: string;   // ISO date "YYYY-MM-DD"
  endDate?: string;     // ISO date "YYYY-MM-DD"
  pillStyle?: PillStyle;

  history: { date: string; taken: boolean[] }[];
};