import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * تخزين التوكن: SecureStore على الجوال (مشفّر)، وlocalStorage على الويب
 * لأن SecureStore غير مدعوم هناك.
 */
export const tokenStorage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },

  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        /* التخزين معطّل في المتصفح — نتجاهل */
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },

  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        /* تجاهل */
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
