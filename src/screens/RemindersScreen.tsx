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
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme';
import { Eyebrow, StatusPill } from '../components/Primitives';

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
      onPress={() => navigation.navigate('AddReminder', { medication: item })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        {item.pillStyle ? <PillBadge style={item.pillStyle} size={18} /> : null}
        <Text style={styles.name}>{item.name}</Text>
      </View>

      <StatusPill label={item.frequency || 'Scheduled'} tone="blue" />
      {item.dosage ? <Text style={styles.detail}>{item.dosage}</Text> : null}
      {item.time ? <View style={styles.detailRow}><Ionicons name="time-outline" size={15} color={colors.inkMuted}/><Text style={styles.detail}>{item.time}</Text></View> : null}

      <Pressable
        style={styles.trackerButton}
        onPress={() => navigation.navigate('MedicationTracker', { medication: item })}
      >
        <Ionicons name="analytics-outline" size={17} color={colors.brand}/><Text style={styles.trackerButtonText}>Adherence</Text>
      </Pressable>

      {/* 💬 More clarification → opens Chat with the selected med */}
      <Pressable
        style={[styles.trackerButton, { backgroundColor: '#f1f5f9', marginTop: 8 }]}
        onPress={() => navigation.navigate('Chat', { contextMedication: item })}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.brand}/><Text style={styles.trackerButtonText}>Ask PharmAI</Text>
      </Pressable>

      <Pressable
        style={[styles.trackerButton, styles.deleteButton]}
        onPress={() => handleDelete(item)}
      >
        <Ionicons name="trash-outline" size={17} color={colors.danger}/><Text style={[styles.trackerButtonText, { color: colors.danger }]}>Delete</Text>
      </Pressable>
    </Pressable>
  );

  return (
    <SafeLayout>
      <FlatList
        data={reminders}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingTop: 6 }]}
        ListHeaderComponent={<View style={styles.header}><Eyebrow>Your schedule</Eyebrow><Text style={styles.title}>Medications</Text><Text style={styles.subtitle}>Review timing, edit reminders and track progress.</Text></View>}
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
        <Ionicons name="add" size={29} color={colors.white}/>
      </Pressable>
    </SafeLayout>
  );
}
