import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StorageService, SavedSprint } from '../src/services/storage';
import { ScrollView } from 'react-native-gesture-handler';

const { width, height } = Dimensions.get('window');

export default function AllSprintsScreen() {
    const router = useRouter();
    const [sprints, setSprints] = useState<SavedSprint[]>([]);
    const [selectedSprint, setSelectedSprint] = useState<SavedSprint | null>(null);

    const handleUnstar = async (sprintId: string) => {
        await StorageService.deleteSavedSprint(sprintId);
        setSprints(prev => prev.filter(s => s.id !== sprintId));
        setSelectedSprint(null);
    };

    useEffect(() => {
        let mounted = true;
        const loadData = async () => {
            const saved = await StorageService.loadSavedSprints();
            if (mounted) {
                // Ensure chronologically sorted (newest first, assuming date is string or timestamp)
                saved.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setSprints(saved);
            }
        };
        loadData();
        return () => { mounted = false; };
    }, []);

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.exitBtn}>
                    <Ionicons name="chevron-back" size={24} color="#0F172A" />
                    <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>All Sprints</Text>
                <View style={{ width: 60 }} />
            </View>

            <FlatList
                data={sprints}
                keyExtractor={(item, idx) => item.id || String(idx)}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <TouchableOpacity 
                        style={styles.listItem}
                        activeOpacity={0.8}
                        onPress={() => setSelectedSprint(item)}
                    >
                        <View style={styles.listHeader}>
                            <Text style={styles.listDate}>
                                {new Date(item.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </Text>
                            <View style={styles.durationPill}>
                                <Ionicons name="time" size={12} color="#3B82F6" />
                                <Text style={styles.durationPillText}>{formatDuration(item.durationSeconds)}</Text>
                            </View>
                        </View>
                        
                        <Text style={styles.listTitle} numberOfLines={2}>
                            {item.primaryTask || 'Focus Session'}
                        </Text>
                        
                        <Text style={styles.listTaskCount}>
                            {item.taskCount || 0} Tasks Completed
                        </Text>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No sprints saved yet.</Text>
                    </View>
                }
            />

            {/* Selected Sprint Modal - Floating Tab format */}
            {selectedSprint && (
                <View style={[styles.modalBackdrop, StyleSheet.absoluteFillObject]}>
                    <TouchableOpacity style={styles.modalDismissArea} activeOpacity={1} onPress={() => setSelectedSprint(null)} />
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity activeOpacity={0.7} onPress={() => handleUnstar(selectedSprint.id)} style={styles.modalIconBox}>
                                <Ionicons name="star" size={24} color="#F59E0B" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setSelectedSprint(null)} style={styles.closeBtn}>
                                <Ionicons name="close" size={24} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{maxHeight: height * 0.6}} showsVerticalScrollIndicator={false}>
                            <Text style={styles.modalDate}>
                                {new Date(selectedSprint.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                            </Text>
                            <Text style={styles.modalTitle}>{selectedSprint.primaryTask || 'Focus Session'}</Text>
                            
                            <View style={styles.modalStatsRow}>
                                <View style={styles.modalStatBox}>
                                    <Ionicons name="time-outline" size={18} color="#3B82F6" />
                                    <Text style={styles.modalStatLabel}>{formatDuration(selectedSprint.durationSeconds)}</Text>
                                </View>
                                {selectedSprint.taskCount ? (
                                    <View style={styles.modalStatBox}>
                                        <Ionicons name="checkmark-done" size={18} color="#10B981" />
                                        <Text style={[styles.modalStatLabel, { color: '#10B981' }]}>{selectedSprint.taskCount} Tasks</Text>
                                    </View>
                                ) : null}
                            </View>

                            {selectedSprint.note ? (
                                <View style={styles.modalNoteBox}>
                                    <Text style={styles.modalNoteLabel}>SESSION NOTE</Text>
                                    <Text style={styles.modalNoteText}>"{selectedSprint.note}"</Text>
                                </View>
                            ) : null}

                            {selectedSprint.timelineEvents && selectedSprint.timelineEvents.length > 0 && (
                                <View style={styles.modalTimeline}>
                                    <Text style={styles.modalNoteLabel}>TIMELINE</Text>
                                    {selectedSprint.timelineEvents.map((evt: any, i: number, arr: any[]) => (
                                        <View key={i} style={styles.timelineRow}>
                                            <View style={styles.timelineVisuals}>
                                                <View style={[styles.timelineDot, { backgroundColor: evt.type === 'break' ? '#10B981' : '#3B82F6' }]} />
                                                {i < arr.length - 1 && <View style={styles.timelineLine} />}
                                            </View>
                                            <View style={styles.timelineEventContent}>
                                                <Text style={styles.timelineEventText} numberOfLines={1}>{evt.title}</Text>
                                                <Text style={styles.timelineEventDuration}>{formatDuration(evt.durationSeconds)}</Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFF',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        zIndex: 10,
    },
    exitBtn: { flexDirection: 'row', alignItems: 'center' },
    backButtonText: { fontSize: 17, color: '#0F172A', fontWeight: '500' },
    headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
    
    listContent: {
        padding: 20,
        paddingBottom: 60,
    },
    listItem: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    listHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    listDate: {
        fontSize: 12,
        fontWeight: '800',
        color: '#94A3B8',
        textTransform: 'uppercase',
    },
    durationPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    durationPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#3B82F6',
    },
    listTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 8,
    },
    listTaskCount: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748B',
    },
    emptyContainer: {
        paddingTop: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 15,
        color: '#94A3B8',
        fontWeight: '600',
    },

    // Floating Modal Styles
    modalBackdrop: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        zIndex: 100,
    },
    modalDismissArea: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        width: '100%',
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalIconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtn: {
        padding: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
    },
    modalDate: {
        fontSize: 13,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0F172A',
        lineHeight: 30,
        marginBottom: 20,
    },
    modalStatsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    modalStatBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        gap: 6,
    },
    modalStatLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#3B82F6',
    },
    modalNoteBox: {
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 24,
    },
    modalNoteLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 1,
        marginBottom: 8,
    },
    modalNoteText: {
        fontSize: 15,
        color: '#1E293B',
        fontStyle: 'italic',
        lineHeight: 22,
    },
    modalTimeline: {
        marginTop: 8,
    },
    timelineRow: {
        flexDirection: 'row',
        minHeight: 40,
    },
    timelineVisuals: {
        width: 16,
        alignItems: 'center',
        marginRight: 12,
    },
    timelineDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 4,
        zIndex: 2,
    },
    timelineLine: {
        width: 2,
        flex: 1,
        backgroundColor: '#E2E8F0',
        marginTop: 4,
        marginBottom: -4,
        zIndex: 1,
    },
    timelineEventContent: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 16,
    },
    timelineEventText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1E293B',
        flex: 1,
        marginRight: 8,
    },
    timelineEventDuration: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: 'bold',
    }
});
