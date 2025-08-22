// src/navigation/HealthNavigator.tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MenstrualTrackerScreen from '../screens/MenstrualTrackerScreen';
import HealthIntegrationsScreen from '../screens/HealthIntegrationsScreen';

export type HealthRoutes = {
  HealthHome: undefined;
  Menstrual: undefined;
  Wearables: undefined;
};

const Stack = createNativeStackNavigator<HealthRoutes>();

function Row({
  title,
  subtitle,
  onPress,
  emoji,
}: {
  title: string;
  subtitle?: string;
  emoji: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderColor: '#eef2f7',
      }}
    >
      <Text style={{ fontSize: 22, marginRight: 12 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', fontSize: 16 }}>{title}</Text>
        {subtitle ? (
          <Text style={{ color: '#667085', marginTop: 2 }}>{subtitle}</Text>
        ) : null}
      </View>
      <Text style={{ color: '#98a2b3', fontSize: 18 }}>›</Text>
    </Pressable>
  );
}

function HealthHomeScreen({ navigation }: any) {
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 10 }}>Health</Text>
        <View
          style={{
            backgroundColor: '#f8fafc',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#e5e7eb',
            paddingHorizontal: 14,
          }}
        >
          <Row
            emoji="🩸"
            title="Menstrual cycle"
            subtitle="Log periods, see predictions & next cycle"
            onPress={() => navigation.navigate('Menstrual')}
          />
          <Row
            emoji="⌚️"
            title="Wearables"
            subtitle="Connect Apple Health / Garmin (coming soon)"
            onPress={() => navigation.navigate('Wearables')}
          />
        </View>
      </View>
    </View>
  );
}

export default function HealthNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="HealthHome"
        component={HealthHomeScreen}
        options={{ title: 'Health' }}
      />
      <Stack.Screen
        name="Menstrual"
        component={MenstrualTrackerScreen}
        options={{ title: 'Menstrual cycle' }}
      />
      <Stack.Screen
        name="Wearables"
        component={HealthIntegrationsScreen}
        options={{ title: 'Wearables' }}
      />
    </Stack.Navigator>
  );
}