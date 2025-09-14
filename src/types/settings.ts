import { ReactNode } from 'react';

export interface SettingsItem {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  path: string;
}