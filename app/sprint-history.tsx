import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StorageService, SavedSprint } from '../src/services/storage';

const THEME = {
    bg: '#F8FAFC',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    accent: '#3B82F6',
    border: '#E2E8F0',
};

export default function SprintHistoryScreen() {
    const router = useRouter();
    const [history, setHistory] = useState<SavedSprint[]>([]);

    useFocusEffect(
        React.useCallback(() => {
            StorageService.loadSprintHistory().then(setHistory);
        }, [])
    );

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    const handleDelete = async (id: string) => {
        await StorageService.deleteSprintHistory(id);
        const updated = await StorageService.loadSprintHistory();
        setHistory(updated);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={28} color={THEME.accent} />
                </TouchableOpacity>
                <Text style={styles.title}>Sprint History</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {history.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="calendar-outline" size={64} color="#CBD5E1" />
                        <Text style={styles.emptyText}>No sprint history yet.</Text>
                    </View>
                ) : (
                    history.map((sprint) => (
                        <View key={sprint.id} style={styles.sprintCard}>
                            <View style={styles.sprintHeader}>
                                <View style={styles.iconBox}>
                                    <Ionicons name="flash" size={18} color={THEME.accent} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.sprintTitle}>
                                        {sprint.primaryTask || 'Focus Session'}
                                    </Text>
                                    <Text style={styles.sprintDate}>
                                        {new Date(sprint.date).toLocaleDateString(undefined, { 
                                            weekday: 'short', 
                                            month: 'short', 
                                            day: 'numeric'
                                        })}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => handleDelete(sprint.id)} style={styles.deleteBtn}>
                                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.sprintFooter}>
                                <View style={styles.footerStat}>
                                    <Ionicons name="time-outline" size={14} color={THEME.textSecondary} />
                                    <Text style={styles.footerStatText}>{formatDuration(sprint.durationSeconds)}</Text>
                                </View>
                                <View style={styles.footerStat}>
                                    <Ionicons name="checkmark-done" size={14} color={THEME.textSecondary} />
                                    <Text style={styles.footerStatText}>{sprint.taskCount || 0} wins</Text>
                                </View>
                                <View style={styles.intensityBadge}>
                                    <Text style={styles.intensityText}>{sprint.intensity || 0}% Intensity</Text>
                                </View>
                            </View>
                        </View>
                    ))
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
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: 'bold', color: THEME.textPrimary },
    scrollContent: { padding: 16 },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
    emptyText: { marginTop: 16, fontSize: 16, color: THEME.textSecondary, fontStyle: 'italic' },
    sprintCard: {
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: THEME.border,
    },
    sprintHeader: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        marginBottom: 16, 
        gap: 12 
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sprintTitle: { 
        fontSize: 16, 
        fontWeight: '700', 
        color: THEME.textPrimary,
        marginBottom: 2,
    },
    sprintDate: { 
        fontSize: 13, 
        color: THEME.textSecondary,
        fontWeight: '500',
    },
    deleteBtn: {
        padding: 8,
    },
    sprintFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 12,
    },
    footerStat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    footerStatText: {
        fontSize: 13,
        color: THEME.textSecondary,
        fontWeight: '600',
    },
    intensityBadge: {
        marginLeft: 'auto',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    intensityText: {
        fontSize: 11,
        fontWeight: '700',
        color: THEME.textSecondary,
    },
    statLine: { flexDirection: 'row', justifyContent: 'space-between' },
    statLabel: { fontSize: 14, color: THEME.textSecondary },
    statValue: { fontSize: 14, fontWeight: '700', color: THEME.textPrimary },
});
