// src/types/MenstrualCycle.ts
export type MenstrualCycle = {
    id: string;
    startDate: string;    // first day of period
    cycleLength?: number; // default 28
    notes?: string;
  
    // Predicted values (calculated, not required)
    predictedLast?: string;  
    predictedHeavy?: string;
    predictedNext?: string;
  };