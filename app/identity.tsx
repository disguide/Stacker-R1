import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StorageService, UserProfile, TagDefinition } from '../src/services/storage';
import { Task } from '../src/features/tasks/types';
import IdentityCard from '../src/components/IdentityCard';
import { useTaskController } from '../src/features/tasks/hooks/useTaskController';
import SwipeableTaskRow from '../src/components/SwipeableTaskRow'; // Reusing for consistency
import { toISODateString, formatDeadline } from '../src/utils/dateHelpers';

export default function IdentityScreen() {
    const router = useRouter();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const { tasks, addTask, deleteTask, toggleTask, updateTask } = useTaskController();

    // Identity Tag Logic
    const [identityTagId, setIdentityTagId] = useState<string | null>(null);
    const [isAddModalVisible, setIsAddModalVisible] = useState(false);
    const [newMilestoneTitle, setNewMilestoneTitle] = useState('');

    useEffect(() => {
        loadProfile();
        ensureIdentityTag();
    }, []);

    const loadProfile = async () => {
        const data = await StorageService.loadProfile();
        if (data) setProfile(data);
    };

    const ensureIdentityTag = async () => {
        try {
            const tags = await StorageService.loadTags();
            const existing = tags.find(t => t.label.trim().toLowerCase() === 'identity');
            if (existing) {
                console.log('Identity tag found:', existing.id);
                setIdentityTagId(existing.id);
            } else {
                // Create specific Identity tag
                const newTag: TagDefinition = {
                    id: `tag_identity_${Date.now()}`,
                    label: 'Identity',
                    color: '#8B5CF6', // Violent/Purple
                    symbol: '🧬'
                };
                console.log('Creating new Identity tag:', newTag.id);
                await StorageService.saveTags([...tags, newTag]);
                setIdentityTagId(newTag.id);
            }
        } catch (e) {
            console.error('Failed to ensure identity tag:', e);
        }
    };

    const updateProfile = async (updates: Partial<UserProfile>) => {
        if (!profile) return;
        const newProfile = { ...profile, ...updates };
        setProfile(newProfile);
        await StorageService.saveProfile(newProfile);
    };

    // Filter Milestones
    const milestones = useMemo(() => {
        if (!identityTagId) return [];
        // Debugging filter
        const filtered = tasks.filter(t => {
            const hasTag = t.tagIds?.includes(identityTagId);
            const isRef = t.id.startsWith('milestone_'); // Fallback check
            return (hasTag || isRef) && !t.completed;
        });

        return filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [tasks, identityTagId]);

    const handleAddMilestone = (monthsOffset: number, customDate?: Date) => {
        if (!newMilestoneTitle.trim()) {
            Alert.alert('Error', 'Please enter a milestone title.');
            return;
        }
        if (!identityTagId) {
            Alert.alert('Error', 'Identity system not initialized yet. Please wait a moment.');
            ensureIdentityTag(); // Retry
            return;
        }

        try {
            let targetDate = new Date();
            if (customDate) {
                targetDate = customDate;
            } else {
                targetDate.setMonth(targetDate.getMonth() + monthsOffset);
            }

            const newTask: Task = {
                id: `milestone_${Date.now()}`,
                title: newMilestoneTitle,
                date: toISODateString(targetDate),
                originalDate: toISODateString(targetDate),
                completed: false,
                tagIds: [identityTagId],
                subtasks: [],
                progress: 0
            };

            addTask(newTask);
            setNewMilestoneTitle('');
            setIsAddModalVisible(false);
            // Optional: Alert.alert('Success', 'Milestone added!'); 
        } catch (e) {
            Alert.alert('Error', 'Failed to add milestone.');
            console.error(e);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Identity Engineering</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {profile ? (
                    <>
                        <IdentityCard
                            identity={profile.identity || { anti: {}, hero: {} }}
                            onUpdate={(newIdentity) => updateProfile({ identity: newIdentity })}
                        />

                        {/* MILESTONES SECTION */}
                        <View style={styles.milestonesContainer}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.sectionTitle}>IDENTITY MILESTONES</Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        if (identityTagId) setIsAddModalVisible(true);
                                    }}
                                    style={[styles.addBtnSmall, !identityTagId && { opacity: 0.5 }]}
                                    disabled={!identityTagId}
                                >
                                    <Ionicons name="add" size={16} color="#FFF" />
                                    <Text style={styles.addBtnText}>Add</Text>
                                </TouchableOpacity>
                            </View>

                            {milestones.length === 0 ? (
                                <View style={styles.emptyState}>
                                    {identityTagId ? (
                                        <>
                                            <Text style={styles.emptyText}>No active milestones.</Text>
                                            <Text style={styles.emptySub}>Set a target to prove your new identity.</Text>
                                        </>
                                    ) : (
                                        <Text style={styles.emptyText}>Initializing Identity System...</Text>
                                    )}
                                </View>
                            ) : (
                                <View style={styles.listContainer}>
                                    {milestones.map(task => (
                                        <SwipeableTaskRow
                                            key={task.id}
                                            id={task.id}
                                            title={task.title}
                                            completed={task.completed || false}
                                            deadline={task.deadline}
                                            estimatedTime={task.estimatedTime}
                                            progress={task.progress || 0}
                                            onToggleReminder={() => { }} // Not implemented yet
                                            onProgressUpdate={(id, p) => updateTask(id, { progress: p })}
                                            onComplete={() => toggleTask(task.id, task.date)}
                                            onEdit={() => { }} // Placeholder
                                            onMenu={() => deleteTask(task.id, task.date, 'single')} // Quick delete for now
                                            formatDeadline={formatDeadline}
                                        />
                                    ))}
                                </View>
                            )}
                        </View>
                    </>
                ) : (
                    <View style={styles.loading}>
                        <Text>Loading...</Text>
                    </View>
                )}
            </ScrollView>

            {/* ADD MILESTONE MODAL */}
            <Modal visible={isAddModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>New Milestone</Text>
                            <TouchableOpacity onPress={() => setIsAddModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.input}
                            placeholder="What is the achievement?"
                            value={newMilestoneTitle}
                            onChangeText={setNewMilestoneTitle}
                            autoFocus
                        />

                        <Text style={styles.label}>Timeline</Text>
                        <View style={styles.quickDates}>
                            <QuickDateBtn label="1 Month" onPress={() => handleAddMilestone(1)} color="#3B82F6" />
                            <QuickDateBtn label="3 Months" onPress={() => handleAddMilestone(3)} color="#8B5CF6" />
                            <QuickDateBtn label="6 Months" onPress={() => handleAddMilestone(6)} color="#EC4899" />
                            <QuickDateBtn label="1 Year" onPress={() => handleAddMilestone(12)} color="#F59E0B" />
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const QuickDateBtn = ({ label, onPress, color }: any) => (
    <TouchableOpacity style={[styles.dateBtn, { borderColor: color }]} onPress={onPress}>
        <Text style={[styles.dateBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    backButton: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
    content: {
        flexGrow: 1,
        alignItems: 'center',
        paddingVertical: 20,
        paddingBottom: 100,
    },
    loading: { marginTop: 50 },

    // Milestones
    milestonesContainer: {
        width: '100%',
        paddingHorizontal: 16,
        marginTop: 24,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 1,
    },
    addBtnSmall: {
        flexDirection: 'row',
        backgroundColor: '#0F172A',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        alignItems: 'center',
        gap: 4,
    },
    addBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
    listContainer: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    emptyState: { alignItems: 'center', padding: 32 },
    emptyText: { color: '#94A3B8', fontSize: 16, fontWeight: '600' },
    emptySub: { color: '#CBD5E1', fontSize: 12, marginTop: 4 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
    input: {
        fontSize: 18, borderBottomWidth: 2, borderBottomColor: '#E2E8F0',
        paddingVertical: 12, marginBottom: 32, color: '#0F172A'
    },
    label: { fontSize: 14, fontWeight: '700', color: '#64748B', marginBottom: 12, textTransform: 'uppercase' },
    quickDates: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    dateBtn: {
        paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12,
        borderWidth: 1, backgroundColor: '#FFF',
    },
    dateBtnText: { fontWeight: '700', fontSize: 14 },
});
