// src/screens/HomeScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Text,
  FlatList,
  Pressable,
  View,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import styles from './styles/HomeScreen.styles';
import { useReminders } from '../context/RemindersContext';
import { useUser } from '../context/UserContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RootStackParamList, HomeTabParamList } from '../navigation/MainNavigator';
import { Medication } from '../types/Medication';
import SafeLayout from '../components/SafeLayout';
import { auth, db } from '../firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import {
  cancelReminderNotifications,
  scheduleReminderNotifications,
} from '../utils/notifications';
import HomeHealthHeader from '../components/HomeHealthHeader';

const ICONS = ['🌅', '☀️', '🌙'];
const LABELS = ['Morning', 'Afternoon', 'Evening'];

type StackNav = NativeStackNavigationProp<RootStackParamList>;
type TabNav = BottomTabNavigationProp<HomeTabParamList>;

type CareLink = {
  patientUid: string;
  displayName?: string | null;
  role?: 'patient' | 'caregiver';
};

export default function HomeScreen() {
  const { user } = useUser();
  const { reminders, updateReminder } = useReminders();
  const stackNav = useNavigation<StackNav>(); // for stack screens (Scan, CarePatient, etc.)
  const tabNav = useNavigation<TabNav>();     // for tab screens (Health)

  const [mode, setMode] = useState<'me' | 'care'>('me');

  // ---------------- ME MODE ----------------
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

        (async () => {
          await cancelReminderNotifications(med.id);
          await scheduleReminderNotifications(updatedMed);
        })();

        return updatedMed;
      })
    );
  };

  const renderMeCard = ({ item }: { item: Medication }) => {
    const today = new Date().toISOString().split('T')[0];
    const todayHistory = item.history?.find((h) => h.date === today);
    const freq =
      item.frequency === 'Twice daily'
        ? 2
        : item.frequency === 'Three times daily'
        ? 3
        : 1;
    const takenArray = todayHistory?.taken || Array(freq).fill(false);

    return (
      <Pressable style={styles.card}>
        <Text style={styles.medName}>{item.name}</Text>
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
          {Array.from({ length: freq }).map((_, index) => (
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
                  },
                ]}
                onPress={() => toggleTaken(item.id, index)}
              >
                <Text
                  style={[
                    styles.buttonText,
                    takenArray[index] && styles.buttonTextTaken,
                    { fontSize: 14 },
                  ]}
                >
                  {takenArray[index] ? '✅' : ICONS[index] || '💊'}
                </Text>
              </Pressable>
              <Text style={{ marginTop: 6, fontSize: 13, color: '#555' }}>
                {LABELS[index] || `Dose ${index + 1}`}
              </Text>
            </View>
          ))}
        </View>

        <Pressable
          style={styles.trackerButton}
          onPress={() =>
            stackNav.navigate('MedicationTracker', { medication: item })
          }
        >
          <Text style={styles.trackerButtonText}>📊 Tracker</Text>
        </Pressable>
      </Pressable>
    );
  };

  // ---------------- CARE MODE ----------------
  type HistoryEntry = { date: string; taken: boolean[] };
  type CareMedication = Medication & { history?: HistoryEntry[] };

  const [links, setLinks] = useState<CareLink[]>([]);
  const [patients, setPatients] = useState<Record<string, CareMedication[]>>({});
  const [loadingCare, setLoadingCare] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  function safeCollection(...segs: (string | null | undefined)[]) {
    if (segs.some((s) => !s || typeof s !== 'string')) {
      throw new Error('Invalid Firestore path segments');
    }
    // @ts-ignore
    return collection(db, ...segs);
  }

  const loadCare = async () => {
    const u = auth.currentUser;
    if (!u) return;

    setLoadingCare(true);
    try {
      const snap = await getDocs(collection(db, 'users', u.uid, 'careLinks'));
      const rows: CareLink[] = snap.docs
        .map((d) => {
          const data = d.data() as any;
          return {
            role: data?.role,
            displayName: data?.displayName ?? null,
            patientUid: d.id,
          } as CareLink;
        })
        .filter((l) => l.role === 'patient' || l.role === undefined);

      setLinks(rows);

      const byId: Record<string, CareMedication[]> = {};
      await Promise.all(
        rows.map(async (l) => {
          if (!l.patientUid) return;
          const medsSnap = await getDocs(
            safeCollection('users', l.patientUid, 'reminders')
          );
          byId[l.patientUid] = medsSnap.docs.map((d) => {
            const raw = d.data() as any;
            return {
              id: d.id,
              name: raw.name ?? raw.medicationName ?? 'Medication',
              dosage: raw.dosage,
              time: raw.time,
              times: raw.times,
              frequency: raw.frequency,
              instructions:
                raw.instructions ?? (raw.dosage ? `Take ${raw.dosage}` : undefined),
              pillStyle: raw.pillStyle,
              repeatPrescription: raw.repeatPrescription,
              startDate: raw.startDate,
              endDate: raw.endDate,
              history: raw.history ?? [],
            } as CareMedication;
          });
        })
      );

      setPatients(byId);
    } finally {
      setLoadingCare(false);
    }
  };

  useEffect(() => {
    if (mode === 'care') loadCare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadCare();
    } finally {
      setRefreshing(false);
    }
  };

  const computeAdherence = (meds: CareMedication[] = []) => {
    const now = new Date();
    let taken = 0,
      total = 0;
    meds.forEach((m) =>
      m.history?.forEach((h) => {
        const d = new Date(`${h.date}T00:00:00`);
        const delta = (now.getTime() - d.getTime()) / 86400000;
        if (delta >= 0 && delta < 7) {
          (h.taken || []).forEach((v) => {
            total += 1;
            if (v) taken += 1;
          });
        }
      })
    );
    return total ? Math.round((taken / total) * 100) : 0;
  };

  const careRows = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return links.map((l) => {
      const meds = patients[l.patientUid] || [];
      const adherence = computeAdherence(meds);

      let allTaken = true;
      meds.forEach((m) => {
        const hh = m.history?.find((h) => h.date === today);
        const takenArray = hh?.taken;
        if (!takenArray || takenArray.length === 0 || takenArray.some((t) => !t)) {
          allTaken = false;
        }
      });

      return {
        link: l,
        meds,
        adherence,
        statusIcon: allTaken ? '🟢' : '🔴',
      };
    });
  }, [links, patients]);

  const removeLink = async (patientUid: string) => {
    const u = auth.currentUser;
    if (!u) return;
    Alert.alert('Remove Link', 'Are you sure you want to remove this care link?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteDoc(doc(db, 'users', u.uid, 'careLinks', patientUid));
          await deleteDoc(doc(db, 'users', patientUid, 'careLinks', u.uid));
          onRefresh();
        },
      },
    ]);
  };

  // ---------------- RENDER ----------------
  return (
    <SafeLayout>
      {/* Greeting + segmented toggle */}
      <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4 }}>
        <Text style={styles.greeting}>
          {`Hi ${user?.displayName ? user.displayName + ' ' : ''}👋`}
        </Text>
        <Text style={styles.subtitle}>Your Medications Today</Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          {(['me', 'care'] as const).map((val) => (
            <Pressable
              key={val}
              onPress={() => setMode(val)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: mode === val ? '#0A84FF' : '#e5e7eb',
                backgroundColor: mode === val ? '#E8F0FF' : '#fff',
              }}
            >
              <Text
                style={{
                  fontWeight: '600',
                  color: mode === val ? '#0A84FF' : '#111',
                }}
              >
                {val === 'me' ? 'Me' : 'Care'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {mode === 'me' ? (
        <>
          {/* Menstrual tracker preview (tap to open Health tab) */}
          <HomeHealthHeader onOpen={() => tabNav.navigate('Health')} />

          <FlatList
            data={combinedMeds}
            keyExtractor={(item) => item.id}
            renderItem={renderMeCard}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
          <Pressable
            style={styles.addButton}
            onPress={() => stackNav.navigate('Scan')}
          >
            <Text
              style={{ fontSize: 30, color: '#fff', lineHeight: 30, textAlign: 'center' }}
            >
              ＋
            </Text>
          </Pressable>
        </>
      ) : loadingCare ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : links.length === 0 ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Text style={{ color: '#666' }}>
            No linked patients yet. Ask them to share an invite code from
            Settings → Care.
          </Text>
        </View>
      ) : (
        <FlatList
          data={careRows}
          keyExtractor={(r) => r.link.patientUid}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
          renderItem={({ item }) => (
            <View
              style={{
                borderWidth: 1,
                borderColor: '#e5e7eb',
                borderRadius: 14,
                padding: 14,
              }}
            >
              <Pressable
                onPress={() =>
                  stackNav.navigate('CarePatient', {
                    patientUid: item.link.patientUid,
                    displayName: item.link.displayName,
                  })
                }
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 18, fontWeight: '700' }}>
                  {item.link.displayName || item.link.patientUid.slice(0, 6) + '…'}
                </Text>
                <Text style={{ marginLeft: 8 }}>{item.statusIcon}</Text>
                <Text
                  style={{
                    marginLeft: 'auto',
                    fontWeight: '600',
                    color: '#0A84FF',
                  }}
                >
                  {item.adherence}% last 7d
                </Text>
              </Pressable>

              {/* Remove Link button */}
              <Pressable
                style={{
                  marginTop: 10,
                  paddingVertical: 6,
                  backgroundColor: '#fee2e2',
                  borderRadius: 8,
                }}
                onPress={() => removeLink(item.link.patientUid)}
              >
                <Text
                  style={{ color: '#b91c1c', fontWeight: '600', textAlign: 'center' }}
                >
                  Remove Link
                </Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeLayout>
  );
}