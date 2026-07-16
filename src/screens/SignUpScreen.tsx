import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { colors, radius, type } from '../theme';
import { Eyebrow } from '../components/Primitives';

export default function SignUpScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      Alert.alert('Missing name', 'Please enter your name.');
      return;
    }
    if (!trimmedEmail || !pw) {
      Alert.alert('Missing details', 'Please enter your email and password.');
      return;
    }

    try {
      setLoading(true);
      const { user } = await createUserWithEmailAndPassword(auth, trimmedEmail, pw);
      await updateProfile(user, { displayName: trimmedName });

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: trimmedName,
        createdAt: serverTimestamp(),
      });

      Alert.alert('Welcome!', `Account created for ${trimmedName}`);
      navigation.replace('Main');
    } catch (e: any) {
      Alert.alert('Sign up failed', e?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Eyebrow>Get started</Eyebrow><Text style={styles.title}>Create your account</Text><Text style={styles.subtitle}>A calmer, safer way to manage everyday medicines.</Text>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Full name"
        placeholderTextColor={colors.inkMuted}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="next"
        style={styles.input}
      />

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor={colors.inkMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        style={styles.input}
      />

      <TextInput
        value={pw}
        onChangeText={setPw}
        placeholder="Password"
        placeholderTextColor={colors.inkMuted}
        secureTextEntry
        autoCapitalize="none"
        textContentType="newPassword"
        returnKeyType="done"
        style={styles.input}
      />

      <Pressable
        onPress={onSubmit}
        disabled={loading}
        style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
      >
        <Text style={styles.primaryBtnText}>{loading ? 'Creating…' : 'Sign up'}</Text>
      </Pressable>

      <Pressable onPress={() => navigation.navigate('Login')} style={{ marginTop: 16 }}>
        <Text style={{ textAlign: 'center' }}>
          Already have an account? <Text style={{ fontWeight: '700' }}>Sign in</Text>
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,padding:24,justifyContent:'center',backgroundColor:colors.background},
  title: {
    ...type.hero,color:colors.ink,marginTop:7,
  },
  subtitle:{...type.body,color:colors.inkMuted,marginTop:7,marginBottom:26},
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  primaryBtn: {
    backgroundColor: colors.brand,
    paddingVertical: 15,
    borderRadius: radius.pill,
    marginTop: 8,
  },
  primaryBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
