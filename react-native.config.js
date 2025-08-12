const { execSync } = require('child_process');

function getLocalIp() {
  try {
    return execSync('ipconfig getifaddr en0').toString().trim();
  } catch (e) {
    return 'localhost'; // fallback if IP detection fails
  }
}

module.exports = {
  reactNativePath: './node_modules/react-native',
  codegenConfig: {
    avoidReactNativeCodegen: true,
  },
  assets: ['./ios/RNFonts 2'],
  server: {
    host: getLocalIp(), // 👈 This makes Metro listen on your local IP for real iPhone
  },
};