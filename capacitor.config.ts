import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bandplan.app',
  appName: 'BandPlan',
  // WHY: Capacitor must package the optimized production output, not raw source files.
  webDir: 'dist',
  ...(process.env.CAPACITOR_DEV_SERVER_URL ? { server: { url: process.env.CAPACITOR_DEV_SERVER_URL, cleartext: process.env.CAPACITOR_DEV_SERVER_URL.startsWith('http://'), androidScheme: 'https' } } : {}),
  android: {
    backgroundColor: '#14161C'
  },
  ios: {
    contentInset: 'automatic'
  }
};

export default config;
