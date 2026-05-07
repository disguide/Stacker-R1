import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK
};

const CHUNK_SIZE = 1800; // safely under the 2048-byte SecureStore limit

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    // Try chunked first
    const countStr = await SecureStore.getItemAsync(`${key}__chunkCount`, SECURE_OPTIONS);
    if (countStr) {
      const count = parseInt(countStr, 10);
      let value = '';
      for (let i = 0; i < count; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}__chunk_${i}`, SECURE_OPTIONS);
        if (chunk == null) return null;
        value += chunk;
      }
      return value;
    }
    // Fallback: try reading as a plain value (for keys written before this change)
    return SecureStore.getItemAsync(key, SECURE_OPTIONS);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (value.length <= CHUNK_SIZE) {
      // Small enough — store directly and clear any old chunks
      await SecureStore.setItemAsync(key, value, SECURE_OPTIONS);
      await SecureStore.deleteItemAsync(`${key}__chunkCount`, SECURE_OPTIONS).catch(() => {});
      return;
    }
    // Split into chunks
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}__chunk_${i}`, chunks[i], SECURE_OPTIONS);
    }
    await SecureStore.setItemAsync(`${key}__chunkCount`, String(chunks.length), SECURE_OPTIONS);
    // Remove plain key if it existed before
    await SecureStore.deleteItemAsync(key, SECURE_OPTIONS).catch(() => {});
  },
  removeItem: async (key: string): Promise<void> => {
    const countStr = await SecureStore.getItemAsync(`${key}__chunkCount`, SECURE_OPTIONS);
    if (countStr) {
      const count = parseInt(countStr, 10);
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}__chunk_${i}`, SECURE_OPTIONS).catch(() => {});
      }
      await SecureStore.deleteItemAsync(`${key}__chunkCount`, SECURE_OPTIONS).catch(() => {});
    }
    await SecureStore.deleteItemAsync(key, SECURE_OPTIONS).catch(() => {});
  },
};

const supabaseUrl = 'https://wwwtcbcaovezkyccytbp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3d3RjYmNhb3Zlemt5Y2N5dGJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTE3ODIsImV4cCI6MjA5MTE2Nzc4Mn0.hqipz-EBCZ82XVYOsY0n2fMWh-ymdg77RJpXh4k3qQc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Relevant only for web
  },
});

export const deleteUserAccount = async () => {
    const { error } = await supabase.rpc('delete_user');
    if (!error) {
        await supabase.auth.signOut();
    }
    return { error };
};
