import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../src/providers/AuthProvider';
import { StorageService } from '../src/services/storage';
import { triggerSync } from '../src/services/SyncService';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

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

    return <>{children}</>;
}

/**
 * Foreground sync hook — triggers a debounced sync when the app returns to active.
 * Must be rendered INSIDE <AuthProvider> so session is available.
 */
function ForegroundSync() {
    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active') {
                triggerSync(); // Debounced — safe to call frequently
            }
        });

        return () => subscription.remove();
    }, []);

    return null;
}

export default function Layout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <AuthProvider>
                <ForegroundSync />
                <AuthGuard>
                    <StatusBar style="dark" />
                    <Stack
                    screenOptions={{
                        headerShown: false,
                    }}
                >
                    <Stack.Screen name="index" options={{ gestureEnabled: false }} />
                    <Stack.Screen name="profile" />
                    <Stack.Screen name="mail" />
                    <Stack.Screen name="settings" />
                    <Stack.Screen name="auth" />
                    <Stack.Screen name="sprint" />
                    <Stack.Screen name="sprint-summary" />
                    <Stack.Screen name="long-term" />
                    <Stack.Screen name="timeline" />
                    <Stack.Screen name="identity" />
                </Stack>
                </AuthGuard>
            </AuthProvider>
        </GestureHandlerRootView>
    );
}
