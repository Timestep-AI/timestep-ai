import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.d77d4214d9ca41fb93e3cd45315c5548',
  appName: 'brainweave-lab',
  webDir: 'dist',
  server: {
    url: 'https://d77d4214-d9ca-41fb-93e3-cd45315c5548.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  bundledWebRuntime: false,
};

export default config;
