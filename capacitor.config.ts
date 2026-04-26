import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.CAP_ENV === 'development';

const config: CapacitorConfig = {
  appId: 'com.nolongeranoob12.famplannerhub',
  appName: 'Family Connect Hub',
  version: '1.0.1',
  webDir: 'dist',
  // Hot-reload from Lovable sandbox is enabled ONLY when CAP_ENV=development.
  // For App Store builds, do NOT set CAP_ENV — the app will load the bundled
  // web assets from `dist/` instead of a remote URL (required by Apple).
  ...(isDev
    ? {
        server: {
          url: 'https://988db1b8-75b3-4cac-b3c6-e50c80ce8492.lovableproject.com?forceHideBadge=true',
          cleartext: true,
        },
      }
    : {}),
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
