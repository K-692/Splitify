import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.splitify.app',
  appName: 'Splitify',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '268134159684-91qvrjihpdui4rrdsd8irfv4vq2u99a5.apps.googleusercontent.com',
      clientId: '268134159684-91qvrjihpdui4rrdsd8irfv4vq2u99a5.apps.googleusercontent.com',
      androidClientId: '268134159684-91qvrjihpdui4rrdsd8irfv4vq2u99a5.apps.googleusercontent.com',
      forceCodeForRefreshToken: false,
    },
  },
};

export default config;
