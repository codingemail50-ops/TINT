import { Ionicons } from '@expo/vector-icons';

// Shared catalog of "commonly distracting" apps a user can flag to be
// blocked during a focus session. Used by both the Focus screen's full
// picker sheet and the onboarding goal screen's compact preview — kept in
// one place so the two never drift out of sync on ids/icons/storage key.
export interface BlockableApp {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string; // brand color, used as the chip background
}

export const BLOCKABLE_APPS: BlockableApp[] = [
  { id: 'instagram', label: 'Instagram', icon: 'logo-instagram', color: '#E1306C' },
  { id: 'youtube', label: 'YouTube', icon: 'logo-youtube', color: '#FF0000' },
  { id: 'tiktok', label: 'TikTok', icon: 'logo-tiktok', color: '#111111' },
  { id: 'twitter', label: 'Twitter / X', icon: 'logo-twitter', color: '#1DA1F2' },
  { id: 'reddit', label: 'Reddit', icon: 'logo-reddit', color: '#FF4500' },
  { id: 'snapchat', label: 'Snapchat', icon: 'logo-snapchat', color: '#FFFC00' },
];

export const DEFAULT_BLOCKED_APPS = ['instagram', 'youtube', 'tiktok'];

export const BLOCKED_APPS_STORAGE_KEY = 'tint_blocked_apps';
