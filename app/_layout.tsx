import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function Layout() {
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
