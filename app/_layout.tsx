import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { migrateHistoryToWatermelonDB } from '../src/database/migration';
import { useEffect } from 'react';

// Prevent the splash screen from auto-hiding before asset/data loading is complete
SplashScreen.preventAutoHideAsync();

export default function Layout() {

    useEffect(() => {
        let mounted = true;
        const prepare = async () => {
            try {
                // Migrate any old AsyncStorage data to WatermelonDB on startup
                await migrateHistoryToWatermelonDB();
            } catch (e) {
                console.warn('Migration failed or skipped:', e);
            } finally {
                // Tell the application to render
                if (mounted) {
                    SplashScreen.hideAsync();
                }
            }
        };

        prepare();
        return () => { mounted = false; };
    }, []);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <StatusBar style="dark" />
            <Stack
                screenOptions={{
                    headerShown: false,
                }}
            >
                <Stack.Screen name="index" />
                <Stack.Screen name="profile" />
                <Stack.Screen name="mail" />
                <Stack.Screen name="settings" />
                <Stack.Screen name="sprint" />
                <Stack.Screen name="sprint-summary" />
                <Stack.Screen name="long-term" />
                <Stack.Screen name="timeline" />
                <Stack.Screen name="identity" />
            </Stack>
        </GestureHandlerRootView>
    );
}
