import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StorageService, SavedSprint } from '../src/services/storage';

const THEME = {
    bg: '#F8FAFC',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    accent: '#3B82F6',
    border: '#E2E8F0',
};

export default function SprintHistoryScreen() {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [history, setHistory] = useState<SavedSprint[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useFocusEffect(
        React.useCallback(() => {
            StorageService.loadSprintHistory().then(setHistory);
        }, [])
    );

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}${t('journal.h')} ${m}${t('journal.m')}`;
        return `${m}${t('journal.m')}`;
    };

    const handleDelete = async (id: string, e: any) => {
        if (e && e.stopPropagation) e.stopPropagation();
        
        Alert.alert(
            t('sprints.deleteTitle'),
            t('sprints.deleteMsg'),
            [
                { text: t('common.cancel'), style: "cancel" },
                { 
                    text: t('common.delete'), 
                    style: "destructive", 
                    onPress: async () => {
                        await StorageService.deleteSprintHistory(id);
                        const updated = await StorageService.loadSprintHistory();
                        setHistory(updated);
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={28} color={THEME.accent} />
                </TouchableOpacity>
                <Text style={styles.title}>{t('sprints.historyTitle')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {history.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="calendar-outline" size={64} color="#CBD5E1" />
                        <Text style={styles.emptyText}>{t('sprints.noHistory')}</Text>
                    </View>
                ) : (
                    history.map((sprint) => {
                        const isExpanded = expandedId === sprint.id;
                        return (
                            <TouchableOpacity 
                                key={sprint.id} 
                                style={[styles.sprintCard, isExpanded && styles.sprintCardExpanded]}
                                activeOpacity={0.8}
                                onPress={() => setExpandedId(isExpanded ? null : sprint.id)}
                            >
                                <View style={styles.sprintHeaderMain}>
                                    <View style={{ flex: 1 }}>
                                        <View style={styles.titleRow}>
                                            <Text style={styles.sprintTitle} numberOfLines={1}>
                                                {sprint.primaryTask || t('journal.defaultFocusTitle')}
                                            </Text>
                                            <Text style={styles.sprintDate}>
                                                {new Date(sprint.date).toLocaleDateString(undefined, { 
                                                    month: 'short', 
                                                    day: 'numeric'
                                                })}
                                            </Text>
                                        </View>
                                        <View style={styles.statsRow}>
                                            <Text style={styles.statText}>{formatDuration(sprint.durationSeconds)} {t('sprints.focus')}</Text>
                                            <View style={styles.statDot} />
                                            <Text style={styles.statText}>{sprint.taskCount || 0} {t('journal.tasks')}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.headerActions}>
                                        <TouchableOpacity onPress={(e) => handleDelete(sprint.id, e)} style={styles.deleteBtn}>
                                            <Ionicons name="trash-outline" size={18} color="#CBD5E1" />
                                        </TouchableOpacity>
                                        <Ionicons 
                                            name={isExpanded ? "chevron-up" : "chevron-forward"} 
                                            size={18} 
                                            color="#CBD5E1" 
                                            style={{ marginLeft: 8 }}
                                        />
                                    </View>
                                </View>

                                {isExpanded && (
                                    <View style={styles.expandedContent}>
                                        <View style={styles.divider} />
                                        <Text style={styles.sectionLabel}>{t('journal.timeline')}</Text>
                                        {sprint.timelineEvents && sprint.timelineEvents.map((evt: any, idx: number, arr: any[]) => {
                                            const isTask = evt.type === 'task';
                                            const isBreak = evt.type === 'break';
                                            return (
                                                <View key={idx} style={styles.timelineRow}>
                                                    <View style={styles.timelineIndicator}>
                                                        <View style={[
                                                            styles.timelinePoint,
                                                            { backgroundColor: isTask ? '#3B82F6' : (isBreak ? '#10B981' : '#94A3B8') }
                                                        ]} />
                                                        {idx < arr.length - 1 && <View style={styles.timelineConnector} />}
                                                    </View>
                                                    <View style={styles.timelineContent}>
                                                        <View style={styles.timelineTextRow}>
                                                            <Text style={styles.timelineEventTitle} numberOfLines={1}>
                                                                {evt.title}
                                                            </Text>
                                                            <Text style={styles.timelineEventDuration}>
                                                                {formatDuration(evt.durationSeconds)}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.bg },
    header: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        paddingHorizontal: 16, 
        paddingVertical: 12,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: THEME.border
    },
    backBtn: { width: 44, height: 44, justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: 'bold', color: THEME.textPrimary },
    scrollContent: { padding: 16, gap: 12 },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
    emptyText: { marginTop: 16, fontSize: 16, color: THEME.textSecondary, fontStyle: 'italic' },
    
    sprintCard: {
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: THEME.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    sprintCardExpanded: {
        borderColor: THEME.accent,
    },
    sprintHeaderMain: { 
        flexDirection: 'row', 
        alignItems: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    sprintTitle: { 
        fontSize: 16, 
        fontWeight: '700', 
        color: THEME.textPrimary,
        flex: 1,
        marginRight: 8,
    },
    sprintDate: { 
        fontSize: 12, 
        color: THEME.textSecondary,
        fontWeight: '600',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statText: {
        fontSize: 13,
        color: THEME.textSecondary,
        fontWeight: '500',
    },
    statDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#CBD5E1',
        marginHorizontal: 8,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
    },
    deleteBtn: {
        padding: 6,
    },
    
    // Expanded Content
    expandedContent: {
        marginTop: 16,
    },
    divider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 1,
        marginBottom: 12,
    },
    timelineRow: {
        flexDirection: 'row',
        minHeight: 40,
    },
    timelineIndicator: {
        width: 20,
        alignItems: 'center',
        marginRight: 10,
    },
    timelinePoint: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 6,
        zIndex: 2,
    },
    timelineConnector: {
        width: 1.5,
        flex: 1,
        backgroundColor: '#E2E8F0',
        marginTop: 2,
        marginBottom: -6,
        zIndex: 1,
    },
    timelineContent: {
        flex: 1,
        paddingBottom: 12,
    },
    timelineTextRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    timelineEventTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
        maxWidth: '80%',
    },
    timelineEventDuration: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '700',
    },
});
