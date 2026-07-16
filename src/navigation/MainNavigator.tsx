import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RemindersScreen from '../screens/RemindersScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RefillScreen from '../screens/RefillScreen';
import PharmacyScreen from '../screens/PharmacyScreen';
import SignUpScreen from '../screens/SignUpScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import ChatScreen from '../screens/ChatScreen';
import ScanScreen from '../screens/ScanScreen';
import ScanReviewScreen from '../screens/ScanReviewScreen';
import PharmacyRefillRequestScreen from '../screens/PharmacyRefillRequestScreen';
import PharmacyPortalScreen from '../screens/PharmacyPortalScreen';
import MedicationTrackerScreen from '../screens/MedicationTrackerScreen';
import AddReminderScreen from '../screens/AddReminderScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import CareLinkScreen from '../screens/CareLinkScreen';
import CarePatientScreen from '../screens/CarePatientScreen';
import AdherenceAnalyticsScreen from '../screens/AdherenceAnalyticsScreen';
import HealthNavigator from './HealthNavigator';
import type { Medication } from '../types/Medication';
import type { PillStyle } from '../types/PillStyle';
import type { Pharmacy } from '../utils/pharmacySearch';
import { colors, radius, shadow } from '../theme';

/* -------------------- Types -------------------- */
export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  SignUp: undefined;
  ResetPassword: undefined;
  Main: undefined;
  Scan: undefined;
  ScanReview: {
    rawText: string;
    parsed: Partial<Medication>;
  };
  PharmacyRefillRequest: { pharmacy: Pharmacy; medicationId?: string };
  PharmacyPortal: undefined;
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
  Refills: undefined;
  Pharmacy: undefined;
  Chat: undefined;
  Settings: undefined;
  Health: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<HomeTabParamList>();

function HeaderBackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={{ top: 12, right: 16, bottom: 12, left: 16 }}
      onPress={onPress}
      style={navStyles.headerBackButton}
    >
      <Text style={navStyles.headerBackText}>‹ Back</Text>
    </Pressable>
  );
}

/* -------------------- Tabs -------------------- */
function HomeTab() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const icon = route.name === 'Home' ? 'home' : route.name === 'Reminders' ? 'calendar' : route.name === 'Refills' ? 'repeat' : route.name === 'Pharmacy' ? 'medical' : route.name === 'Chat' ? 'chatbubble-ellipses' : route.name === 'Settings' ? 'person-circle' : 'heart';
        return {
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name={icon} size={size ?? 22} color={color} />,
          tabBarActiveTintColor: colors.brand,
          tabBarInactiveTintColor: '#7A8B85',
          tabBarLabelStyle: { fontSize: 10, fontWeight: '700', marginTop: 2 },
          tabBarStyle: { position: 'absolute', left: 12, right: 12, bottom: 8, height: 68, paddingTop: 8, paddingBottom: 8, borderTopWidth: 0, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.card },
        };
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
      />
      <Tab.Screen name="Reminders" component={RemindersScreen} />
      <Tab.Screen name="Refills" component={RefillScreen} />
      <Tab.Screen name="Pharmacy" component={PharmacyScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
      <Tab.Screen name="Health" component={HealthNavigator} />
    </Tab.Navigator>
  );
}

/* -------------------- Root stack -------------------- */
export default function MainNavigator() {
  return (
    <RootStack.Navigator
      screenOptions={({ navigation }) => ({
        headerBackVisible: false,
        headerLeft: () =>
          navigation.canGoBack() ? <HeaderBackButton onPress={() => navigation.goBack()} /> : null,
      })}
    >
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
      <RootStack.Screen name="ScanReview" component={ScanReviewScreen} options={{ title: 'Review Scan' }} />
      <RootStack.Screen name="PharmacyRefillRequest" component={PharmacyRefillRequestScreen} options={{ title: 'Request Refill' }} />
      <RootStack.Screen name="PharmacyPortal" component={PharmacyPortalScreen} options={{ title: 'Pharmacy Portal' }} />
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
        options={{ headerBackVisible: false }}
      />
    </RootStack.Navigator>
  );
}

const navStyles = StyleSheet.create({
  headerBackButton: {
    minHeight: 44,
    minWidth: 72,
    justifyContent: 'center',
    paddingRight: 8,
  },
  headerBackText: {
    color: '#0A84FF',
    fontSize: 17,
    fontWeight: '500',
  },
});
