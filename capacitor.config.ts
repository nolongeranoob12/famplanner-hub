import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.chaufamily',
  appName: 'ChauFamily',
  webDir: 'dist',
  server: {
    url: 'https://988db1b8-75b3-4cac-b3c6-e50c80ce8492.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
