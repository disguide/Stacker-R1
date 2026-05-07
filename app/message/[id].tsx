import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMail } from '../../src/features/mail/useMail';

export default function MessageScreen() {
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { messages, markAsRead, moveToTrash } = useMail();

    const message = messages.find(m => m.id === id);

    useEffect(() => {
        if (message && !message.read) {
            // Mark as read when opened
            markAsRead(message.id);
        }
    }, [message]);

    if (!message) {
        return (
            <SafeAreaView style={styles.centered}>
                <Text style={styles.errorText}>{t('mail.messageNotFound')}</Text>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Text style={styles.backButtonText}>{t('common.back')}</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const dateString = new Date(message.date).toLocaleDateString(i18n.language, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const timeString = new Date(message.date).toLocaleTimeString(i18n.language, {
        hour: '2-digit',
        minute: '2-digit'
    });

    const handleDelete = () => {
        Alert.alert(t('mail.deleteMessage'), t('mail.deleteConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('common.delete'),
                style: 'destructive',
                onPress: async () => {
                    await moveToTrash(message.id);
                    router.back();
                }
            }
        ]);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.navHeader}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn}>
                    <Ionicons name="chevron-back" size={28} color="#007AFF" />
                    <Text style={styles.headerBackText}>{t('mail.inbox')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDelete} style={styles.headerRightBtn}>
                    <MaterialCommunityIcons name="trash-can-outline" size={24} color="#EF4444" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
                <View style={styles.emailHeader}>
                    <Text style={styles.subject}>{message.subject}</Text>

                    <View style={styles.metaRow}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{message.sender.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={styles.metaTextContainer}>
                            <Text style={styles.sender}>{message.sender}</Text>
                            <Text style={styles.date}>{dateString} {t('mail.at')} {timeString}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.bodyContainer}>
                    <Text style={styles.body}>{message.body}</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    errorText: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 24,
    },
    backButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#007AFF',
        borderRadius: 8,
    },
    backButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 16,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    navHeader: {
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
    },
    headerBackText: {
        fontSize: 17,
        color: '#007AFF',
        marginLeft: -4,
    },
    headerRightBtn: {
        paddingRight: 8,
    },
    emailHeader: {
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 16,
    },
    subject: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 20,
        lineHeight: 32,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    metaTextContainer: {
        flex: 1,
    },
    sender: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 2,
    },
    date: {
        fontSize: 13,
        color: '#64748B',
    },
    divider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginHorizontal: 20,
    },
    bodyContainer: {
        paddingHorizontal: 20,
        paddingTop: 24,
    },
    body: {
        fontSize: 16,
        lineHeight: 26,
        color: '#334155',
    }
});
