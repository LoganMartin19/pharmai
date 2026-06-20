// App.tsx
import React, { useEffect } from 'react';
import { RemindersProvider } from './src/context/RemindersContext';
import { NavigationContainer } from '@react-navigation/native';
import MainNavigator from './src/navigation/MainNavigator';
import { UserProvider } from './src/context/UserContext';
import useCareInbox from './src/hooks/useCareInbox';

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
