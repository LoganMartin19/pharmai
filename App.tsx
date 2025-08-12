import React, { useEffect } from 'react';
import { RemindersProvider } from './src/context/RemindersContext';
import { NavigationContainer } from '@react-navigation/native';
import MainNavigator from './src/navigation/MainNavigator';
import { UserProvider } from './src/context/UserContext';

// ✅ Import notification helpers
import { requestNotificationPermission, setupNotificationChannel } from './src/utils/notifications';

export default function App() {
  useEffect(() => {
    // Ask for notification permission & prepare Android channel
    requestNotificationPermission();
    setupNotificationChannel();
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