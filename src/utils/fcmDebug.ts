import messaging from '@react-native-firebase/messaging';
import { auth, db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

export async function registerCaregiverTokenNow() {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');

  // iOS requires this
  await messaging().registerDeviceForRemoteMessages();

  // Request permissions if needed
  const authStatus = await messaging().requestPermission();
  if (
    authStatus !== messaging.AuthorizationStatus.AUTHORIZED &&
    authStatus !== messaging.AuthorizationStatus.PROVISIONAL
  ) {
    throw new Error('Push permission not granted');
  }

  // Get FCM token
  const token = await messaging().getToken();
  if (!token) throw new Error('No FCM token received');

  // Store in Firestore under /users/{uid}/fcmTokens/{token}
  await setDoc(doc(db, 'users', user.uid, 'fcmTokens', token), {
    token,
    createdAt: new Date().toISOString(),
    platform: 'ios',
  });

  return token;
}