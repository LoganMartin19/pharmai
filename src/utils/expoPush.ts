import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId
  );
}

export async function registerExpoPushToken() {
  const user = auth.currentUser;
  if (!user) return null;

  const projectId = getProjectId();
  if (!projectId) {
    console.warn('Expo projectId missing; cannot register push token');
    return null;
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('care-alerts', {
      name: 'Care alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0A84FF',
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const tokenId = token.replace(/[/.#[\]]/g, '_');

  await setDoc(
    doc(db, 'users', user.uid, 'expoPushTokens', tokenId),
    {
      token,
      platform: Platform.OS,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return token;
}
