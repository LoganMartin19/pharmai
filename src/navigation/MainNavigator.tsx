import React from 'react';
import { Text, Pressable } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

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
import CareLinkScreen from '../screens/CareLinkScreen';
import CarePatientScreen from '../screens/CarePatientScreen';
import AdherenceAnalyticsScreen from '../screens/AdherenceAnalyticsScreen';
import HealthNavigator from './HealthNavigator';
import HomeHealthHeader from '../components/HomeHealthHeader';
import type { Medication } from '../types/Medication';
import type { PillStyle } from '../types/PillStyle';

/* -------------------- Types -------------------- */
export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  SignUp: undefined;
  ResetPassword: undefined;
  Main: undefined;
  Scan: undefined;
  MedicationTracker: { medication: Medication };
  AdherenceAnalytics: undefined;
  AddReminder:
    | {
        medication?: Medication; // editing existing item
        prefill?: Partial<Medication> & { pillStyle?: PillStyle }; // from Scan
      }
    | undefined;
  Chat: { contextMedication?: Medication } | undefined;
  CareLink: undefined; // NEW
  CarePatient: { patientUid: string; displayName?: string | null };
};

export type HomeTabParamList = {
  Home: undefined;
  Reminders: undefined;
  Chat: undefined;
  Settings: undefined;
  Health: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<HomeTabParamList>();

/* -------------------- Header button that uses ROOT navigation -------------------- */
function CareHeaderButton() {
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <Pressable
      onPress={() => rootNav.navigate('CareLink')}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#E8F0FF',
        borderRadius: 8,
        marginRight: 8,
      }}
    >
      <Text style={{ color: '#0A84FF', fontWeight: '700' }}>Care</Text>
    </Pressable>
  );
}

/* -------------------- Tabs -------------------- */
function HomeTab() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const emoji =
          route.name === 'Home' ? '🏠' :
          route.name === 'Reminders' ? '📅' :
          route.name === 'Chat' ? '💬' :
          route.name === 'Settings' ? '⚙️' :
          route.name === 'Health' ? '🩺' :
          '❓';
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
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerShown: true,          // show header only on Home tab
          headerTitle: 'Home',
          headerRight: () => <CareHeaderButton />, // uses ROOT stack to navigate
        }}
      />
      <Tab.Screen name="Reminders" component={RemindersScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
      <Tab.Screen name="Health" component={HealthNavigator} />
    </Tab.Navigator>
  );
}

/* -------------------- Root stack -------------------- */
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
      <RootStack.Screen name="AdherenceAnalytics" component={AdherenceAnalyticsScreen} />
      <RootStack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
      <RootStack.Screen
        name="CareLink"
        component={CareLinkScreen}
        options={{ title: 'Care Connections' }}
      />
      <RootStack.Screen
        name="CarePatient"
        component={CarePatientScreen}
        options={{ headerBackTitle: 'Back' }}
      />
    </RootStack.Navigator>
  );
}