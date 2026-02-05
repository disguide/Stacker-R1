import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';


export default function Layout() {
    return (
        <>
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
            </Stack>
        </>
    );
}
