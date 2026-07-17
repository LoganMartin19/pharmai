const appJson = require('./app.json');

module.exports = {
  name: appJson.displayName,
  slug: 'pharmai',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'pharmai',
  newArchEnabled: true,
  ios: {
    bundleIdentifier: 'Logan.PharmAI',
    buildNumber: '23',
    supportsTablet: false,
    icon: './assets/icon.png',
    config: {
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      CFBundleIconName: 'AppIcon',
      CFBundlePackageType: 'APPL',
      NSCameraUsageDescription: 'PharmAI uses the camera to scan prescriptions and medication bottles.',
      NSLocationWhenInUseUsageDescription: 'PharmAI uses your location to show nearby pharmacies for refills.',
    },
  },
  plugins: [
    'expo-dev-client',
    'expo-camera',
    'expo-notifications',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0B5F65',
        image: './assets/icon.png',
        imageWidth: 180,
        resizeMode: 'contain',
      },
    ],
    '@react-native-community/datetimepicker',
  ],
  extra: {
    eas: {
      projectId: '1c93a68c-0a1a-48b9-bce4-e89e1fc7a7b3',
    },
  },
};
