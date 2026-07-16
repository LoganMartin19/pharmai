import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/MainNavigator';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { colors, radius, type } from '../theme';
import { Eyebrow } from '../components/Primitives';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;
const SAVED_LOGIN_EMAIL_KEY = 'login:savedEmail';
const REMEMBER_LOGIN_KEY = 'login:rememberEmail';

export default function LoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const remember = await AsyncStorage.getItem(REMEMBER_LOGIN_KEY);
        const savedEmail = await AsyncStorage.getItem(SAVED_LOGIN_EMAIL_KEY);
        const shouldRemember = remember === 'true';
        setRememberEmail(shouldRemember);
        if (shouldRemember && savedEmail) setEmail(savedEmail);
      } catch (error) {
        console.warn('load saved login failed', error);
      }
    })();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter both email and password.');
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      if (rememberEmail) {
        await AsyncStorage.multiSet([
          [REMEMBER_LOGIN_KEY, 'true'],
          [SAVED_LOGIN_EMAIL_KEY, email.trim()],
        ]);
      } else {
        await AsyncStorage.multiRemove([REMEMBER_LOGIN_KEY, SAVED_LOGIN_EMAIL_KEY]);
      }
      navigation.navigate('Main');
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    }
  };

  const handlePasswordReset = () => {
    navigation.navigate('ResetPassword');
  };

  return (
    <View style={styles.container}>
      <Eyebrow>Welcome back</Eyebrow>
      <Text style={styles.title}>Sign in to PharmAI</Text>
      <Text style={styles.subtitle}>Your medication and care information stays protected.</Text>

      <TextInput
        style={styles.input}
        placeholder="Username / email"
        placeholderTextColor={colors.inkMuted}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="username"
        onChangeText={setEmail}
        value={email}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.inkMuted}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        onChangeText={setPassword}
        value={password}
      />

      <Pressable style={styles.rememberRow} onPress={() => setRememberEmail((value) => !value)}>
        <View style={[styles.checkbox, rememberEmail && styles.checkboxSelected]}>
          {rememberEmail ? <Text style={styles.checkmark}>✓</Text> : null}
        </View>
        <Text style={styles.rememberText}>Save email for next time</Text>
      </Pressable>

      <Pressable onPress={handlePasswordReset}>
        <Text style={styles.forgotText}>Forgot Password?</Text>
      </Pressable>

      <Pressable style={styles.loginButton} onPress={handleLogin}>
        <Text style={styles.loginButtonText}>Sign in securely</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center', padding: 24, backgroundColor:colors.background
  },
  title: {
    ...type.hero, color:colors.ink, marginTop:7
  },
  subtitle:{...type.body,color:colors.inkMuted,marginTop:7,marginBottom:26},
  input: {
    minHeight: 52, borderColor: colors.line, borderWidth: 1, marginBottom: 12, paddingHorizontal: 15, borderRadius: radius.md, color: colors.ink, backgroundColor:colors.surface
  },
  forgotText: {
    color: colors.brand,
    marginBottom: 20,
    textAlign: 'right',
    fontSize: 14,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: '#fff',
  },
  checkboxSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  checkmark: {
    color: '#fff',
    fontWeight: '900',
  },
  rememberText: {
    color: colors.ink,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
