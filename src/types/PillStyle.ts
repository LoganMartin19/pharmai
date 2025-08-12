// src/types/PillStyle.ts
export type PillShape =
  | 'capsule'
  | 'round'
  | 'oval'
  | 'rectangle'
  | 'diamond'
  | 'triangle'
  | 'drop'
  | 'bottle'
  | 'jar'
  | 'syringe'
  | 'spoon'
  | 'tube';

export type PillStyle = {
  shape: PillShape;
  color: string;     // hex (e.g. #22A2FF)
  borderColor?: string; // optional accent
};