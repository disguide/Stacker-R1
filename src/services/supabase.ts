import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK
};

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key, SECURE_OPTIONS);
  },
  setItem: (key: string, value: string) => {
    SecureStore.setItemAsync(key, value, SECURE_OPTIONS);
  },
  removeItem: (key: string) => {
    SecureStore.deleteItemAsync(key, SECURE_OPTIONS);
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
