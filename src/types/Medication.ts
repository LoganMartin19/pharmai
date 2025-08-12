// src/types/Medication.ts
import type { PillStyle } from './PillStyle';

export type Medication = {
  id: string;
  name: string;
  dosage: string;
  time?: string;
  frequency?: 'Once daily' | 'Twice daily' | 'Three times daily';
  instructions?: string;
  taken?: boolean;
  repeatPrescription?: boolean;
  startDate?: string;
  endDate?: string;
  pillStyle?: PillStyle;         // 👈 add this
  history: { date: string; taken: boolean[] }[];
};