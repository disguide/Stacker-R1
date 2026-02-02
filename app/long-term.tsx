import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LongTermScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Long Term Planning</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.section}>
                    <Ionicons name="planet-outline" size={48} color="#6366F1" style={styles.icon} />
                    <Text style={styles.title}>Future Visions</Text>
                    <Text style={styles.subtitle}>Plan your goals for next year and beyond.</Text>

                    <View style={styles.card}>
                        <Text style={styles.cardText}>Coming Soon...</Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6'
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    content: { padding: 24, alignItems: 'center' },
    section: { alignItems: 'center', marginTop: 40 },
    icon: { marginBottom: 16 },
    title: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 8 },
    subtitle: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 32 },
    card: {
        backgroundColor: '#FFF',
        padding: 24,
        borderRadius: 16,
        width: '100%',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed'
    },
    cardText: { color: '#9CA3AF', fontWeight: '500' }
});
