import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RemindersScreen from '../screens/RemindersScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SignUpScreen from '../screens/SignUpScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import ChatScreen from '../screens/ChatScreen';
import ScanScreen from '../screens/ScanScreen';
import MedicationTrackerScreen from '../screens/MedicationTrackerScreen';
import AddReminderScreen from '../screens/AddReminderScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';

// MainNavigator.tsx (or wherever RootStackParamList lives)
import type { Medication } from '../types/Medication';
import type { PillStyle } from '../types/PillStyle';

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  SignUp: undefined;
  ResetPassword: undefined;
  Main: undefined;
  Scan: undefined;
  MedicationTracker: { medication: Medication };
  AddReminder:
    | {
        prefill?: Partial<Medication> & { pillStyle?: PillStyle };
      }
    | undefined;
  Chat: { contextMedication?: Medication } | undefined; // 👈 allow passing a med
};

export type HomeTabParamList = {
  Home: undefined;
  Reminders: undefined;
  Chat: undefined;
  Settings: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<HomeTabParamList>();

function HomeTab() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const emoji =
          route.name === 'Home' ? '🏠' :
          route.name === 'Reminders' ? '📅' :
          route.name === 'Chat' ? '💬' :   // “chat bible” per your request
          '⚙️'; // Settings

        return {
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Text style={{ fontSize: size ?? 20, color }}>{emoji}</Text>
          ),
          tabBarActiveTintColor: '#007aff',
          tabBarInactiveTintColor: 'gray',
        };
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Reminders" component={RemindersScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <RootStack.Navigator>
      <RootStack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
      <RootStack.Screen name="SignUp" component={SignUpScreen} options={{ headerShown: false }} />
      <RootStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <RootStack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{ title: 'Reset Password', headerShown: true }}
      />
      <RootStack.Screen name="Main" component={HomeTab} options={{ headerShown: false }} />
      <RootStack.Screen name="Scan" component={ScanScreen} />
      <RootStack.Screen name="MedicationTracker" component={MedicationTrackerScreen} />
      <RootStack.Screen name="AddReminder" component={AddReminderScreen} />
      <RootStack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
    </RootStack.Navigator>
  );
}