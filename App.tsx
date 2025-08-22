// App.tsx
import React, { useEffect } from 'react';
import { RemindersProvider } from './src/context/RemindersContext';
import { NavigationContainer } from '@react-navigation/native';
import MainNavigator from './src/navigation/MainNavigator';
import { UserProvider } from './src/context/UserContext';

import {
  requestNotificationPermission,
  setupNotificationChannel,
  registerForegroundNotificationHandlers,
} from './src/utils/notifications';

import messaging from '@react-native-firebase/messaging';
import { auth, db } from './src/firebase';
import { doc, setDoc } from 'firebase/firestore';

async function upsertFcmToken(uid: string) {
  try {
    await messaging().requestPermission();
    const token = await messaging().getToken();
    if (token) {
      await setDoc(
        doc(db, 'users', uid, 'fcmTokens', token),
        { createdAt: Date.now() },
        { merge: true }
      );
    }
  } catch (e) {
    console.warn('FCM token register failed', e);
  }
}

export default function App() {
  useEffect(() => {
    (async () => {
      await setupNotificationChannel();
      await requestNotificationPermission();
      registerForegroundNotificationHandlers();

      if (auth.currentUser?.uid) {await upsertFcmToken(auth.currentUser.uid);}
    })();

    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user?.uid) {
        await upsertFcmToken(user.uid);

        const unsubRefresh = messaging().onTokenRefresh(async (newToken) => {
          if (newToken) {
            await setDoc(
              doc(db, 'users', user.uid, 'fcmTokens', newToken),
              { createdAt: Date.now(), refreshed: true },
              { merge: true }
            );
          }
        });

        return () => unsubRefresh();
      }
    });

    return () => unsubAuth();
  }, []);

  return (
    <UserProvider>
      <RemindersProvider>
        <NavigationContainer>
          <MainNavigator />
        </NavigationContainer>
      </RemindersProvider>
    </UserProvider>
  );
}