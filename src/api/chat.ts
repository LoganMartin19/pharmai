import auth from '@react-native-firebase/auth';

const CHAT_URL = 'https://chat-b7oxnbcw3q-uc.a.run.app/chat';

export async function sendChatMessage(messages) {
  const user = auth().currentUser;
  if (!user) throw new Error('User not logged in');
  const token = await user.getIdToken();

  const res = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) throw new Error(`HTTP error! ${res.status}`);
  return (await res.json()).reply;
}