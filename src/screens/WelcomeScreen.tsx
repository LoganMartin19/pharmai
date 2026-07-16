import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/MainNavigator'; // update if needed
import styles from './styles/WelcomeScreen.styles';
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

export default function WelcomeScreen() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <View style={styles.container}>
      <View style={styles.brandMark}><Ionicons name="medical" size={29} color="#fff"/></View>
      <Text style={styles.title}>PharmAI</Text>
      <Text style={styles.hero}>Medicines made clearer.</Text>
      <Text style={styles.subtitle}>Understand your medication, remember every dose and stay connected to care.</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={styles.buttonText}>Sign in securely</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.outlineButton]}
        onPress={() => navigation.navigate('SignUp')}
      >
        <Text style={[styles.buttonText, styles.outlineText]}>Create an account</Text>
      </TouchableOpacity>
      <Text style={styles.trust}>Private by design · NHS-grounded information</Text>
    </View>
  );
}
