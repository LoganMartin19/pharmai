// index.js

// --- Polyfills MUST come first ---
import 'react-native-get-random-values';
import { TextEncoder, TextDecoder } from 'text-encoding';

// Attach to global if missing (Hermes on RN often lacks these)
if (typeof global.TextEncoder === 'undefined') global.TextEncoder = TextEncoder;
if (typeof global.TextDecoder === 'undefined') global.TextDecoder = TextDecoder;

// ---------------------------------------------------------------

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// 1) Web SDK app (your file runs initializeApp)
import './src/firebase';

// 2) RN Firebase native app must be loaded BEFORE messaging/notifee
import '@react-native-firebase/app';

// ✅ TEMP: prove the native app exists (remove after it prints once)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const rnfb = require('@react-native-firebase/app').default;
  console.log('RNFB app name:', rnfb.app().name);
} catch (e) {
  console.log('RNFB app init failed EARLY:', e);
}

import notifee from '@notifee/react-native';
import { backgroundNotificationHandler } from './src/utils/notifications';
notifee.onBackgroundEvent(backgroundNotificationHandler);

import messaging from '@react-native-firebase/messaging';
messaging().setBackgroundMessageHandler(async () => {});

AppRegistry.registerComponent(appName, () => App);