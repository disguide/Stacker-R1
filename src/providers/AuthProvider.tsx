import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Session, User } from '@supabase/supabase-js';
import { triggerSync, migrateGuestToCloud } from '../services/SyncService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MIGRATION_DONE_PREFIX = '@stacker_migrated_';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  authEvent: string | null;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  authEvent: null,
});

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authEvent, setAuthEvent] = useState<string | null>(null);
  
  // Track whether we had a user when the provider first mounted
  // `null` means "checked and no user was present" (guest)
  // A string means "user was logged in at boot"
  const initialUserRef = useRef<string | null>(null);
  const bootCheckedRef = useRef(false); // Whether getSession has resolved

  /**
   * Core migration logic — extracted so both SIGNED_IN and INITIAL_SESSION can use it.
   */
  const handleUserAuthenticated = async (userId: string) => {
    const migrationKey = MIGRATION_DONE_PREFIX + userId;
    const alreadyMigrated = await AsyncStorage.getItem(migrationKey);

    if (!alreadyMigrated) {
      if (__DEV__) console.log('[AuthProvider] New user detected — triggering guest-to-cloud migration.');
      await migrateGuestToCloud();
      await AsyncStorage.setItem(migrationKey, new Date().toISOString());
      if (__DEV__) console.log('[AuthProvider] Migration complete and flagged.');
    } else {
      if (__DEV__) console.log('[AuthProvider] User already migrated — normal sync.');
      triggerSync();
    }
  };

  useEffect(() => {
    // Check active session on boot
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      // Record who was logged in at boot time
      initialUserRef.current = session?.user?.id ?? null;
      bootCheckedRef.current = true;

      // If already logged in at boot, trigger a normal sync
      if (session?.user) {
        triggerSync();
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (__DEV__) console.log('[AuthProvider] Auth event:', event, 'user:', session?.user?.id ?? 'none');
        
        setAuthEvent(event);
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);

        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          const newUserId = session.user.id;
          const wasLoggedInAtBoot = initialUserRef.current;
          const hasBooted = bootCheckedRef.current;
          
          // Determine if this is a "new" sign-in that needs migration:
          //   1. Boot hasn't resolved yet (race condition) — treat as fresh sign-in
          //   2. No user at boot (guest → signed in)
          //   3. Different user than boot (account switch)
          const isFreshSignIn = !hasBooted || wasLoggedInAtBoot === null || 
            (wasLoggedInAtBoot && wasLoggedInAtBoot !== newUserId);
          
          if (isFreshSignIn) {
            await handleUserAuthenticated(newUserId);
          } else {
            // Same user, just a session refresh or token renewal
            if (event === 'SIGNED_IN') {
              triggerSync();
            }
          }
          
          // Update the ref so future comparisons work for account switching
          initialUserRef.current = newUserId;
          bootCheckedRef.current = true;
        }

        if (event === 'SIGNED_OUT') {
          // Clear so next sign-in triggers migration
          initialUserRef.current = null;
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, isLoading, authEvent }}>
      {children}
    </AuthContext.Provider>
  );
};

