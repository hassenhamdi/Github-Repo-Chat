import { GeminiModel } from '@/types';

export interface AppSettings {
  geminiApiKey: string;
  githubAccessToken: string;
  geminiModel: GeminiModel;
}

const SETTINGS_KEY = 'appSettings';

export const settingsService = {
  saveSettings(settings: AppSettings): void {
    try {
      const settingsJson = JSON.stringify(settings);
      localStorage.setItem(SETTINGS_KEY, settingsJson);
    } catch (error) {
      console.error('Failed to save settings to localStorage', error);
    }
  },

  loadSettings(): AppSettings | null {
    try {
      const settingsJson = localStorage.getItem(SETTINGS_KEY);
      if (settingsJson) {
        return JSON.parse(settingsJson);
      }
      return null;
    } catch (error) {
      console.error('Failed to load settings from localStorage', error);
      return null;
    }
  },
};