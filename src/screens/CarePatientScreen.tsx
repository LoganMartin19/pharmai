// src/screens/CarePatientScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
  TextInput,
  Switch,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/MainNavigator';
import { Medication } from '../types/Medication';
import { auth, db } from '../firebase';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import SafeLayout from '../components/SafeLayout';
import styles from './styles/HomeScreen.styles';

type Nav = NativeStackNavigationProp<RootStackParamList, 'CarePatient'>;
type Route = RouteProp<RootStackParamList, 'CarePatient'>;

const ICONS = ['🌅', '☀️', '🌙'];
const LABELS = ['Morning', 'Afternoon', 'Evening'];

type DayStat = { date: string; taken: number; total: number; pct: number };
type MedStat = { id: string; name: string; taken: number; total: number; pct: number };

function toISO(d: Date) { return d.toISOString().slice(0, 10); }
function fromISO(s: string) { return new Date(`${s}T00:00:00`); }
function rangeDays(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(today);
    dt.setDate(today.getDate() - i);
    out.push(toISO(dt));
  }
  return out;
}

export default function CarePatientScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { patientUid, displayName } = route.params;

  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Caregiver alert prefs (per patient link) ---
  const [notifyOn, setNotifyOn] = useState(true);
  const [notifyDelay, setNotifyDelay] = useState('60'); // minutes

  // --- UI tabs ---
  const [tab, setTab] = useState<'overview' | 'analytics'>('overview');

  useEffect(() => {
    navigation.setOptions({ title: displayName || 'Patient' });

    const load = async () => {
      setLoading(true);

      try {
        // 1) Load patient's meds
        const snap = await getDocs(collection(db, 'users', patientUid, 'reminders'));
        setMeds(snap.docs.map((d) => d.data() as Medication));
      } catch (e: any) {
        console.warn('loadMeds failed', e?.message || e);
        Alert.alert('Unable to load', 'You may not have permission to view this patient’s medications.');
      }

      try {
        // 2) Load caregiver → patient link prefs
        const u = auth.currentUser;
        if (u) {
          const linkRef = doc(db, 'users', u.uid, 'careLinks', patientUid);
          const linkSnap = await getDoc(linkRef);
          const d = linkSnap.exists() ? (linkSnap.data() as any) : {};
          setNotifyOn(d?.notifyCare !== false); // default ON
          setNotifyDelay(String(Number(d?.notifyDelayMinutes || 60)));
        }
      } catch (e) {
        console.warn('load caregiver link prefs failed', e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [patientUid, displayName, navigation]);

  async function saveCareNotifyPrefs() {
    try {
      const u = auth.currentUser;
      if (!u) {
        Alert.alert('Not signed in', 'Please sign in again.');
        return;
      }
      const minutes = Math.max(1, Math.min(720, Math.floor(Number(notifyDelay) || 60)));
      await setDoc(
        doc(db, 'users', u.uid, 'careLinks', patientUid),
        {
          role: 'patient',              // keep the role so the doc stays consistent
          notifyCare: notifyOn,
          notifyDelayMinutes: minutes,
        },
        { merge: true }
      );
      setNotifyDelay(String(minutes));
      Alert.alert('Saved', `You’ll be notified after ${minutes} min${minutes === 1 ? '' : 's'} if doses are missed.`);
    } catch (e) {
      console.warn('saveCareNotifyPrefs failed', e);
      Alert.alert('Error', 'Could not save caregiver alert settings.');
    }
  }

  /* --------------------------- OVERVIEW --------------------------- */

  const renderCard = ({ item }: { item: Medication }) => {
    const today = new Date().toISOString().split('T')[0];
    const todayHistory = item.history?.find((h) => h.date === today);
    const freq =
      item.frequency === 'Twice daily' ? 2 :
      item.frequency === 'Three times daily' ? 3 : 1;
    const takenArray = todayHistory?.taken || Array(freq).fill(false);

    return (
      <View style={styles.card}>
        <Text style={styles.medName}>{item.name}</Text>
        <Text style={styles.instructions}>{item.instructions || `Take ${item.dosage}`}</Text>
        <Text style={styles.time}>⏰ {item.time}</Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', marginTop: 12, marginBottom: 8 }}>
          {Array.from({ length: freq }).map((_, index) => (
            <View key={index} style={{ alignItems: 'center', width: 64 }}>
              <View
                style={[
                  styles.button,
                  takenArray[index] && styles.buttonTaken,
                  { width: 56, height: 56, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
                ]}
              >
                <Text style={[styles.buttonText, takenArray[index] && styles.buttonTextTaken, { fontSize: 14 }]}>
                  {takenArray[index] ? '✅' : ICONS[index] || '💊'}
                </Text>
              </View>
              <Text style={{ marginTop: 6, fontSize: 13, color: '#555' }}>
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
      </View>
    );
  };

  /* --------------------------- ANALYTICS (ALL MEDS FOR THIS PATIENT) --------------------------- */

  const [windowKey, setWindowKey] = useState<'7' | '30' | 'all'>('7');

  // Build day list for the selected window
  const days: string[] = useMemo(() => {
    if (windowKey !== 'all') return rangeDays(windowKey === '7' ? 7 : 30);
    // all history across all meds (for this patient)
    let min: string | null = null;
    let max: string | null = null;
    meds.forEach(m =>
      m.history?.forEach(h => {
        if (!min || h.date < min) min = h.date;
        if (!max || h.date > max) max = h.date;
      })
    );
    if (!min || !max) return rangeDays(7);
    const out: string[] = [];
    for (let d = new Date(fromISO(min)); d <= fromISO(max); d.setDate(d.getDate() + 1)) {
      out.push(toISO(d));
    }
    return out;
  }, [windowKey, meds]);

  // Per-day stats across all meds
  const dayStats: DayStat[] = useMemo(() => {
    return days.map(d => {
      let taken = 0, total = 0;
      meds.forEach((m) => {
        const rec = m.history?.find(h => h.date === d);
        if (rec?.taken) {
          total += rec.taken.length;
          rec.taken.forEach(v => v && taken++);
        }
      });
      const pct = total ? Math.round((taken / total) * 100) : 0;
      return { date: d, taken, total, pct };
    });
  }, [days, meds]);

  const overallAvg = useMemo(() => {
    const have = dayStats.filter(s => s.total > 0);
    if (!have.length) return 0;
    return Math.round(have.reduce((a, b) => a + b.pct, 0) / have.length);
  }, [dayStats]);

  // Per‑med stats within the window
  const medStats: MedStat[] = useMemo(() => {
    const setDays = new Set(days);
    return meds.map(m => {
      let taken = 0, total = 0;
      m.history?.forEach(h => {
        if (setDays.has(h.date) && h.taken?.length) {
          total += h.taken.length;
          h.taken.forEach(v => v && taken++);
        }
      });
      const pct = total ? Math.round((taken / total) * 100) : 0;
      return { id: m.id, name: m.name, taken, total, pct };
    }).sort((a, b) => b.pct - a.pct);
  }, [meds, days]);

  /* --------------------------- RENDER --------------------------- */

  return (
    <SafeLayout>
      {/* Caregiver notify controls */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
          {displayName || 'Patient'}
        </Text>

        {/* tabs */}
        <View style={local.tabRow}>
          {(['overview', 'analytics'] as const).map(k => (
            <Pressable
              key={k}
              onPress={() => setTab(k)}
              style={[local.tabPill, tab === k && local.tabActive]}
            >
              <Text style={[local.tabText, tab === k && local.tabTextActive]}>
                {k === 'overview' ? 'Overview' : 'Analytics'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <Text style={{ fontWeight: '600' }}>Notify me if this patient misses a dose</Text>
          <Switch value={notifyOn} onValueChange={setNotifyOn} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Text>Delay (min):</Text>
          <TextInput
            value={notifyDelay}
            onChangeText={setNotifyDelay}
            keyboardType="number-pad"
            inputMode="numeric"
            style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, minWidth: 80 }}
            placeholder="60"
          />
          <Pressable
            onPress={saveCareNotifyPrefs}
            style={{ marginLeft: 'auto', backgroundColor: '#0A84FF', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : tab === 'overview' ? (
        <FlatList
          data={meds}
          keyExtractor={(item) => item.id}
          renderItem={renderCard}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          {/* Window selector */}
          <View style={local.row}>
            {(['7', '30', 'all'] as const).map(key => (
              <Pressable
                key={key}
                onPress={() => setWindowKey(key)}
                style={[local.pill, windowKey === key && local.pillActive]}
              >
                <Text style={[local.pillText, windowKey === key && local.pillTextActive]}>
                  {key === '7' ? 'Last 7 days' : key === '30' ? 'Last 30 days' : 'All history'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Overall summary */}
          <Text style={{ marginTop: 10, fontWeight: '700', color: '#111' }}>
            Overall average: {overallAvg}% ({dayStats.length} days)
          </Text>

          {/* Overall daily bar chart */}
          <View style={local.chartWrap}>
            {dayStats.map((sday, idx) => {
              const maxHeight = 120;
              const h = Math.round((sday.pct / 100) * maxHeight);
              return (
                <View key={sday.date + idx} style={local.barItem}>
                  <View style={[local.bar, { height: Math.max(2, h) }]} />
                  <Text style={local.barLabel}>{sday.date.slice(5)}</Text>
                </View>
              );
            })}
          </View>

          {/* By‑med tiles */}
          <Text style={{ marginTop: 12, fontWeight: '700', color: '#111' }}>By medication</Text>
          <View style={local.grid}>
            {medStats.map(ms => (
              <View key={ms.id} style={local.tile}>
                <Text style={local.tileTitle} numberOfLines={1}>{ms.name}</Text>
                <Text style={local.tilePct}>{ms.pct}%</Text>
                <Text style={local.tileSub}>{ms.taken}/{ms.total} doses</Text>

                <Pressable
                  onPress={() => navigation.navigate('MedicationTracker', {
                    medication: meds.find(m => m.id === ms.id)!,
                  })}
                  style={local.tileLink}
                >
                  <Text style={local.tileLinkText}>View tracker</Text>
                </Pressable>
              </View>
            ))}
          </View>

          {/* Recent 7-day detail per med */}
          <View style={{ marginTop: 8 }}>
            {meds.map((m) => {
              const recentDays = rangeDays(7);
              const rows = recentDays.map(d => {
                const rec = m.history?.find(h => h.date === d);
                const total = rec?.taken?.length ?? 0;
                const taken = total ? rec!.taken.filter(Boolean).length : 0;
                const pct = total ? Math.round((taken / total) * 100) : 0;
                return { date: d, taken, total, pct };
              }).reverse(); // newest top

              const medAvg = (() => {
                const valid = rows.filter(r => r.total > 0);
                if (!valid.length) return 0;
                return Math.round(valid.reduce((a, b) => a + b.pct, 0) / valid.length);
              })();

              return (
                <View key={m.id} style={local.medBlock}>
                  <Text style={local.medBlockTitle}>{m.name} — last 7 days avg {medAvg}%</Text>
                  {rows.map(r => (
                    <View key={m.id + r.date} style={local.rowLine}>
                      <Text style={{ width: 90, color: '#555' }}>{r.date}</Text>
                      <Text style={{ marginLeft: 6, fontWeight: '600' }}>{r.pct}%</Text>
                      <Text style={{ marginLeft: 'auto', color: '#555' }}>
                        {r.taken}/{r.total} doses
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeLayout>
  );
}

const local = StyleSheet.create({
  // tabs
  tabRow: { flexDirection: 'row', gap: 8 },
  tabPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tabActive: { backgroundColor: '#E8F0FF', borderColor: '#0A84FF' },
  tabText: { color: '#333', fontWeight: '600' },
  tabTextActive: { color: '#0A84FF' },

  // window selector
  row: { flexDirection: 'row', gap: 8, marginTop: 6 },
  pill: {
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 999, borderWidth: 1, borderColor: '#e5e7eb'
  },
  pillActive: { backgroundColor: '#E8F0FF', borderColor: '#0A84FF' },
  pillText: { color: '#333', fontWeight: '600' },
  pillTextActive: { color: '#0A84FF' },

  // chart
  chartWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  barItem: { alignItems: 'center' },
  bar: { width: 14, backgroundColor: '#0A84FF', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barLabel: { fontSize: 10, color: '#666', marginTop: 4 },

  // grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  tile: {
    width: '48%',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tileTitle: { fontWeight: '700', marginBottom: 2, color: '#111' },
  tilePct: { fontSize: 18, fontWeight: '800', color: '#0A84FF' },
  tileSub: { color: '#555', marginTop: 2 },
  tileLink: {
    marginTop: 8,
    backgroundColor: '#E8F0FF',
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  tileLinkText: { color: '#0A84FF', fontWeight: '700' },

  // per-med list
  medBlock: { marginTop: 12, paddingTop: 6, borderTopWidth: 1, borderColor: '#f1f5f9' },
  medBlockTitle: { fontWeight: '700', marginBottom: 6, color: '#111' },
  rowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
});