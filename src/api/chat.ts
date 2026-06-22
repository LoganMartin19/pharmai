import { auth } from '../firebase';
import type { Msg } from '../types/chat';

const CHAT_URLS = [
  'https://chat-b7oxnbcw3q-uc.a.run.app/chat',
  'https://us-central1-pharmai-d45ab.cloudfunctions.net/chat',
];

export async function sendChatMessage(messages: Msg[], chatId?: string): Promise<{ reply: string; chatId?: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('User not logged in');
  const token = await user.getIdToken();

  let lastError: unknown;

  for (const url of CHAT_URLS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages, chatId }),
      });

      if (!res.ok) throw new Error(`HTTP error! ${res.status}`);
      return res.json();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('Chat request failed');
}
