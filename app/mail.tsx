import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Animated, LayoutAnimation } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMail } from '../src/features/mail/useMail';
import { MailMessage } from '../src/services/storage';

export default function MailScreen() {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { inboxMessages, loading, markAllAsRead, moveToTrash } = useMail();

    const handleDelete = (id: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        moveToTrash(id);
    };

    const renderItem = ({ item }: { item: MailMessage }) => {
        const isRead = item.read;
        const dateString = new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' });

        const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
            const trans = dragX.interpolate({
                inputRange: [-100, 0],
                outputRange: [1, 0],
                extrapolate: 'clamp',
            });
            return (
                <View style={styles.rightActionContainer}>
                    <Animated.View style={{ flex: 1, transform: [{ translateX: trans }] }}>
                        <TouchableOpacity style={styles.deleteAction} onPress={() => handleDelete(item.id)}>
                            <MaterialCommunityIcons name="trash-can-outline" size={24} color="#FFF" />
                            <Text style={styles.actionText}>{t('mail.trash')}</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            );
        };

        return (
            <Swipeable renderRightActions={renderRightActions} friction={2}>
                <TouchableOpacity
                    style={[styles.mailRow, !isRead && styles.mailRowUnread]}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/message/${item.id}` as any)}
                >
                    {/* Unread dot */}
                    <View style={styles.unreadIndicatorContainer}>
                        {!isRead && <View style={styles.unreadDot} />}
                    </View>

                    <View style={styles.mailContent}>
                        <View style={styles.mailHeaderRow}>
                            <Text style={[styles.senderText, !isRead && styles.textBold]} numberOfLines={1}>
                                {item.sender}
                            </Text>
                            <Text style={[styles.dateText, !isRead && styles.textBoldDate]}>
                                {dateString}
                            </Text>
                        </View>
                        <Text style={[styles.subjectText, !isRead && styles.textBold]} numberOfLines={1}>
                            {item.subject}
                        </Text>
                        <Text style={styles.previewText} numberOfLines={2}>
                            {item.preview}
                        </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={16} color="#CBD5E1" style={styles.chevron} />
                </TouchableOpacity>
            </Swipeable>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn}>
                    <Ionicons name="chevron-back" size={28} color="#007AFF" />
                    <Text style={styles.headerBackText}>{t('common.back')}</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('mail.inbox')}</Text>
                <View style={styles.headerRightGroup}>
                    <TouchableOpacity onPress={markAllAsRead} style={styles.headerIconBtn}>
                        <MaterialCommunityIcons name="email-check-outline" size={24} color="#64748B" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => router.push('/trash')} style={styles.headerIconBtn}>
                        <MaterialCommunityIcons name="trash-can-outline" size={24} color="#64748B" />
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#007AFF" />
                </View>
            ) : inboxMessages.length === 0 ? (
                <View style={styles.centered}>
                    <MaterialCommunityIcons name="email-open-outline" size={64} color="#E2E8F0" />
                    <Text style={styles.emptyTitle}>{t('mail.emptyInbox')}</Text>
                    <Text style={styles.emptyText}>{t('mail.emptyInboxSub')}</Text>
                </View>
            ) : (
                <FlatList
                    data={inboxMessages}
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
    headerRightGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: 8,
    },
    headerIconBtn: {
        marginRight: 16,
    },
    headerRightBtn: {
        minWidth: 60,
        alignItems: 'flex-end',
    },
    headerLinkText: {
        fontSize: 17,
        color: '#007AFF',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingBottom: 60,
    },
    listContent: {
        paddingVertical: 8,
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#E2E8F0',
        marginLeft: 28, // align with text, bypassing dot
    },
    rightActionContainer: {
        width: 80,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
    },
    deleteAction: {
        flex: 1,
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
        paddingRight: 16,
        paddingLeft: 8,
        backgroundColor: '#FFFFFF',
    },
    mailRowUnread: {
        backgroundColor: '#F8FAFC',
    },
    unreadIndicatorContainer: {
        width: 20,
        alignItems: 'center',
        paddingTop: 4,
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#007AFF',
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
    },
    previewText: {
        fontSize: 14,
        color: '#64748B',
        lineHeight: 20,
    },
    textBold: {
        fontWeight: '700',
        color: '#0F172A',
    },
    textBoldDate: {
        fontWeight: '600',
        color: '#007AFF',
    },
    chevron: {
        alignSelf: 'center',
        marginLeft: 8,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1E293B',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 16,
        color: '#64748B',
        textAlign: 'center',
    },
});
