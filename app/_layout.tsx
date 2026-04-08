import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../src/providers/AuthProvider';
import { StorageService } from '../src/services/storage';
import { SyncService } from '../src/services/SyncService';
import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// Prevent the splash screen from auto-hiding before asset/data loading is complete
SplashScreen.preventAutoHideAsync();

function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    
    // Check initial launch state exactly once
    const [hasCheckedInit, setHasCheckedInit] = useState(false);

    useEffect(() => {
        if (isLoading || hasCheckedInit) return;

        StorageService.loadUIState().then(state => {
            const hasSeen = !!state?.hasSeenAuth;
            if (!user && !hasSeen) {
                // First-time user, route to auth options
                setTimeout(() => {
                    router.replace('/auth');
                }, 0);
            }
            setHasCheckedInit(true);
        });
    }, [isLoading, hasCheckedInit, user, router]);

    // Sync Triggers
    useEffect(() => {
        if (!user) return;

        // Initial sync on mount
        SyncService.sync();

        // AppState sync trigger (Foregrounding)
        const appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                SyncService.sync();
            }
        });

        // NetInfo sync trigger (Reconnection)
        const unsubscribeNetInfo = NetInfo.addEventListener(state => {
            if (state.isConnected && state.isInternetReachable) {
                SyncService.sync();
            }
        });

        return () => {
            appStateSubscription.remove();
            unsubscribeNetInfo();
        };
    }, [user]);

    return <>{children}</>;
}

export default function Layout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <AuthProvider>
                <AuthGuard>
                    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
                        <Stack.Screen name="index" />
                        <Stack.Screen name="auth" />
                        <Stack.Screen name="settings" />
                    </Stack>
                    <StatusBar style="dark" />
                </AuthGuard>
            </AuthProvider>
        </GestureHandlerRootView>
    );
}
