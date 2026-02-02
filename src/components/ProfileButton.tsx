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
        width: 50,
        height: 50,
        borderRadius: 16, // Smoother corner for larger size
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: 50,
        height: 50,
    },
    head: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        marginBottom: 4,
    },
    body: {
        width: 32,
        height: 16,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        backgroundColor: '#FFFFFF',
    },
});
