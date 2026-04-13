import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';

interface ProfileButtonProps {
    avatarUri?: string;
}

export default function ProfileButton({ avatarUri }: ProfileButtonProps) {
    const router = useRouter();

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={() => router.push('/profile')}
        >
            <View style={styles.avatarContainer}>
                {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                ) : (
                    <>
                        <View style={styles.head} />
                        <View style={styles.body} />
                    </>
                )}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 0, // Removed padding to move it left
    },
    avatarContainer: {
        width: 60,
        height: 60,
        borderRadius: 12,
        backgroundColor: '#F1F5F9', // Soft Grey
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#000000', // Thicker Black Border
    },
    avatarImage: {
        width: 60,
        height: 60,
    },
    head: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#94A3B8', // Slate Grey
        marginBottom: 5,
    },
    body: {
        width: 36,
        height: 18,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        backgroundColor: '#94A3B8', // Slate Grey
    },
});
