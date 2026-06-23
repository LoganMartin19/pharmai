import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/MainNavigator';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export default function LoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter both email and password.');
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
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
      <Text style={styles.title}>Login to PharmAI</Text>

      <TextInput
        style={styles.input}
        placeholder="Username / email"
        placeholderTextColor="#6B7280"
        keyboardType="email-address"
        autoCapitalize="none"
        onChangeText={setEmail}
        value={email}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#6B7280"
        secureTextEntry
        onChangeText={setPassword}
        value={password}
      />

      <Pressable onPress={handlePasswordReset}>
        <Text style={styles.forgotText}>Forgot Password?</Text>
      </Pressable>

      <Pressable style={styles.loginButton} onPress={handleLogin}>
        <Text style={styles.loginButtonText}>Login</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center', padding: 20
  },
  title: {
    fontSize: 24, marginBottom: 20, textAlign: 'center'
  },
  input: {
    height: 48, borderColor: '#9CA3AF', borderWidth: 1, marginBottom: 12, paddingHorizontal: 12, borderRadius: 8, color: '#111827'
  },
  forgotText: {
    color: '#007bff',
    marginBottom: 20,
    textAlign: 'right',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: '#0A84FF',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
