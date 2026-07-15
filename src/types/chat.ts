export type Role = 'user' | 'assistant';

export interface Msg {
  role: Role;
  content: string;
  nhsAttribution?: {
    sourceUrl: string;
    logoUrl?: string | null;
    label: string;
  };
}
