export type Role = 'user' | 'assistant';

export interface Msg {
  role: Role;
  content: string;
}