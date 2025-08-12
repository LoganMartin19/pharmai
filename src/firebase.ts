// src/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAICBS8rmtd4_a3Bb7PCLy5PFFug3xsJg0',
  authDomain: 'pharmai-d45ab.firebaseapp.com',
  projectId: 'pharmai-d45ab',
  storageBucket: 'pharmai-d45ab.appspot.com',
  messagingSenderId: '1030838447761',
  appId: '1:1030838447761:web:c409c6556c4947d1e19930',
  measurementId: 'G-3T9JRT71D9',
};

// Ensure single app instance (safe for hot reload / multiple imports)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;