import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StorageService, SavedSprint } from '../src/services/storage';

export default function SavedSprintsScreen() {
    const router = useRouter();
    const [sprints, setSprints] = useState<SavedSprint[]>([]);

    useEffect(() => {
        let mounted = true;
        StorageService.loadSavedSprints().then(data => {
            if (mounted) setSprints(data);
        });
        return () => { mounted = false; };
    }, []);

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    const handleDelete = (id: string) => {
        Alert.alert(
            "Delete Sprint",
            "Are you sure you want to remove this sprint timeline?",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive",
                    onPress: async () => {
                        await StorageService.deleteSavedSprint(id);
                        setSprints(prev => prev.filter(s => s.id !== id));
                    }
                }
            ]
        );
    };

    const handleUpdateNote = async (sprintId: string, eventIdx: number, note: string) => {
        const updatedSprints = sprints.map(s => {
            if (s.id !== sprintId) return s;
            const updatedEvents = [...s.timelineEvents];
            updatedEvents[eventIdx] = { ...updatedEvents[eventIdx], note };
            return { ...s, timelineEvents: updatedEvents };
        });
        setSprints(updatedSprints);
        await StorageService.updateSavedSprints(updatedSprints);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.exitBtn}>
                    <Ionicons name="chevron-back" size={24} color="#0F172A" />
                    <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Saved Sprints</Text>
                <View style={{ width: 60 }} />
            </View>
            
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                {sprints.length === 0 ? (
                    <Text style={styles.emptyText}>You haven't saved any sprints yet.</Text>
                ) : (
                    sprints.map(sprint => (
                        <View key={sprint.id} style={styles.sprintCard}>
                             <View style={styles.sprintCardHeader}>
                                 <View style={styles.sprintDateBox}>
                                     <Ionicons name="calendar-outline" size={16} color="#64748B" />
                                     <Text style={styles.sprintDate}>
                                         {new Date(sprint.date).toLocaleDateString(undefined, { 
                                             weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
                                         })}
                                     </Text>
                                 </View>
                                 <View style={styles.headerActions}>
                                     <View style={styles.sprintTimeBox}>
                                         <Ionicons name="time-outline" size={16} color="#3B82F6" />
                                         <Text style={styles.sprintDuration}>{formatDuration(sprint.durationSeconds)}</Text>
                                     </View>
                                     <TouchableOpacity onPress={() => handleDelete(sprint.id)} style={styles.deleteBtn}>
                                         <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                     </TouchableOpacity>
                                 </View>
                             </View>
 
                             <View style={styles.timelineList}>
                                 {sprint.timelineEvents && sprint.timelineEvents.map((evt, idx, arr) => {
                                     const isTask = evt.type === 'task';
                                     const isBreak = evt.type === 'break';
                                     return (
                                         <View key={idx} style={styles.timelineRow}>
                                             <View style={styles.timelineVisuals}>
                                                 <View style={[
                                                     styles.timelineDot,
                                                     { backgroundColor: isTask ? '#3B82F6' : (isBreak ? '#10B981' : '#94A3B8') }
                                                 ]} />
                                                 {idx < arr.length - 1 && <View style={styles.timelineVerticalLine} />}
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
                                                 <TextInput
                                                     style={styles.noteInput}
                                                     placeholder="Add a note..."
                                                     placeholderTextColor="#94A3B8"
                                                     value={evt.note || ''}
                                                     onChangeText={(text) => handleUpdateNote(sprint.id, idx, text)}
                                                     multiline
                                                 />
                                             </View>
                                         </View>
                                     );
                                 })}
                             </View>
                         </View>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        justifyContent: 'space-between'
    },
    exitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    backButtonText: {
        fontSize: 17,
        color: '#0F172A',
        fontWeight: '500',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#0F172A',
    },
    list: { flex: 1, backgroundColor: '#F8FAFC' },
    listContent: { padding: 16, paddingBottom: 60, gap: 16 },
    emptyText: {
        textAlign: 'center',
        color: '#94A3B8',
        marginTop: 40,
        fontSize: 15,
        fontStyle: 'italic'
    },
    sprintCard: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    sprintCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    sprintDateBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    sprintDate: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1E293B'
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    deleteBtn: {
        padding: 4,
    },
    sprintTimeBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12
    },
    sprintDuration: {
        fontSize: 13,
        fontWeight: '700',
        color: '#3B82F6'
    },
    timelineList: {
        marginTop: 4,
    },
    timelineRow: {
        flexDirection: 'row',
        minHeight: 60,
    },
    timelineVisuals: {
        width: 24,
        alignItems: 'center',
        marginRight: 10,
    },
    timelineDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 6,
        zIndex: 2,
    },
    timelineVerticalLine: {
        width: 2,
        flex: 1,
        backgroundColor: '#E2E8F0',
        marginTop: 2,
        marginBottom: -6,
        zIndex: 1,
    },
    timelineContent: {
        flex: 1,
        paddingBottom: 20,
    },
    timelineTextRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    timelineEventTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1E293B'
    },
    timelineEventDuration: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: 'bold'
    },
    noteInput: {
        fontSize: 14,
        color: '#64748B',
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginTop: 4,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        minHeight: 40,
        textAlignVertical: 'top',
    }
});
