import { auth } from '../firebase';
import type { Msg } from '../types/chat';

const CHAT_URL = 'https://chat-b7oxnbcw3q-uc.a.run.app/chat';

export async function sendChatMessage(messages: Msg[], chatId?: string): Promise<{ reply: string; chatId?: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('User not logged in');
  const token = await user.getIdToken();

  const res = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages, chatId }),
  });

  if (!res.ok) throw new Error(`HTTP error! ${res.status}`);
  return res.json();
}
