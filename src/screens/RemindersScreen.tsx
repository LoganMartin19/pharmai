import React from 'react';
import { View, Text, FlatList, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useReminders } from '../context/RemindersContext';
import { Medication } from '../types/Medication';
import { RootStackParamList } from '../navigation/MainNavigator';
import styles from './styles/ReminderScreen.styles';
import SafeLayout from '../components/SafeLayout';
import PillBadge from '../components/PillBadge';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function RemindersScreen() {
  const { reminders, deleteReminder } = useReminders();
  const navigation = useNavigation<NavigationProp>();

  const handleDelete = (med: Medication) => {
    Alert.alert(
      'Delete Reminder',
      `Are you sure you want to delete "${med.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteReminder(med.id) },
      ],
    );
  };

  const renderItem = ({ item }: { item: Medication }) => (
    <Pressable
      style={styles.card}
      // ✅ Use `prefill` (matches your RootStackParamList)
      onPress={() => navigation.navigate('AddReminder', { prefill: item })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        {item.pillStyle ? <PillBadge style={item.pillStyle} size={18} /> : null}
        <Text style={styles.name}>{item.name}</Text>
      </View>

      {item.dosage ? <Text style={styles.detail}>💊 {item.dosage}</Text> : null}
      {item.time ? <Text style={styles.detail}>⏰ {item.time}</Text> : null}

      <Pressable
        style={styles.trackerButton}
        onPress={() => navigation.navigate('MedicationTracker', { medication: item })}
      >
        <Text style={styles.trackerButtonText}>📊 Tracker</Text>
      </Pressable>

      {/* 💬 More clarification → opens Chat with the selected med */}
      <Pressable
        style={[styles.trackerButton, { backgroundColor: '#f1f5f9', marginTop: 8 }]}
        onPress={() => navigation.navigate('Chat', { contextMedication: item })}
      >
        <Text style={[styles.trackerButtonText, { color: '#0A84FF' }]}>💬 More clarification</Text>
      </Pressable>

      <Pressable
        style={[styles.trackerButton, { backgroundColor: 'red', marginTop: 8 }]}
        onPress={() => handleDelete(item)}
      >
        <Text style={[styles.trackerButtonText, { color: 'white' }]}>🗑️ Delete</Text>
      </Pressable>
    </Pressable>
  );

  return (
    <SafeLayout>
      <Text style={styles.title}>Your Reminders</Text>

      <FlatList
        data={reminders}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', marginTop: 30 }}>
            No reminders yet.
          </Text>
        }
      />

      {/* FAB */}
      <Pressable
        style={styles.addButton}
        onPress={() =>
          Alert.alert('Add Reminder', 'Choose how to add', [
            { text: 'Manual', onPress: () => navigation.navigate('AddReminder', { prefill: {} }) },
            { text: 'Scan', onPress: () => navigation.navigate('Scan') },
            { text: 'Cancel', style: 'cancel' },
          ])
        }
      >
        <Text style={{ fontSize: 24, color: '#fff', fontWeight: '800', lineHeight: 24 }}>＋</Text>
      </Pressable>
    </SafeLayout>
  );
}