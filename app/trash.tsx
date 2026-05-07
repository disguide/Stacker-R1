import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Animated, LayoutAnimation } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMail } from '../src/features/mail/useMail';
import { MailMessage } from '../src/services/storage';

export default function TrashScreen() {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { trashedMessages, emptyTrash, restoreFromTrash, deleteMessage } = useMail();

    const handleRestore = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        restoreFromTrash(id);
    };

    const handlePermanentDelete = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        deleteMessage(id);
    };

    const renderItem = ({ item }: { item: MailMessage }) => {
        const dateString = new Date(item.trashedAt || item.date).toLocaleDateString([], { month: 'short', day: 'numeric' });

        const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
            const trans = dragX.interpolate({
                inputRange: [-160, 0],
                outputRange: [1, 0],
                extrapolate: 'clamp',
            });
            return (
                <View style={styles.rightActionContainer}>
                    <Animated.View style={{ flex: 1, flexDirection: 'row', transform: [{ translateX: trans }] }}>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10B981' }]} onPress={() => handleRestore(item.id)}>
                            <MaterialCommunityIcons name="restore" size={24} color="#FFF" />
                            <Text style={styles.actionText}>{t('mail.restore')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#EF4444' }]} onPress={() => handlePermanentDelete(item.id)}>
                            <MaterialCommunityIcons name="delete-forever" size={24} color="#FFF" />
                            <Text style={styles.actionText}>{t('mail.purge')}</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            );
        };

        return (
            <Swipeable renderRightActions={renderRightActions} friction={2}>
                <View style={styles.mailRow}>
                    <View style={styles.mailContent}>
                        <View style={styles.mailHeaderRow}>
                            <Text style={styles.senderText} numberOfLines={1}>
                                {item.sender}
                            </Text>
                            <Text style={styles.dateText}>
                                {dateString}
                            </Text>
                        </View>
                        <Text style={styles.subjectText} numberOfLines={1}>
                            {item.subject}
                        </Text>
                        <Text style={styles.previewText} numberOfLines={2}>
                            {item.preview}
                        </Text>
                    </View>
                </View>
            </Swipeable>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn}>
                    <Ionicons name="chevron-back" size={28} color="#007AFF" />
                    <Text style={styles.headerBackText}>{t('mail.inbox')}</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('mail.trash')}</Text>
                <TouchableOpacity onPress={emptyTrash} style={styles.headerRightBtn} disabled={trashedMessages.length === 0}>
                    <Text style={[styles.headerLinkText, trashedMessages.length === 0 && styles.disabledText]}>{t('mail.emptyTrashBtn')}</Text>
                </TouchableOpacity>
            </View>

            {trashedMessages.length === 0 ? (
                <View style={styles.centered}>
                    <MaterialCommunityIcons name="delete-empty-outline" size={64} color="#E2E8F0" />
                    <Text style={styles.emptyTitle}>{t('mail.emptyTrash')}</Text>
                    <Text style={styles.emptyText}>{t('mail.emptyTrashSub')}</Text>
                </View>
            ) : (
                <FlatList
                    data={trashedMessages}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
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
        alignItems: 'flex-end',
        paddingRight: 8,
    },
    headerLinkText: {
        fontSize: 17,
        color: '#EF4444',
    },
    disabledText: {
        color: '#94A3B8',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingBottom: 60,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#334155',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 24,
    },
    listContent: {
        paddingVertical: 8,
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#E2E8F0',
        marginLeft: 16,
    },
    rightActionContainer: {
        width: 160, // 80 per button
        flexDirection: 'row',
    },
    actionBtn: {
        width: 80,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
    },
    mailRow: {
        flexDirection: 'row',
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
    },
    mailContent: {
        flex: 1,
        justifyContent: 'center',
    },
    mailHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    senderText: {
        fontSize: 16,
        color: '#334155',
        flex: 1,
    },
    dateText: {
        fontSize: 13,
        color: '#94A3B8',
        marginLeft: 8,
    },
    subjectText: {
        fontSize: 15,
        color: '#1E293B',
        marginBottom: 4,
        fontWeight: '600',
    },
    previewText: {
        fontSize: 14,
        color: '#64748B',
        lineHeight: 20,
    },
});
