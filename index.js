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

import notifee from '@notifee/react-native';
import { backgroundNotificationHandler } from './src/utils/notifications';
notifee.onBackgroundEvent(backgroundNotificationHandler);

AppRegistry.registerComponent(appName, () => App);
