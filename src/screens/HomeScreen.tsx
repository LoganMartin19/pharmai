import React, { useEffect, useState } from 'react';
import { Text, FlatList, Pressable, View } from 'react-native';

import styles from './styles/HomeScreen.styles';
import { useReminders } from '../context/RemindersContext';
import { useUser } from '../context/UserContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/MainNavigator';
import { Medication } from '../types/Medication';
import SafeLayout from '../components/SafeLayout';
import PillBadge from '../components/PillBadge';   // 👈 add this

const ICONS = ['🌅', '☀️', '🌙'];
const LABELS = ['Morning', 'Afternoon', 'Evening'];

export default function HomeScreen() {
  const { user } = useUser();
  const { reminders, updateReminder } = useReminders();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [combinedMeds, setCombinedMeds] = useState<Medication[]>([]);

  useEffect(() => {
    const formatted: Medication[] = reminders.map((reminder) => ({
      ...reminder,
      taken: false,
      instructions: `Take ${reminder.dosage}`,
    }));
    setCombinedMeds(formatted);
  }, [reminders]);

  const toggleTaken = (id: string, doseIndex = 0) => {
    setCombinedMeds((prev) =>
      prev.map((med) => {
        if (med.id !== id) return med;

        const today = new Date().toISOString().split('T')[0];
        const existing = med.history.find((h) => h.date === today);

        let newHistory;

        if (existing) {
          const updatedTaken = [...existing.taken];
          updatedTaken[doseIndex] = !updatedTaken[doseIndex];
          newHistory = med.history.map((h) =>
            h.date === today ? { ...h, taken: updatedTaken } : h
          );
        } else {
          const numDoses =
            med.frequency === 'Twice daily'
              ? 2
              : med.frequency === 'Three times daily'
              ? 3
              : 1;

          const newTaken = Array(numDoses).fill(false);
          newTaken[doseIndex] = true;

          newHistory = [...med.history, { date: today, taken: newTaken }];
        }

        const updatedMed = { ...med, history: newHistory };
        updateReminder(updatedMed);
        return updatedMed;
      })
    );
  };

  const renderMedCard = ({ item }: { item: Medication }) => {
    const today = new Date().toISOString().split('T')[0];
    const todayHistory = item.history?.find((h) => h.date === today);
    const frequency =
      item.frequency === 'Twice daily' ? 2 :
      item.frequency === 'Three times daily' ? 3 : 1;
    const takenArray = todayHistory?.taken || Array(frequency).fill(false);

    return (
      <Pressable style={styles.card}>
        {/* Header row with pill badge + name */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <PillBadge style={item.pillStyle} size={22} />
          <Text style={styles.medName}>{item.name}</Text>
        </View>

        <Text style={styles.instructions}>{item.instructions}</Text>
        <Text style={styles.time}>⏰ {item.time}</Text>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-evenly',
            marginTop: 12,
            marginBottom: 8,
          }}
        >
          {Array.from({ length: frequency }).map((_, index) => (
            <View key={index} style={{ alignItems: 'center', width: 64 }}>
              <Pressable
                style={[
                  styles.button,
                  takenArray[index] && styles.buttonTaken,
                  {
                    width: 56,
                    height: 56,
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: 12,
                    overflow: 'hidden',
                  },
                ]}
                onPress={() => toggleTaken(item.id, index)}
              >
                <Text
                  style={[
                    styles.buttonText,
                    takenArray[index] && styles.buttonTextTaken,
                    { fontSize: 14, textAlign: 'center' },
                  ]}
                >
                  {takenArray[index] ? '✅' : ICONS[index] || '💊'}
                </Text>
              </Pressable>
              <Text
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  color: '#555',
                  textAlign: 'center',
                }}
              >
                {LABELS[index] || `Dose ${index + 1}`}
              </Text>
            </View>
          ))}
        </View>

        <Pressable
          style={styles.trackerButton}
          onPress={() => navigation.navigate('MedicationTracker', { medication: item })}
        >
          <Text style={styles.trackerButtonText}>📊 Tracker</Text>
        </Pressable>
      </Pressable>
    );
  };

  return (
    <SafeLayout>
      <Text style={styles.greeting}>
        {`Hi ${user?.displayName ? user.displayName + ' ' : ''}👋`}
      </Text>
      <Text style={styles.subtitle}>Your Medications Today</Text>

      <FlatList
        data={combinedMeds}
        keyExtractor={(item) => item.id}
        renderItem={renderMedCard}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <Pressable style={styles.addButton} onPress={() => navigation.navigate('Scan')}>
        <Text
          style={{
            fontSize: 30,
            color: '#FFFFFF',     // white for better contrast
            lineHeight: 30,
            includeFontPadding: false,
            textAlignVertical: 'center',
            textAlign: 'center',
          }}
        >
          ＋
        </Text>
      </Pressable>
    </SafeLayout>
  );
}