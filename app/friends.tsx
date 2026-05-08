import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

export default function FriendsScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { t } = useTranslation();

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn}>
                    <Ionicons name="chevron-back" size={28} color="#007AFF" />
                    <Text style={styles.headerBackText}>{t('common.back')}</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('friends.title')}</Text>
                <View style={styles.headerRightBtn} />
            </View>

            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <MaterialCommunityIcons name="traffic-cone" size={64} color="#F59E0B" />
                </View>
                <Text style={styles.title}>{t('friends.underConstruction')}</Text>
                <Text style={styles.placeholderText}>
                    {t('friends.placeholder')}
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        backgroundColor: '#FFFFFF',
    },
    headerBackBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        minWidth: 80,
    },
    headerBackText: {
        fontSize: 17,
        color: '#007AFF',
        marginLeft: -4,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#0F172A',
    },
    headerRightBtn: {
        minWidth: 80,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingBottom: 60,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 12,
    },
    placeholderText: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 24,
    },
});
