
import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, TextInput, Image, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StorageService, Task, UserProfile } from '../src/services/storage';
import CompletedTasksModal from '../src/components/CompletedTasksModal';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import IdentityCard from '../src/components/IdentityCard';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
    const router = useRouter();
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);
    const [historyTasks, setHistoryTasks] = useState<Task[]>([]);
    const [activeTab, setActiveTab] = useState(0);

    const [profile, setProfile] = useState<UserProfile>({
        name: '',
        handle: '',
        goals: []
    });

    const [stats, setStats] = useState({ completed: 0, active: 0, streak: 0 });

    const [milestones, setMilestones] = useState<Task[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const history = await StorageService.loadHistory();
        setHistoryTasks(history);

        const active = await StorageService.loadActiveTasks();

        // Load Milestones (Logic adapted from identity.tsx)
        const tags = await StorageService.loadTags();
        const identityTag = tags.find(t => t.label.trim().toLowerCase() === 'identity');
        const identityTagId = identityTag?.id;

        const milestonTasks = active.filter(t => {
            const hasTag = identityTagId ? t.tagIds?.includes(identityTagId) : false;
            const isRef = t.id.startsWith('milestone_');
            return (hasTag || isRef) && !t.completed;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setMilestones(milestonTasks);

        // Simple Streak Calculation
        const streak = calculateStreak(history);

        setStats({
            completed: history.length,
            active: active.length,
            streak: streak
        });

        const savedProfile = await StorageService.loadProfile();
        if (savedProfile) {
            // Hotfix: Clear the annoying default if it was autosaved
            if (savedProfile.handle === '@stacker') savedProfile.handle = '';
            // if (savedProfile.name === 'User') savedProfile.name = ''; 

            setProfile(savedProfile);
        }
    };

    const calculateStreak = (history: Task[]) => {
        if (!history.length) return 0;

        // distinct dates from history, sorted descending
        const uniqueDates = [...new Set(history.map(t => t.date.split('T')[0]))]
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

        if (uniqueDates.length === 0) return 0;

        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        // If no task today AND no task yesterday, streak is broken -> 0
        if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
            return 0;
        }

        let streak = 0;
        let currentDate = new Date(uniqueDates[0]);

        // If the latest task is today, start counting. If yesterday, also start.
        // We iterate through the sorted dates and check simple day difference

        // Simplification: Just iterate unique dates and check if they are consecutive
        let currentString = uniqueDates[0];
        streak = 1;

        for (let i = 1; i < uniqueDates.length; i++) {
            const prevDate = new Date(currentString);
            const thisDate = new Date(uniqueDates[i]);

            // Difference in days
            const diffTime = Math.abs(prevDate.getTime() - thisDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                streak++;
                currentString = uniqueDates[i];
            } else {
                break;
            }
        }

        return streak;
    };

    const updateProfile = async (updates: Partial<UserProfile>) => {
        const newProfile = { ...profile, ...updates };
        setProfile(newProfile);
        await StorageService.saveProfile(newProfile);
    };

    const handlePickImage = async (type: 'banner' | 'avatar') => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], // Use string directly to avoid enum issue if package mismatch
            allowsEditing: true,
            aspect: type === 'banner' ? [16, 9] : [1, 1],
            quality: 1,
        });

        if (!result.canceled) {
            updateProfile({ [type]: result.assets[0].uri });
        }
    };

    const handleRestoreTask = async (taskId: string) => {
        const restoredTask = await StorageService.removeFromHistory(taskId);
        if (restoredTask) {
            const activeTasks = await StorageService.loadActiveTasks();
            activeTasks.push(restoredTask);
            await StorageService.saveActiveTasks(activeTasks);
            setHistoryTasks(prev => prev.filter(t => t.id !== taskId));
        }
    };



    return (
        <View style={styles.container}>
            <ScrollView
                style={styles.pageScroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* 1. GLOBAL HEADER (Banner, Avatar, Bio, Stats) */}
                <View style={styles.headerContainer}>
                    {/* Banner */}
                    <TouchableOpacity activeOpacity={0.9} onPress={() => handlePickImage('banner')}>
                        {profile.banner ? (
                            <Image source={{ uri: profile.banner }} style={styles.bannerImage} />
                        ) : (
                            <LinearGradient colors={['#cbd5e1', '#94a3b8']} style={styles.bannerImage} />
                        )}
                        <View style={styles.bannerEditIcon}>
                            <Ionicons name="camera" size={16} color="#FFF" />
                        </View>

                        {/* EXIT BUTTON (Floating Overlay) */}
                        <TouchableOpacity onPress={() => router.back()} style={styles.exitBtnFloating}>
                            <Ionicons name="arrow-back" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </TouchableOpacity>

                    {/* Profile Block (Overlapping) */}
                    <View style={styles.profileBlock}>
                        <View style={styles.avatarRow}>
                            <TouchableOpacity activeOpacity={0.9} onPress={() => handlePickImage('avatar')}>
                                {profile.avatar ? (
                                    <Image source={{ uri: profile.avatar }} style={styles.avatarImage} />
                                ) : (
                                    <View style={styles.avatarPlaceholder}>
                                        <Text style={{ fontSize: 40 }}>👤</Text>
                                    </View>
                                )}
                                <View style={styles.avatarEditIcon}>
                                    <Ionicons name="add" size={16} color="#FFF" />
                                </View>
                            </TouchableOpacity>

                            {/* Edit Profile Button */}
                            <TouchableOpacity style={styles.editProfileBtn}>
                                <Text style={styles.editProfileText}>Edit Profile</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Name & Bio */}
                        <View style={styles.infoBlock}>
                            <TextInput
                                style={styles.userNameInput}
                                value={profile.name}
                                onChangeText={(text) => updateProfile({ name: text })}
                                placeholder="Name"
                                placeholderTextColor="#94A3B8"
                            />
                            <TextInput
                                style={styles.userBioInput}
                                value={profile.bio || ''}
                                onChangeText={(text) => updateProfile({ bio: text })}
                                placeholder="Add a bio..."
                                placeholderTextColor="#94A3B8"
                                multiline
                            />
                        </View>
                    </View>

                    {/* STATS ROW */}
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: '#DC2626' }]}>{stats.streak}</Text>
                            <Text style={styles.statLabel}>Streak</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: '#16A34A' }]}>{stats.completed}</Text>
                            <Text style={styles.statLabel}>Done</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={[styles.statValue, { color: '#2563EB' }]}>{stats.active}</Text>
                            <Text style={styles.statLabel}>Active</Text>
                        </View>
                    </View>
                </View>

                {/* 2. TABS (Sticky-ish) */}
                <View style={styles.tabContainer}>
                    {['Identity', 'Plans', 'Archive'].map((tab, i) => (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.tabBtn, activeTab === i && styles.tabBtnActive]}
                            onPress={() => setActiveTab(i)}
                        >
                            <Text style={[styles.tabBtnText, activeTab === i && styles.tabBtnTextActive]}>
                                {tab}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* 3. TAB CONTENT */}
                <View style={styles.tabContent}>
                    {/* ID CARD */}
                    {activeTab === 0 && (
                        <View style={styles.identityTab}>
                            <TouchableOpacity
                                style={styles.identityCardRow}
                                onPress={() => router.push('/identity')}
                                activeOpacity={0.8}
                            >
                                <View style={styles.idCardLeft}>
                                    <LinearGradient colors={['#0F172A', '#334155']} style={styles.idIconBox}>
                                        <Ionicons name="finger-print" size={24} color="#FFF" />
                                    </LinearGradient>
                                    <View>
                                        <Text style={styles.idCardTitle}>Identity Engineering</Text>
                                        <Text style={styles.idCardSub}>Frankenstein vs. Hero Model</Text>
                                    </View>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                            </TouchableOpacity>
                            <Text style={{ textAlign: 'center', marginTop: 12, color: '#94A3B8', fontSize: 12 }}>
                                Tap to configure your identity card
                            </Text>
                        </View>
                    )}

                    {/* PLANS (Milestones & Focus) */}
                    {activeTab === 1 && (
                        <View>
                            {/* MILESTONES SECTION */}
                            <Text style={styles.sectionHeader}>NEXT MILESTONES</Text>
                            <View style={styles.milestoneList}>
                                {milestones.length > 0 ? (
                                    milestones.slice(0, 3).map((m, i) => ( // Show top 3
                                        <View key={m.id} style={styles.milestoneItem}>
                                            <View style={styles.milestoneIcon}>
                                                <Ionicons name="flag" size={14} color="#8B5CF6" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.milestoneTitle}>{m.title}</Text>
                                                <Text style={styles.milestoneDate}>{new Date(m.date).toLocaleDateString()}</Text>
                                            </View>
                                            <View style={styles.milestoneLine} />
                                        </View>
                                    ))
                                ) : (
                                    <Text style={styles.emptyStateText}>No upcoming milestones set.</Text>
                                )}
                            </View>

                            {/* CURRENT FOCUS LIST */}
                            <Text style={[styles.sectionHeader, { marginTop: 24 }]}>CURRENT FOCUS</Text>
                            <View style={styles.focusList}>
                                {(profile.goals || []).map((goal, index) => (
                                    <View key={index} style={styles.focusItem}>
                                        <View style={styles.focusIconBox}>
                                            <Ionicons name="radio-button-on" size={10} color="#3B82F6" />
                                        </View>
                                        <TextInput
                                            style={styles.focusInput}
                                            value={goal}
                                            onChangeText={(text) => {
                                                const newGoals = [...(profile.goals || [])];
                                                newGoals[index] = text;
                                                setProfile({ ...profile, goals: newGoals });
                                            }}
                                            onEndEditing={() => updateProfile({ goals: profile.goals?.filter(g => g.trim().length > 0) })}
                                            onSubmitEditing={() => updateProfile({ goals: [...(profile.goals || []), ''] })}
                                            placeholder="Add focus item..."
                                        />
                                        <TouchableOpacity onPress={() => updateProfile({ goals: profile.goals?.filter((_, i) => i !== index) })}>
                                            <Ionicons name="close" size={16} color="#CBD5E1" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                <TouchableOpacity
                                    style={styles.addItemBtn}
                                    onPress={() => updateProfile({ goals: [...(profile.goals || []), ''] })}
                                >
                                    <Ionicons name="add" size={16} color="#64748B" />
                                    <Text style={styles.addItemText}>Add Item</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* ARCHIVE */}
                    {activeTab === 2 && (
                        <View>
                            <TouchableOpacity style={styles.menuItem} onPress={() => setIsHistoryVisible(true)}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    <Ionicons name="time-outline" size={24} color="#333" />
                                    <Text style={styles.menuItemText}>Completed History</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
                            </TouchableOpacity>

                            <View style={{ padding: 20, alignItems: 'center', marginTop: 20 }}>
                                <Text style={{ color: '#94A3B8' }}>Past performance analytics...</Text>
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>

            <CompletedTasksModal
                visible={isHistoryVisible}
                onClose={() => setIsHistoryVisible(false)}
                tasks={historyTasks}
                onRestore={handleRestoreTask}
                onDelete={async (id) => {
                    await StorageService.deleteFromHistory(id);
                    setHistoryTasks(prev => prev.filter(t => t.id !== id));
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' }, // Cleaner white bg
    pageScroll: { flex: 1 },
    scrollContent: { paddingBottom: 40 },

    // HEADER
    headerContainer: { marginBottom: 0 },
    bannerImage: { width: '100%', height: 140, backgroundColor: '#CBD5E1' },
    bannerEditIcon: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.4)', padding: 6, borderRadius: 20 },
    exitBtnFloating: { position: 'absolute', top: 40, left: 20, backgroundColor: 'rgba(0,0,0,0.4)', padding: 8, borderRadius: 20 },

    profileBlock: { paddingHorizontal: 16, marginTop: -50 }, // Overlap
    avatarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
    avatarImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#FFF' },
    avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#FFF', backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    avatarEditIcon: { position: 'absolute', bottom: 4, left: 70, backgroundColor: '#007AFF', borderRadius: 12, padding: 2, borderWidth: 2, borderColor: '#FFF' },

    editProfileBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#CBD5E1', marginBottom: 12, backgroundColor: '#FFF' },
    editProfileText: { fontSize: 13, fontWeight: '600', color: '#0F172A' },

    infoBlock: { marginTop: 4, marginBottom: 16 },
    userNameInput: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
    userBioInput: { fontSize: 15, color: '#475569', lineHeight: 20 },

    // STATS ROW
    statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    statItem: { alignItems: 'center' },
    statValue: { fontSize: 18, fontWeight: '800' },
    statLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', textTransform: 'uppercase' },
    statDivider: { width: 1, height: '60%', backgroundColor: '#E2E8F0', alignSelf: 'center' },

    // TABS
    tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderTopWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#FFF' },
    tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 14 },
    tabBtnActive: { borderBottomWidth: 2, borderBottomColor: '#0F172A' },
    tabBtnText: { fontSize: 14, fontWeight: '600', color: '#94A3B8' },
    tabBtnTextActive: { color: '#0F172A' },

    tabContent: { padding: 16, minHeight: 300 },
    identityTab: { padding: 16, alignItems: 'center' },

    // IDENTITY CARD ROW
    identityCardRow: {
        width: '100%',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 16, backgroundColor: '#F8FAFC', borderRadius: 16,
        borderWidth: 1, borderColor: '#E2E8F0'
    },
    idCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    idIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    idCardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
    idCardSub: { fontSize: 12, color: '#64748B' },

    // MILESTONES
    milestoneList: {
        backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9',
        overflow: 'hidden', paddingVertical: 8
    },
    milestoneItem: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12
    },
    milestoneIcon: {
        width: 24, height: 24, borderRadius: 12, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center'
    },
    milestoneTitle: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
    milestoneDate: { fontSize: 12, color: '#94A3B8' },
    milestoneLine: {
        position: 'absolute', left: 28, top: 32, bottom: -12, width: 1, backgroundColor: '#E2E8F0', zIndex: -1
    },
    emptyStateText: { padding: 16, fontStyle: 'italic', color: '#94A3B8', fontSize: 13 },

    // FOCUS LIST
    sectionHeader: { fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 1, marginBottom: 12 },
    focusList: { backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden' },
    focusItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    focusIconBox: { width: 20, alignItems: 'center' },
    focusInput: { flex: 1, fontSize: 15, color: '#334155', fontWeight: '500' },
    addItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, gap: 8 },
    addItemText: { fontSize: 14, fontWeight: '600', color: '#64748B' },

    // DATA/LOGS
    menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' },
    menuItemText: { fontSize: 16, fontWeight: '500', color: '#1E293B' },
    emptyTab: { alignItems: 'center', padding: 40 },
    emptyTabText: { color: '#94A3B8', marginTop: 16, fontWeight: '500' },
});
