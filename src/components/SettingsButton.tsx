import { ActionSheetIOS, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsButton() {
    const router = useRouter();

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={() => router.push('/settings')}
        >
            <Ionicons name="settings-outline" size={24} color="#333" />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 4,
    },
    iconContainer: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        gap: 6,
    },
    sliderRow: {
        height: 2,
        width: '100%',
        justifyContent: 'center',
    },
    line: {
        height: 2,
        width: '100%',
        backgroundColor: '#333333',
        borderRadius: 1,
    },
    dot: {
        position: 'absolute',
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#333333',
        top: -2,
        borderWidth: 1,
        borderColor: '#FFFFFF',
    },
});
