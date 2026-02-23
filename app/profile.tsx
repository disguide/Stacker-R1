import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StorageService, UserProfile, GoalCategory } from '../src/services/storage';
import * as ImagePicker from 'expo-image-picker';

const GOAL_PALETTE = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#EC4899', '#06B6D4', '#F97316'];

export default function ProfileScreen() {
    const router = useRouter();

    const [isEditing, setIsEditing] = useState(false);
    const [mainTab, setMainTab] = useState<'focus' | 'archive'>('focus');
    const [activeTab, setActiveTab] = useState<'goals' | 'antigoals'>('goals');
    const [quickAddText, setQuickAddText] = useState('');
    const [isAddingGoal, setIsAddingGoal] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);
    const quickAddInputRef = useRef<TextInput>(null);
    const [selectedCategory, setSelectedCategory] = useState<GoalCategory>('outcomes');

    const [profile, setProfile] = useState<UserProfile>({
        name: '',
        handle: '',
        goals: [],
        antigoals: [],
    });
    // Store original profile in case user cancels edits
    const [draftProfile, setDraftProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        let mounted = true;

        const loadData = async () => {
            const savedProfile = await StorageService.loadProfile();
            if (savedProfile && mounted) {
                // Hotfix: Clear the annoying default if it was autosaved
                if (savedProfile.handle === '@stacker') savedProfile.handle = '';
                setProfile(savedProfile);
            }
        };

        loadData();

        return () => { mounted = false; };
    }, []);

    const handleEditToggle = async () => {
        if (isEditing) {
            // Cancel -> revert drafts AND storage
            if (draftProfile) {
                setProfile(draftProfile);
                await StorageService.saveProfile(draftProfile);
            }
            setIsEditing(false);
        } else {
            // Start editing -> snapshot current profile
            setDraftProfile(profile);
            setIsEditing(true);
        }
    };

    const saveChanges = async () => {
        await StorageService.saveProfile(profile);
        setDraftProfile(null);
        setIsEditing(false);
    };

    const updateProfile = async (updates: Partial<UserProfile>) => {
        const updated = { ...profile, ...updates };
        setProfile(updated);
        // Only persist immediately when NOT editing (e.g. toggling completion)
        // During edit mode, save happens explicitly via saveChanges()
        if (!isEditing) {
            await StorageService.saveProfile(updated);
        }
    };

    const handlePickImage = async (type: 'banner' | 'avatar') => {
        if (!isEditing) return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: type === 'banner' ? [16, 6] : [1, 1], // YouTube style wide banner
            quality: 1,
        });

        if (!result.canceled) {
            updateProfile({ [type]: result.assets[0].uri });
        }
    };

    // --- GOAL MANAGEMENT ---
    const activeList = activeTab === 'goals'
        ? (profile.goals || []).filter(g => !g.cancelled)
        : (profile.antigoals || []).filter(g => !g.cancelled);

    const addGoalItem = (title?: string) => {
        const goalTitle = title?.trim() || '';
        if (!goalTitle) return;

        const newId = Date.now().toString();
        const now = new Date().toISOString();
        const newItem = {
            id: newId,
            title: goalTitle,
            completed: false,
            createdAt: now,
            category: selectedCategory,
            color: GOAL_PALETTE[Math.floor(Math.random() * GOAL_PALETTE.length)],
            events: [{ id: newId, type: 'added' as const, date: now }]
        };
        if (activeTab === 'goals') {
            updateProfile({ goals: [...(profile.goals || []), newItem] });
        } else {
            updateProfile({ antigoals: [...(profile.antigoals || []), newItem] });
        }

        setQuickAddText('');
        setIsAddingGoal(false);

        // Auto-scroll to bottom after a small delay to allow item to render
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 150);
    };

    const updateGoalItem = (id: string, newTitle: string) => {
        const now = new Date().toISOString();
        const updater = (g: any) => g.id === id && g.title !== newTitle
            ? { ...g, title: newTitle, events: [...(g.events || []), { id: Date.now().toString(), type: 'modified' as const, date: now }] }
            : g;

        if (activeTab === 'goals') {
            const updated = (profile.goals || []).map(updater);
            updateProfile({ goals: updated });
        } else {
            const updated = (profile.antigoals || []).map(updater);
            updateProfile({ antigoals: updated });
        }
    };

    const cycleGoalColor = (id: string) => {
        const now = new Date().toISOString();
        const updater = (g: any) => {
            if (g.id !== id) return g;
            const cIdx = GOAL_PALETTE.indexOf(g.color || '');
            const nextColor = GOAL_PALETTE[(cIdx + 1) % GOAL_PALETTE.length];
            return {
                ...g,
                color: nextColor,
                events: [...(g.events || []), { id: Date.now().toString(), type: 'modified' as const, date: now }]
            };
        };

        if (activeTab === 'goals') {
            updateProfile({ goals: (profile.goals || []).map(updater) });
        } else {
            updateProfile({ antigoals: (profile.antigoals || []).map(updater) });
        }
    };

    const toggleGoalCompletion = async (id: string, isCompleted: boolean) => {
        // Can only check off in View Mode
        if (isEditing) return;

        let newProfile = { ...profile };
        const updater = (g: any) => {
            if (g.id !== id) return g;
            const now = new Date().toISOString();
            const baseEvents = g.events || [];
            const events = isCompleted
                ? [...baseEvents, { id: Date.now().toString(), type: 'achieved' as const, date: now }]
                : baseEvents.filter((e: any) => e.type !== 'achieved');

            return {
                ...g,
                completed: isCompleted,
                completedAt: isCompleted ? now : undefined,
                events
            };
        };

        if (activeTab === 'goals') {
            newProfile.goals = (newProfile.goals || []).map(updater);
        } else {
            newProfile.antigoals = (newProfile.antigoals || []).map(updater);
        }

        setProfile(newProfile);
        await StorageService.saveProfile(newProfile);
    };

    const deleteGoalItem = (id: string) => {
        const updater = (g: any) => g.id === id
            ? { ...g, cancelled: true, events: [...(g.events || []), { id: Date.now().toString(), type: 'cancelled' as const, date: new Date().toISOString() }] }
            : g;

        if (activeTab === 'goals') {
            const updated = (profile.goals || []).map(updater);
            updateProfile({ goals: updated });
        } else {
            const updated = (profile.antigoals || []).map(updater);
            updateProfile({ antigoals: updated });
        }
    };

    // Split active tasks into pending and completed for the view mode
    const pendingItems = activeList.filter(item => !item.completed);

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                {/* Top Bar (Exit Button with Top Gap before Banner) */}
                <View style={styles.topBar}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.exitBtn}>
                        <Ionicons name="arrow-back" size={24} color="#1E293B" />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    {isEditing ? (
                        <View style={styles.editActionRow}>
                            <TouchableOpacity onPress={handleEditToggle} style={styles.cancelBtn}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={saveChanges} style={styles.saveBtn}>
                                <Text style={styles.saveText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity onPress={handleEditToggle} style={styles.editProfileBtn}>
                            <Text style={styles.editProfileText}>Edit Profile</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <ScrollView
                    style={styles.pageScroll}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    ref={scrollViewRef}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                >
                    <View style={styles.headerContainer}>
                        {/* YouTube-Style Banner (Below Top Gap) */}
                        <TouchableOpacity
                            activeOpacity={isEditing ? 0.8 : 1}
                            onPress={() => handlePickImage('banner')}
                            disabled={!isEditing}
                            style={styles.bannerWrapper}
                        >
                            {profile.banner ? (
                                <Image source={{ uri: profile.banner }} style={styles.bannerImage} />
                            ) : (
                                <View style={[styles.bannerImage, { backgroundColor: '#E2E8F0' }]} />
                            )}
                            {isEditing && (
                                <View style={styles.imageEditOverlay}>
                                    <Ionicons name="camera" size={24} color="#FFF" />
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* Profile Block (Separated entirely from banner) */}
                        <View style={styles.profileBlock}>
                            {/* Avatar & Name Row */}
                            <View style={styles.identityRow}>
                                <TouchableOpacity
                                    activeOpacity={isEditing ? 0.8 : 1}
                                    onPress={() => handlePickImage('avatar')}
                                    disabled={!isEditing}
                                    style={styles.avatarWrapper}
                                >
                                    {profile.avatar ? (
                                        <Image source={{ uri: profile.avatar }} style={styles.avatarImage} />
                                    ) : (
                                        <View style={styles.avatarPlaceholder}>
                                            <Text style={{ fontSize: 36 }}>👤</Text>
                                        </View>
                                    )}
                                    {isEditing && (
                                        <View style={styles.avatarEditOverlay}>
                                            <Ionicons name="camera" size={16} color="#FFF" />
                                        </View>
                                    )}
                                </TouchableOpacity>

                                <View style={styles.nameBlock}>
                                    {isEditing ? (
                                        <TextInput
                                            style={styles.userNameInput}
                                            value={profile.name}
                                            onChangeText={(text) => updateProfile({ name: text })}
                                            placeholder="Name"
                                            placeholderTextColor="#94A3B8"
                                        />
                                    ) : (
                                        <Text style={styles.userNameText}>{profile.name || "Add a name"}</Text>
                                    )}
                                    <Text style={styles.handleText}>@stacker</Text>
                                </View>
                            </View>

                            {/* Bio / Description */}
                            <View style={styles.bioContainer}>
                                {isEditing ? (
                                    <TextInput
                                        style={styles.userBioInput}
                                        value={profile.bio || ''}
                                        onChangeText={(text) => updateProfile({ bio: text })}
                                        placeholder="Add a bio..."
                                        placeholderTextColor="#94A3B8"
                                        multiline
                                    />
                                ) : (
                                    <Text style={styles.userBioText}>
                                        {profile.bio || "No description yet."}
                                    </Text>
                                )}
                            </View>

                            {/* --- TOP-LEVEL MASTER TABS --- */}
                            <View style={styles.masterTabContainer}>
                                <TouchableOpacity
                                    style={[styles.masterTabBtn, mainTab === 'focus' && styles.masterTabBtnActive]}
                                    onPress={() => setMainTab('focus')}
                                >
                                    <Text style={[styles.masterTabText, mainTab === 'focus' && styles.masterTabTextActive]}>Current Focus</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.masterTabBtn, mainTab === 'archive' && styles.masterTabBtnActive]}
                                    onPress={() => setMainTab('archive')}
                                >
                                    <Text style={[styles.masterTabText, mainTab === 'archive' && styles.masterTabTextActive]}>Archive</Text>
                                </TouchableOpacity>
                            </View>

                            {/* ========================================= */}
                            {/* CURRENT FOCUS TAB */}
                            {/* ========================================= */}
                            {mainTab === 'focus' && (
                                <View>
                                    {/* --- GOALS / ANTIGOALS INNER TOGGLE --- */}
                                    <View style={styles.tabContainer}>
                                        <TouchableOpacity
                                            style={[styles.tabBtn, activeTab === 'goals' && styles.tabBtnActive]}
                                            onPress={() => setActiveTab('goals')}
                                        >
                                            <Text style={[styles.tabText, activeTab === 'goals' && styles.tabTextActive]}>Goals</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.tabBtn, activeTab === 'antigoals' && styles.tabBtnActive]}
                                            onPress={() => setActiveTab('antigoals')}
                                        >
                                            <Text style={[styles.tabText, activeTab === 'antigoals' && styles.tabTextActive]}>Anti-Goals</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* --- LIST SECTION --- */}
                                    <View style={styles.listContainer}>
                                        {pendingItems.length === 0 ? (
                                            <Text style={styles.emptyText}>No active {activeTab} at the moment.</Text>
                                        ) : (
                                            pendingItems.map((item) => (
                                                <View key={item.id} style={styles.inlineEditRow}>
                                                    <TouchableOpacity onPress={() => toggleGoalCompletion(item.id, true)} style={styles.inlineCheckbox}>
                                                        <Ionicons name="ellipse-outline" size={24} color="#CBD5E1" />
                                                    </TouchableOpacity>

                                                    {isEditing && (
                                                        <TouchableOpacity
                                                            style={[styles.inlineColorDot, { backgroundColor: item.color || '#3B82F6' }]}
                                                            onPress={() => cycleGoalColor(item.id)}
                                                        />
                                                    )}

                                                    <TextInput
                                                        style={styles.inlineInput}
                                                        value={item.title}
                                                        onChangeText={(t) => updateGoalItem(item.id, t)}
                                                        placeholder={`Enter ${activeTab === 'goals' ? 'Goal' : 'Anti-Goal'}...`}
                                                        placeholderTextColor="#94A3B8"
                                                        editable={isEditing}
                                                    />
                                                    {isEditing && (
                                                        <TouchableOpacity onPress={() => deleteGoalItem(item.id)} style={styles.inlineDeleteBtn}>
                                                            <Ionicons name="close" size={20} color="#94A3B8" />
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            ))
                                        )}

                                        {/* Triggered Add Button capped at 5 active items */}
                                        {pendingItems.length < 5 && (
                                            <TouchableOpacity
                                                style={styles.addGoalBtn}
                                                onPress={() => setIsAddingGoal(true)}
                                            >
                                                <Ionicons name="add" size={20} color="#3B82F6" />
                                                <Text style={styles.addGoalText}>Add {activeTab === 'goals' ? 'Goal' : 'Anti-Goal'} ({pendingItems.length}/5)</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            )}

                            {/* ========================================= */}
                            {/* ARCHIVE TAB */}
                            {/* ========================================= */}
                            {mainTab === 'archive' && !isEditing && (
                                <View style={styles.archiveContainer}>

                                    <View style={styles.archivedSectionBlock}>
                                        <Text style={styles.archivedHeader}>ACHIEVEMENT TIMELINE</Text>
                                        <TouchableOpacity style={styles.viewTimelineBtn} onPress={() => router.push('/timeline')}>
                                            <Ionicons name="git-commit-outline" size={24} color="#3B82F6" />
                                            <Text style={styles.viewTimelineText}>View Achievement Timeline</Text>
                                            <Ionicons name="chevron-forward" size={20} color="#94A3B8" style={{ marginLeft: 'auto' }} />
                                        </TouchableOpacity>
                                    </View>

                                    {/* --- BEST DAYS SECTION (Empty Window) --- */}
                                    <View style={styles.bestDaysContainer}>
                                        <Text style={styles.bestDaysTitle}>Best Days</Text>
                                        <View style={styles.bestDaysWindow}>
                                            <Text style={styles.bestDaysPlaceholder}>No best days recorded yet.</Text>
                                        </View>
                                    </View>

                                </View>
                            )}

                        </View>
                    </View>
                </ScrollView>

                {/* --- TRIGGERED QUICK ADD BAR (Keyboard Aligned) --- */}
                {isAddingGoal && (
                    <>
                        <TouchableOpacity
                            style={styles.quickAddBackdrop}
                            activeOpacity={1}
                            onPress={() => setIsAddingGoal(false)}
                        />
                        <View style={styles.triggeredQuickAddBar}>
                            {/* Category picker chips */}
                            <View style={styles.categoryRow}>
                                {([['🧠', 'traits', 'Traits'], ['💪', 'habits', 'Habits'], ['🏠', 'environment', 'Environ.'], ['🎯', 'outcomes', 'Outcomes']] as const).map(([icon, key, label]) => (
                                    <TouchableOpacity
                                        key={key}
                                        onPress={() => setSelectedCategory(key)}
                                        style={[
                                            styles.categoryChip,
                                            selectedCategory === key && styles.categoryChipActive,
                                        ]}
                                    >
                                        <Text style={styles.categoryIcon}>{icon}</Text>
                                        <Text style={[
                                            styles.categoryLabel,
                                            selectedCategory === key && styles.categoryLabelActive,
                                        ]}>{label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <View style={styles.triggeredInputWrapper}>
                                <TextInput
                                    ref={quickAddInputRef}
                                    style={styles.triggeredInput}
                                    placeholder={`Write your ${activeTab === 'goals' ? 'Goal' : 'Anti-Goal'}...`}
                                    placeholderTextColor="#94A3B8"
                                    value={quickAddText}
                                    onChangeText={setQuickAddText}
                                    onSubmitEditing={() => addGoalItem(quickAddText)}
                                    autoFocus
                                />
                                <TouchableOpacity
                                    onPress={() => addGoalItem(quickAddText)}
                                    style={styles.triggeredSubmitBtn}
                                    disabled={!quickAddText.trim()}
                                >
                                    <Text style={[styles.triggeredSubmitText, !quickAddText.trim() && { opacity: 0.5 }]}>Add</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },

    // Top Bar Layout
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFF',
    },
    exitBtn: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
    },
    editProfileBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
    },
    editProfileText: { fontSize: 14, fontWeight: '600', color: '#1E293B' },

    // Edit Action Row
    editActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    cancelBtn: { paddingVertical: 8, paddingHorizontal: 16 },
    cancelText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    saveBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: '#3B82F6',
    },
    saveText: { fontSize: 14, fontWeight: 'bold', color: '#FFF' },

    pageScroll: { flex: 1 },
    scrollContent: { paddingBottom: 120 },
    headerContainer: { flex: 1 },

    bannerWrapper: {
        marginHorizontal: 16,
        borderRadius: 16,
        overflow: 'hidden',
    },

    // Banner (16:6 aspect ratio roughly translates to height ~130-150 relative to width depending on screen)
    // Using a fixed height or aspect ratio rule
    bannerImage: {
        width: '100%',
        aspectRatio: 16 / 6,
        backgroundColor: '#CBD5E1',
    },
    imageEditOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Profile Identity Block
    profileBlock: {
        paddingHorizontal: 20,
        paddingTop: 24, // Added padding so it starts well below the banner
    },
    identityRow: {
        flexDirection: 'row',
        alignItems: 'center', // Align avatar and name block side-by-side
        marginBottom: 20,
    },
    avatarWrapper: {
        marginRight: 20,
        borderRadius: 40,
        overflow: 'hidden',
    },
    avatarImage: { width: 80, height: 80, borderRadius: 40 },
    avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    avatarEditOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 40,
    },

    nameBlock: { flex: 1, justifyContent: 'center' },
    userNameText: { fontSize: 24, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
    userNameInput: {
        fontSize: 24,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 8,
    },
    handleText: { fontSize: 15, color: '#64748B', marginLeft: 2 },

    // Bio Styling
    bioContainer: {
        marginTop: 4,
    },
    userBioText: {
        fontSize: 15,
        color: '#1E293B',
        lineHeight: 22,
        fontWeight: '400',
    },
    userBioInput: {
        fontSize: 15,
        color: '#1E293B',
        lineHeight: 22,
        fontWeight: '400',
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        minHeight: 80,
        textAlignVertical: 'top',
    },

    // Master Tabs
    masterTabContainer: {
        flexDirection: 'row',
        marginTop: 32,
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    masterTabBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    masterTabBtnActive: {
        borderBottomColor: '#0F172A',
    },
    masterTabText: { fontSize: 16, fontWeight: '600', color: '#94A3B8' },
    masterTabTextActive: { color: '#0F172A', fontWeight: '700' },

    // Tabs
    tabContainer: {
        flexDirection: 'row',
        marginTop: 16,
        marginBottom: 16,
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        padding: 4,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    tabBtnActive: {
        backgroundColor: '#FFF',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    tabTextActive: { color: '#0F172A' },

    // Lists
    listContainer: {
        minHeight: 100,
    },
    emptyText: {
        textAlign: 'center',
        color: '#94A3B8',
        fontStyle: 'italic',
        marginTop: 20,
    },

    // Archive Button
    viewTimelineBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 24,
    },
    viewTimelineText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
        marginLeft: 12,
    },

    // Inline Edit Items (Focus View)
    inlineEditRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    inlineCheckbox: {
        marginRight: 12,
        marginTop: 2,
    },
    inlineColorDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        marginRight: 12,
        marginTop: 6,
    },
    inlineInput: {
        flex: 1,
        fontSize: 16,
        color: '#1E293B',
        minHeight: 24,
        paddingTop: 0,
    },
    inlineDeleteBtn: {
        padding: 4,
        marginLeft: 8,
    },

    // Quick Add Button (Traditional)
    addGoalBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
        marginTop: 16,
    },
    addGoalText: { color: '#3B82F6', fontWeight: '600', marginLeft: 8 },

    // Triggered Quick Add Bar (Keyboard Aligned)
    quickAddBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.2)',
        zIndex: 10,
    },
    triggeredQuickAddBar: {
        backgroundColor: '#FFF',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingHorizontal: 16,
        paddingVertical: 12,
        zIndex: 11,
        // Elevation for Android
        elevation: 8,
        // Shadow for iOS
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    triggeredInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 4,
    },
    triggeredInput: {
        flex: 1,
        fontSize: 16,
        color: '#1E293B',
        minHeight: 40,
    },
    triggeredSubmitBtn: {
        marginLeft: 12,
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    triggeredSubmitText: {
        color: '#3B82F6',
        fontWeight: 'bold',
        fontSize: 16,
    },

    // Category picker
    categoryRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 8,
    },
    categoryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 5,
        paddingHorizontal: 8,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    categoryChipActive: {
        backgroundColor: '#EFF6FF',
        borderColor: '#3B82F6',
    },
    categoryIcon: {
        fontSize: 13,
    },
    categoryLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#94A3B8',
    },
    categoryLabelActive: {
        color: '#3B82F6',
    },

    // Best Days Section
    archiveContainer: {
        marginTop: 16,
    },
    archivedSectionBlock: {
        marginTop: 16,
        marginBottom: 8,
    },
    archivedHeader: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#94A3B8',
        letterSpacing: 1,
        marginBottom: 16,
    },
    bestDaysContainer: {
        marginTop: 16,
        marginBottom: 20,
    },
    bestDaysTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0F172A',
        marginBottom: 12,
    },
    bestDaysWindow: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 150,
    },
    bestDaysPlaceholder: {
        color: '#94A3B8',
        fontSize: 14,
        fontStyle: 'italic',
    }
});
