const appJson = require('./app.json');

module.exports = {
  name: appJson.displayName,
  slug: 'pharmai',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'pharmai',
  ios: {
    bundleIdentifier: 'Logan.PharmAI',
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: 'PharmAI uses the camera to scan prescriptions and medication bottles.',
      NSLocationWhenInUseUsageDescription: 'PharmAI uses your location to show nearby pharmacies for refills.',
      UIBackgroundModes: ['remote-notification'],
    },
  },
  extra: {
    eas: {
      projectId: '1c93a68c-0a1a-48b9-bce4-e89e1fc7a7b3',
    },
  },
};
