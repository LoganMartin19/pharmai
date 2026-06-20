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

try {
  // Defer notification native module access so app startup survives if it is unavailable.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const notifee = require('@notifee/react-native').default;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { backgroundNotificationHandler } = require('./src/utils/notifications');
  notifee.onBackgroundEvent(backgroundNotificationHandler);
} catch (e) {
  console.warn('Background notifications unavailable at startup', e);
}

AppRegistry.registerComponent(appName, () => App);
