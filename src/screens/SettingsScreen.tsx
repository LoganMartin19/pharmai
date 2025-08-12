import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Button,
  Alert,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/MainNavigator';
import SafeLayout from '../components/SafeLayout';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

export default function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [userName, setUserName] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const storedName = await AsyncStorage.getItem('userName');
      const notifSetting = await AsyncStorage.getItem('notificationsEnabled');
      if (storedName) setUserName(storedName);
      setNotificationsEnabled(notifSetting === 'true');
    };
    loadSettings();
  }, []);

  const toggleNotifications = async () => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    await AsyncStorage.setItem('notificationsEnabled', String(newValue));
    Alert.alert('Preferences saved', `Notifications turned ${newValue ? 'on' : 'off'}`);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth); // ✅ Properly sign out from Firebase
      await AsyncStorage.clear(); // ✅ Clear local storage
      navigation.reset({
        index: 0,
        routes: [{ name: 'Welcome' }],
      });
    } catch (error) {
      Alert.alert('Logout Failed', 'Please try again.');
    }
  };

  return (
    <SafeLayout>
      <Text style={styles.sectionTitle}>Account Details</Text>
      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={userName} editable={false} />

      <Text style={styles.sectionTitle}>Preferences</Text>
      <View style={styles.prefRow}>
        <Text style={styles.label}>Notifications</Text>
        <Switch
          value={notificationsEnabled}
          onValueChange={toggleNotifications}
        />
      </View>

      <View style={styles.separator} />
      <Button title="Log Out" color="red" onPress={handleLogout} />
    </SafeLayout>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  separator: {
    height: 24,
  },
});