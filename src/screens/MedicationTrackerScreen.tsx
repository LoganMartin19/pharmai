import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/MainNavigator';
import { Medication } from '../types/Medication';
import styles from './styles/MedicationTrackerScreen.styles';

type MedicationTrackerRouteProp = RouteProp<RootStackParamList, 'MedicationTracker'>;

export default function MedicationTrackerScreen() {
  const route = useRoute<MedicationTrackerRouteProp>();
  const { medication } = route.params;

  const getDateRange = (): string[] => {
    const start = new Date(medication.startDate ?? '');
    const end = new Date(medication.endDate ?? new Date());

    const days: string[] = [];
    let current = new Date(start);

    while (current <= end) {
      days.push(new Date(current).toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    return days;
  };

  const getTakenStatus = (date: string) => {
    const entry = medication.history?.find((h) => h.date === date);
    if (!entry) return [];

    return Array.isArray(entry.taken) ? entry.taken : [entry.taken];
  };

  const days = getDateRange();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>{medication.name} Tracker</Text>

      {days.map((dateStr, index) => {
        const date = new Date(dateStr);
        const dayLabel = date.toLocaleDateString('en-GB', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
        });

        const taken = getTakenStatus(dateStr);
        const totalDoses = medication.frequency === 'Twice daily'
          ? 2
          : medication.frequency === 'Three times daily'
          ? 3
          : 1;
        const takenCount = taken.filter((t) => t).length;

        const missed = taken.length === totalDoses && takenCount < totalDoses;
        const barFill = takenCount / totalDoses;

        return (
          <View key={index} style={styles.dayContainer}>
            <Text style={[styles.dayLabel, missed && styles.missed]}>{dayLabel}</Text>

            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { flex: barFill }]} />
              <View style={{ flex: 1 - barFill }} />
            </View>

            <Text style={styles.progressText}>
              {takenCount}/{totalDoses} doses taken
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}