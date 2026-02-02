
import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Animated, NativeSyntheticEvent, NativeScrollEvent, TextInput, Image, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StorageService, Task, UserProfile } from '../src/services/storage';
import CompletedTasksModal from '../src/components/CompletedTasksModal';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
    const router = useRouter();
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);
    const [historyTasks, setHistoryTasks] = useState<Task[]>([]);
    const [activeTab, setActiveTab] = useState(0);
    const scrollRef = useRef<ScrollView>(null);
    const scrollX = useRef(new Animated.Value(0)).current;

    const [profile, setProfile] = useState<UserProfile>({
        name: '',
        handle: '',
        goals: []
    });

    const [stats, setStats] = useState({ completed: 0, active: 0, streak: 0 });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const history = await StorageService.loadHistory();
        setHistoryTasks(history);

        const active = await StorageService.loadActiveTasks();

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
        // Sort by date descending
        const sorted = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        /* 
           Real streak logic needs unique dates. 
           For this MVP, valid streak = consecutive days backward from today/yesterday.
        */
        return 0; // Placeholder until we have robust generic date helper for this
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

    const handleTabPress = (index: number) => {
        setActiveTab(index);
        scrollRef.current?.scrollTo({ x: index * width, animated: true });
    };

    const handleScroll = Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        { useNativeDriver: false }
    );

    const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const position = event.nativeEvent.contentOffset.x;
        const index = Math.round(position / width);
        setActiveTab(index);
    };

    const indicatorTranslateX = scrollX.interpolate({
        inputRange: [0, width],
        outputRange: [0, width / 2],
    });

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Text style={styles.backButtonText}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
                <View style={styles.placeholder} />
            </View>

            {/* Custom Tab Bar */}
            <View style={styles.tabBar}>
                <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress(0)}>
                    <Text style={[styles.tabText, activeTab === 0 && styles.activeTabText]}>Me</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tabItem} onPress={() => handleTabPress(1)}>
                    <Text style={[styles.tabText, activeTab === 1 && styles.activeTabText]}>Archive</Text>
                </TouchableOpacity>
                <Animated.View style={[styles.tabIndicator, { transform: [{ translateX: indicatorTranslateX }] }]} />
            </View>

            <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                onMomentumScrollEnd={handleMomentumScrollEnd}
                scrollEventThrottle={16}
                contentContainerStyle={{ width: width * 2 }}
            >
                {/* PAGE 1: ME */}
                <View style={styles.page}>
                    <ScrollView
                        style={styles.pageScroll}
                        contentContainerStyle={styles.contentContainer}
                        keyboardShouldPersistTaps="handled"
                    >

                        {/* Banner & Header (Existing) */}
                        <TouchableOpacity activeOpacity={0.9} onPress={() => handlePickImage('banner')}>
                            {profile.banner ? (
                                <Image source={{ uri: profile.banner }} style={styles.bannerImage} />
                            ) : (
                                <LinearGradient colors={['#e0e0e0', '#d0d0d0']} style={styles.bannerImage} />
                            )}
                            <View style={styles.bannerOverlay}>
                                <Ionicons name="camera-outline" size={20} color="#FFF" />
                            </View>
                        </TouchableOpacity>

                        {/* Profile Info Card */}
                        <View style={styles.profileHeaderCard}>
                            {/* Avatar & Streak Row */}
                            <View style={styles.avatarRow}>
                                <TouchableOpacity style={styles.avatarWrapper} onPress={() => handlePickImage('avatar')}>
                                    {profile.avatar ? (
                                        <Image source={{ uri: profile.avatar }} style={styles.avatarImage} />
                                    ) : (
                                        <View style={styles.avatarPlaceholder}>
                                            <Text style={{ fontSize: 32 }}>👤</Text>
                                        </View>
                                    )}
                                    <View style={styles.avatarEditIcon}>
                                        <Ionicons name="add-circle" size={24} color="#007AFF" />
                                    </View>
                                </TouchableOpacity>

                                {/* STREAK BADGE - Now right of Avatar */}
                                <View style={styles.streakBadge}>
                                    <Ionicons name="flame" size={16} color="#DC2626" />
                                    <Text style={styles.streakText}>{stats.streak} Streak</Text>
                                </View>
                            </View>

                            {/* Inline Editable Name */}
                            <TextInput
                                style={styles.userNameInput}
                                value={profile.name}
                                onChangeText={(text) => updateProfile({ name: text })}
                                placeholder="Name"
                                placeholderTextColor="#94A3B8"
                            />

                            {/* Inline Editable Bio */}
                            <TextInput
                                style={styles.userBioInput}
                                value={profile.bio || ''}
                                onChangeText={(text) => updateProfile({ bio: text })}
                                placeholder="Add a bio..."
                                placeholderTextColor="#94A3B8"
                                multiline
                            />
                        </View>



                        {/* Goals Section - Clean List Card */}
                        <View style={styles.goalsContainer}>
                            <Text style={styles.sectionHeader}>Current Focus</Text>
                            <View style={styles.sectionCard}>
                                {(profile.goals || []).map((goal, index) => (
                                    <View key={index}>
                                        <View style={styles.goalItemRow}>
                                            <Ionicons name="location-outline" size={22} color="#64748B" />
                                            <TextInput
                                                style={styles.goalInput}
                                                value={goal}
                                                onChangeText={(text) => {
                                                    const newGoals = [...(profile.goals || [])];
                                                    newGoals[index] = text;
                                                    setProfile({ ...profile, goals: newGoals }); // Optimistic update
                                                }}
                                                onEndEditing={() => updateProfile({ goals: profile.goals?.filter(g => g.trim().length > 0) })} // Save on blur
                                                onSubmitEditing={() => updateProfile({ goals: [...(profile.goals || []), ''] })} // Enter -> Add new
                                                placeholder="What's your focus?"
                                                placeholderTextColor="#94A3B8"
                                                returnKeyType="next"
                                            />
                                            <TouchableOpacity
                                                onPress={() => updateProfile({ goals: profile.goals?.filter((_, i) => i !== index) })}
                                                style={{ padding: 4 }}
                                            >
                                                <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                                            </TouchableOpacity>
                                        </View>
                                        {index < (profile.goals || []).length - 1 && <View style={styles.separator} />}
                                    </View>
                                ))}
                                {(profile.goals?.length || 0) > 0 && <View style={styles.separator} />}
                                <TouchableOpacity
                                    style={styles.addGoalChecklistButton}
                                    onPress={() => updateProfile({ goals: [...(profile.goals || []), ''] })}
                                >
                                    <Ionicons name="add" size={20} color="#64748B" />
                                    <Text style={styles.addGoalText}>Add New Focus Item</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </View>

                {/* PAGE 2: ARCHIVE */}
                <View style={styles.page}>
                    <ScrollView style={styles.pageScroll} contentContainerStyle={styles.contentContainer}>
                        <Text style={styles.sectionHeader}>Records</Text>
                        <View style={styles.sectionCard}>
                            <TouchableOpacity style={styles.menuItem} onPress={() => setIsHistoryVisible(true)}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    <Ionicons name="time-outline" size={24} color="#333" />
                                    <Text style={styles.menuItemText}>Completed History</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
                            </TouchableOpacity>

                            <View style={styles.separator} />

                            <TouchableOpacity style={styles.menuItem}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    <Ionicons name="stats-chart-outline" size={24} color="#333" />
                                    <Text style={styles.menuItemText}>Statistics</Text>
                                </View>
                                <View style={styles.comingSoonTag}>
                                    <Text style={styles.comingSoonText}>Soon</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    backButton: { paddingVertical: 4, paddingRight: 12 },
    backButtonText: { fontSize: 16, color: '#007AFF', fontWeight: '500' },
    headerTitle: { fontSize: 17, fontWeight: '600', color: '#000000' },
    placeholder: { width: 60 },

    // Tabs
    tabBar: { flexDirection: 'row', position: 'relative', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
    tabText: { fontSize: 15, fontWeight: '600', color: '#94A3B8' },
    activeTabText: { color: '#007AFF' },
    tabIndicator: { position: 'absolute', bottom: 0, left: 0, height: 2, width: '50%', backgroundColor: '#007AFF' },

    // Pages
    page: { width: width, flex: 1 },
    pageScroll: { flex: 1 },
    contentContainer: { paddingBottom: 40 }, // Removed padding: 20 to let banner go edge-to-edge

    // Pro Social Style Profile
    bannerImage: {
        height: 120,
        width: '100%',
        backgroundColor: '#E2E8F0',
    },
    bannerOverlay: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: 8,
        borderRadius: 20,
    },

    // Header Info Section
    profileHeaderCard: {
        alignItems: 'flex-start', // Left aligned
        paddingHorizontal: 20,
        marginTop: -45,
        marginBottom: 24,
        zIndex: 10, // Ensure inputs are clickable over banner
    },
    avatarRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 16,
        marginBottom: 12,
    },
    avatarWrapper: {
        padding: 4,
        backgroundColor: '#F9FAFB',
        borderRadius: 24, // Square-ish
        // Removed marginBottom as it's handled by row
    },
    avatarImage: {
        width: 84,
        height: 84,
        borderRadius: 20, // Square-ish
        borderWidth: 1,
        borderColor: '#00000010'
    },
    avatarPlaceholder: {
        width: 84,
        height: 84,
        borderRadius: 20, // Square-ish
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    avatarEditIcon: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#FFF',
        borderRadius: 12,
        zIndex: 2,
    },

    // Inline Inputs - Left Aligned
    userNameInput: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 2,
        textAlign: 'left',
        minWidth: 150,
        marginLeft: -2 // Offsetting default padding
    },
    userHandleInput: {
        fontSize: 15,
        color: '#64748B',
        marginBottom: 12,
        textAlign: 'left',
        fontWeight: '500',
        marginLeft: -2
    },
    userBioInput: {
        fontSize: 15,
        color: '#334155',
        lineHeight: 22,
        textAlign: 'left',
        width: '100%',
        marginBottom: 16,
    },

    // Streak Badge - Now next to Avatar
    streakBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 12,
        gap: 6,
        borderWidth: 1,
        borderColor: '#FECACA',
        marginBottom: 12, // Align visually with bottom of avatar
    },
    streakText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#DC2626',
    },
    // Removed streakContainer as it is no longer distinct

    // Goals - Clean List Rows
    goalsContainer: { marginBottom: 50, paddingHorizontal: 20 },
    sectionHeader: {
        fontSize: 14,
        fontWeight: '700',
        color: '#64748B',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    goalItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    goalInput: { flex: 1, fontSize: 16, color: '#333' },
    addGoalChecklistButton: {
        alignItems: 'center',
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: 12,
    },
    addGoalText: { color: '#64748B', fontWeight: '500', fontSize: 16 },    // Content Card Standard
    sectionCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9', // Subtle border
        overflow: 'hidden',
        marginBottom: 24,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
    },

    // Archive Menu
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 18,
        backgroundColor: '#FFF'
    },
    menuItemText: {
        fontSize: 16,
        color: '#1E293B',
        fontWeight: '500'
    },
    separator: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginLeft: 54 // Indented past icon
    },
    comingSoonTag: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6
    },
    comingSoonText: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '600'
    },
});
