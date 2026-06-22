// App.tsx
import React, { useEffect } from 'react';
import { RemindersProvider } from './src/context/RemindersContext';
import { NavigationContainer } from '@react-navigation/native';
import MainNavigator from './src/navigation/MainNavigator';
import { UserProvider } from './src/context/UserContext';
import useCareInbox from './src/hooks/useCareInbox';
import { auth } from './src/firebase';
import { registerExpoPushToken } from './src/utils/expoPush';

import {
  requestNotificationPermission,
  setupNotificationChannel,
  registerForegroundNotificationHandlers,
} from './src/utils/notifications';

export default function App() {
  useCareInbox();

  useEffect(() => {
    (async () => {
      await setupNotificationChannel();
      await requestNotificationPermission();
      registerForegroundNotificationHandlers();
    })();
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) return;
      registerExpoPushToken().catch((error) => {
        console.warn('Expo push token registration failed', error);
      });
    });

    return () => unsubscribe();
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
