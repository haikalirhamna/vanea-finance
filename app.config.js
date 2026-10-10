/**
 * Expo configuration. Release builds drop the INTERNET permission (SYSTEM-OVERVIEW §2.1):
 *   VANEA_RELEASE=1 npx expo prebuild / eas build --profile production
 * Development builds keep it, because Metro needs the network.
 */
const isRelease = process.env.VANEA_RELEASE === '1';

module.exports = {
  expo: {
    name: 'Vanea',
    slug: 'vanea',
    version: '0.1.0',
    scheme: 'vanea',
    orientation: 'portrait',
    icon: './assets/icon.png',
    splash: { image: './assets/splash-icon.png', resizeMode: 'contain', backgroundColor: '#2A1263' },
    userInterfaceStyle: 'automatic',
    platforms: ['android', 'web'],
    android: {
      package: 'app.vanea',
      versionCode: 1,
      adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#2A1263' },
      allowBackup: false, // Auto Backup would copy the database but not its Keystore key (SYSTEM-OVERVIEW §2.2)
      blockedPermissions: isRelease ? ['android.permission.INTERNET'] : [],
      edgeToEdgeEnabled: true,
    },
    web: { bundler: 'metro', output: 'single', favicon: './assets/favicon.png' },
    plugins: [
      'expo-router',
      ['expo-sqlite', { useSQLCipher: true }],
      'expo-secure-store',
      'expo-local-authentication',
      ['expo-notifications', { color: '#6230E0' }],
      'expo-font',
    ],
    experiments: { typedRoutes: false },
  },
};
