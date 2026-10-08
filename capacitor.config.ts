import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bandplan.app',
  appName: 'BandPlan',
  webDir: '.',
  server: {
    androidScheme: 'https'
  },
  android: {
    backgroundColor: '#14161C'
  },
  ios: {
    contentInset: 'automatic'
  }
};

export default config;
