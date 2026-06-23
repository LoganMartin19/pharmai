// src/screens/SettingsScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  Switch,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/MainNavigator';
import SafeLayout from '../components/SafeLayout';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { setFollowUpDelayMinutes, debugTestNotification } from '../utils/notifications';
import { registerExpoPushToken } from '../utils/expoPush';
import { useUser } from '../context/UserContext';

type Gender = 'female' | 'male' | 'prefer_not_to_say' | '';

export default function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { refreshProfile } = useUser();
  const [userName, setUserName] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [gender, setGender] = useState<Gender>('');

  // Follow-up delay UI state
  const [delayValue, setDelayValue] = useState('60');
  const [loadingDelay, setLoadingDelay] = useState(true);
  const [savingDelay, setSavingDelay] = useState(false);

  // ---- Load local prefs ----
  useEffect(() => {
    (async () => {
      const storedName = await AsyncStorage.getItem('userName');
      if (storedName) setUserName(storedName);
      const permission = await Notifications.getPermissionsAsync();
      setNotificationsEnabled(permission.status === 'granted');
    })();
  }, []);

  // ---- Load follow-up delay from Firestore ----
  useEffect(() => {
    const loadDelay = async () => {
      const u = auth.currentUser;
      if (!u) {
        setLoadingDelay(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', u.uid));
        const data = snap.exists() ? (snap.data() as any) : null;
        const root = data?.followUpDelayMinutes;
        const nested = data?.settings?.followUpDelayMinutes;
        const n = Number(root ?? nested ?? 60);
        setDelayValue(String(Number.isFinite(n) && n > 0 ? n : 60));
        setGender((data?.gender ?? '') as Gender);
        if (data?.displayName || data?.name) setUserName(data.displayName || data.name);
      } catch (e) {
        console.warn('Load followUpDelayMinutes failed', e);
        setDelayValue('60');
      } finally {
        setLoadingDelay(false);
      }
    };
    loadDelay();
  }, []);

  // ---- Handlers ----
  const toggleNotifications = async () => {
    if (!notificationsEnabled) {
      const permission = await Notifications.requestPermissionsAsync();
      const granted = permission.status === 'granted';
      setNotificationsEnabled(granted);
      if (granted) {
        await registerExpoPushToken();
        Alert.alert('Notifications on', 'Dose reminders and care alerts are enabled.');
      } else {
        Alert.alert('Notifications off', 'Enable notifications in iOS Settings to receive reminders.');
      }
      return;
    }

    Alert.alert(
      'Managed by iOS',
      'Notifications are currently allowed. To turn them off completely, use iOS Settings for PharmAI.',
    );
    setNotificationsEnabled(true);
  };

  const saveGender = async (value: Gender) => {
    const u = auth.currentUser;
    if (!u) return;
    setGender(value);
    await setDoc(doc(db, 'users', u.uid), { gender: value }, { merge: true });
    await refreshProfile();
  };

  const handleSaveDelay = async () => {
    const n = Math.max(1, Math.min(720, Math.floor(Number(delayValue))));
    if (!Number.isFinite(n)) {
      Alert.alert('Invalid value', 'Please enter a number between 1 and 720.');
      return;
    }
    try {
      setSavingDelay(true);
      await setFollowUpDelayMinutes(n);
      setDelayValue(String(n));
      Alert.alert('Saved', `Follow-up delay set to ${n} minute${n === 1 ? '' : 's'}.`);
    } catch (e) {
      console.warn('Save followUpDelayMinutes failed', e);
      Alert.alert('Error', 'Could not save the setting. Please try again.');
    } finally {
      setSavingDelay(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      await AsyncStorage.clear();
      navigation.reset({ index: 0, routes: [{ name: 'Welcome' as any }] });
    } catch {
      Alert.alert('Logout Failed', 'Please try again.');
    }
  };

  // ---- UI ----
  return (
    <SafeLayout>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Account */}
          <Text style={styles.sectionTitle}>Account Details</Text>
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={userName} editable={false} />
          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>Log out</Text>
          </Pressable>

          {/* Preferences */}
          <Text style={styles.sectionTitle}>Preferences</Text>
          <Text style={styles.label}>Gender</Text>
          <View style={styles.genderRow}>
            {([
              ['female', 'Woman'],
              ['male', 'Man'],
              ['prefer_not_to_say', 'Prefer not to say'],
            ] as const).map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => saveGender(value)}
                style={[styles.genderPill, gender === value && styles.genderPillActive]}
              >
                <Text style={[styles.genderPillText, gender === value && styles.genderPillTextActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.prefRow}>
            <Text style={styles.label}>Notifications</Text>
            <Switch value={notificationsEnabled} onValueChange={toggleNotifications} />
          </View>

          {/* Follow-up delay */}
          <Text style={styles.sectionTitle}>Missed‑dose Follow‑up</Text>
          <Text style={styles.label}>Delay (minutes)</Text>

          {loadingDelay ? (
            <ActivityIndicator />
          ) : (
            <>
              <View style={styles.delayRow}>
                <TextInput
                  value={delayValue}
                  onChangeText={setDelayValue}
                  inputMode="numeric"
                  keyboardType="number-pad"
                  style={styles.input}
                  placeholder="e.g. 60"
                />
                <Pressable
                  onPress={() => setDelayValue(String(Math.max(1, (Number(delayValue) || 60) - 5)))}
                  style={styles.bumpBtn}
                >
                  <Text>-5</Text>
                </Pressable>
                <Pressable
                  onPress={() => setDelayValue(String(Math.min(720, (Number(delayValue) || 60) + 5)))}
                  style={styles.bumpBtn}
                >
                  <Text>+5</Text>
                </Pressable>
              </View>

              <Pressable
                onPress={handleSaveDelay}
                disabled={savingDelay}
                style={[styles.saveBtn, { backgroundColor: savingDelay ? '#9EC9FF' : '#0A84FF' }]}
              >
                <Text style={styles.saveBtnText}>{savingDelay ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </>
          )}

          {/* Care alerts */}
          <Text style={styles.sectionTitle}>Caregiver Alerts</Text>
          <Text style={[styles.label, { marginBottom: 8 }]}>
            Caregiver alerts use remote push notifications when a linked patient misses a dose.
          </Text>
          <Text style={{ color: '#6b7280', marginBottom: 16 }}>
            Keep notifications enabled on caregiver devices to receive missed-dose pings.
          </Text>

          {/* Pharmacy tools */}
          <Text style={styles.sectionTitle}>Pharmacy Tools</Text>
          <Pressable
            onPress={() => navigation.navigate('PharmacyPortal')}
            style={styles.portalBtn}
          >
            <Text style={styles.portalBtnText}>Open pharmacy portal</Text>
          </Pressable>

          {/* Debug */}
          <Text style={styles.sectionTitle}>Debug</Text>
          <Pressable onPress={debugTestNotification} style={styles.debugBtn}>
            <Text>Send local test notification</Text>
          </Pressable>

          <View style={styles.separator} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 48 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  label: { fontSize: 14, marginBottom: 4, color: '#555' },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    minWidth: 100,
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  genderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  genderPill: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  genderPillActive: { borderColor: '#0A84FF', backgroundColor: '#E8F0FF' },
  genderPillText: { color: '#374151', fontWeight: '700' },
  genderPillTextActive: { color: '#0A84FF' },
  delayRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  bumpBtn: { paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8 },
  saveBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 16 },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  debugBtn: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  portalBtn: {
    backgroundColor: '#E8F0FF',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  portalBtnText: { color: '#0A53B8', fontWeight: '700' },
  logoutBtn: {
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 24,
  },
  logoutBtnText: { color: '#b91c1c', fontWeight: '800' },
  separator: { height: 24 },
});
