// src/screens/SettingsScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Button,
  Alert,
  Switch,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/MainNavigator';
import SafeLayout from '../components/SafeLayout';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { setFollowUpDelayMinutes, debugTestNotification } from '../utils/notifications';
import { registerCaregiverTokenNow } from '../utils/fcmDebug';

export default function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [userName, setUserName] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Follow-up delay UI state
  const [delayValue, setDelayValue] = useState('60');
  const [loadingDelay, setLoadingDelay] = useState(true);
  const [savingDelay, setSavingDelay] = useState(false);

  // FCM UI state
  const [registeringToken, setRegisteringToken] = useState(false);

  // ---- Load local prefs ----
  useEffect(() => {
    (async () => {
      const storedName = await AsyncStorage.getItem('userName');
      const notifSetting = await AsyncStorage.getItem('notificationsEnabled');
      if (storedName) setUserName(storedName);
      setNotificationsEnabled(notifSetting === 'true');
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
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    await AsyncStorage.setItem('notificationsEnabled', String(newValue));
    Alert.alert('Preferences saved', `Notifications turned ${newValue ? 'on' : 'off'}`);
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

  const handleRegisterFcm = async () => {
    try {
      setRegisteringToken(true);
      await registerCaregiverTokenNow();
      Alert.alert(
        'Device registered',
        'This device is now registered for care alerts. (Use a physical iPhone for push tests.)'
      );
    } catch (e: any) {
      console.warn('registerCaregiverTokenNow failed', e);
      Alert.alert('Registration failed', e?.message || 'Could not register this device token.');
    } finally {
      setRegisteringToken(false);
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
        <View style={styles.container}>
          {/* Account */}
          <Text style={styles.sectionTitle}>Account Details</Text>
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={userName} editable={false} />

          {/* Preferences */}
          <Text style={styles.sectionTitle}>Preferences</Text>
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

          {/* Care alerts (FCM) */}
          <Text style={styles.sectionTitle}>Caregiver Alerts</Text>
          <Text style={[styles.label, { marginBottom: 8 }]}>
            Register this device to receive care alerts for your linked patients.
          </Text>
          <Pressable
            onPress={handleRegisterFcm}
            disabled={registeringToken}
            style={[styles.saveBtn, { backgroundColor: registeringToken ? '#9EC9FF' : '#0A84FF' }]}
          >
            <Text style={styles.saveBtnText}>
              {registeringToken ? 'Registering…' : 'Register device for care alerts'}
            </Text>
          </Pressable>
          <Text style={{ color: '#6b7280', marginBottom: 16 }}>
            Tip: Push notifications require a physical iPhone (the iOS Simulator cannot receive APNs).
          </Text>

          {/* Debug */}
          <Text style={styles.sectionTitle}>Debug</Text>
          <Pressable onPress={debugTestNotification} style={styles.debugBtn}>
            <Text>Send local test notification</Text>
          </Pressable>

          <View style={styles.separator} />

          {/* Logout */}
          <Button title="Log Out" color="red" onPress={handleLogout} />
        </View>
      </KeyboardAvoidingView>
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
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
  separator: { height: 24 },
});