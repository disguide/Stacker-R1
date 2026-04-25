import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, SafeAreaView, KeyboardAvoidingView, Platform, Alert, useWindowDimensions, Animated, Easing } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StorageService, UserProfile, GoalCategory, SavedSprint, Task, DailyData } from '../src/services/storage';
import { toISODateString } from '../src/utils/dateHelpers';
import { LinearGradient } from 'expo-linear-gradient';

import * as ImagePicker from 'expo-image-picker';

const GOAL_PALETTE = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#EC4899', '#06B6D4', '#F97316'];

// Shared Element Animation refs (module-level for cross-screen coordination)
const journalCardTranslateY = new Animated.Value(0);
const journalCardOpacity = new Animated.Value(1);

const getMoodColor = (rating: number) => {
    if (rating === 0) return '#94A3B8';
    if (rating >= 100) return '#A855F7';
    if (rating > 10) return '#EAB308';
    const gradient = ['#EF4444', '#F87171', '#F97316', '#FB923C', '#F59E0B', '#FBBF24', '#84CC16', '#A3E635', '#34D399', '#10B981'];
    return gradient[rating - 1];
};

const MoodCounterButton = ({ rating, onPress }: { rating: number, onPress: () => void }) => {
    const scale = useRef(new Animated.Value(1)).current;
    const tilt = useRef(new Animated.Value(0)).current;
    const rotation = tilt.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-15deg', '0deg', '15deg'] });
    const handlePress = () => {
        scale.setValue(1.6);
        tilt.setValue(Math.random() > 0.5 ? 1 : -1); 
        Animated.parallel([
            Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4, tension: 150 }),
            Animated.spring(tilt, { toValue: 0, useNativeDriver: true, friction: 4, tension: 150 })
        ]).start();
        onPress();
    };
    return (
        <TouchableOpacity style={styles.moodPillSmall} onPress={handlePress} activeOpacity={0.7}>
            <Text style={styles.moodLabelText}>MOOD</Text>
            <Animated.View style={{ transform: [{ scale }, { rotate: rotation }] }}>
                <Text style={[styles.moodNumberText, { color: getMoodColor(rating) }]}>{`${rating}/10`}</Text>
            </Animated.View>
        </TouchableOpacity>
    );
};

export default function ProfileScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [isEditing, setIsEditing] = useState(false);
    const [activeSection, setActiveSection] = useState<'profile' | 'goals' | 'sprints'>('profile');
    const [activeTab, setActiveTab] = useState<'goals' | 'antigoals'>('goals');
    const [quickAddText, setQuickAddText] = useState('');
    const [isAddingGoal, setIsAddingGoal] = useState(false);
    const [expandedSprintId, setExpandedSprintId] = useState<string | null>(null);
    const [noteVisibleIds, setNoteVisibleIds] = useState<Set<string>>(new Set());
    const { width: SCREEN_WIDTH } = useWindowDimensions();
    const horizontalPagerRef = useRef<ScrollView>(null);
    const profileScrollRef = useRef<ScrollView>(null);
    const goalsScrollRef = useRef<ScrollView>(null);
    const sprintsScrollRef = useRef<ScrollView>(null);
    const quickAddInputRef = useRef<TextInput>(null);
    const [selectedCategory, setSelectedCategory] = useState<GoalCategory>('outcomes');
    const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
    const [pendingGoalAction, setPendingGoalAction] = useState<{ id: string, listType: 'goals' | 'antigoals' } | null>(null);
    const [goalNoteText, setGoalNoteText] = useState('');

    const [savedSprints, setSavedSprints] = useState<SavedSprint[]>([]);
    const [sprintHistory, setSprintHistory] = useState<SavedSprint[]>([]);
    const [taskHistory, setTaskHistory] = useState<Task[]>([]);
    const [dailyData, setDailyData] = useState<DailyData | null>(null);
    const [todayTasks, setTodayTasks] = useState<Task[]>([]);

    const handleRatingPress = async () => {
        const todayStr = toISODateString(new Date());
        const nextRating = (dailyData?.rating || 0) + 1;
        const nextStarred = nextRating >= 10 ? true : (dailyData?.isStarred || false);
        const newData = { ...(dailyData || { date: todayStr }), date: todayStr, rating: nextRating, isStarred: nextStarred, updatedAt: new Date().toISOString() } as DailyData;
        setDailyData(newData);
        await StorageService.saveDailyData(todayStr, newData);
    };

    const handleUpdateReflection = async (text: string) => {
        const todayStr = toISODateString(new Date());
        const newData = { ...(dailyData || { date: todayStr }), date: todayStr, reflection: text, updatedAt: new Date().toISOString() } as DailyData;
        setDailyData(newData);
        await StorageService.saveDailyData(todayStr, newData);
    };

    const handleToggleStarDay = async () => {
        const todayStr = toISODateString(new Date());
        const newStatus = !(dailyData?.isStarred);
        const newData = { ...(dailyData || { date: todayStr }), date: todayStr, isStarred: newStatus, updatedAt: new Date().toISOString() } as DailyData;
        setDailyData(newData);
        await StorageService.saveDailyData(todayStr, newData);
    };

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    useFocusEffect(
        useCallback(() => {
            let mounted = true;
            const today = toISODateString(new Date());

            StorageService.loadSavedSprints().then(sprints => {
                if (mounted) setSavedSprints(sprints);
            });
            StorageService.loadSprintHistory().then(history => {
                if (mounted) setSprintHistory(history);
            });
            StorageService.loadHistory().then(history => {
                if (mounted) setTaskHistory(history);
            });
            StorageService.loadDailyData(today).then(data => {
                if (mounted) setDailyData(data);
            });
            StorageService.loadActiveTasks().then(tasks => {
                if (mounted) {
                    const completedToday = tasks.filter(t => t.completed && t.date === today);
                    setTodayTasks(completedToday);
                }
            });
            return () => { mounted = false; };
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [])
    );

    // Career Stats Calculation
    const careerStats = useCallback(() => {
        const totalWorkSeconds = sprintHistory.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
        const totalWins = sprintHistory.reduce((acc, s) => acc + (s.taskCount || 0), 0);
        const totalAchievements = savedSprints.length;

        return {
            totalWorkSeconds,
            totalWins,
            totalAchievements
        };
    }, [sprintHistory, savedSprints])();

    const [profile, setProfile] = useState<UserProfile>({
        name: '',
        handle: '',
        goals: [],
        antigoals: [],
    });

    const longestActiveGoal = useMemo(() => {
        const allActive = [
            ...(profile.goals || []),
            ...(profile.antigoals || [])
        ].filter(g => !g.completed && !g.cancelled);
        
        if (allActive.length === 0) return null;
        
        // Find the one that's been active longest (earliest createdAt)
        return [...allActive].sort((a, b) => {
            // Sort nulls to the end by treating them as very large numbers
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
            return aTime - bTime;
        })[0];
    }, [profile.goals, profile.antigoals]);

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
        ? (profile.goals || [])
        : (profile.antigoals || []);

    const handleFieldFocus = (y: number) => {
        // Give a little offset for context
        const scrollY = Math.max(0, y - 50);
        goalsScrollRef.current?.scrollTo({ y: scrollY, animated: true });
    };

    const scrollToSection = (section: 'profile' | 'goals' | 'sprints') => {
        setActiveSection(section);
        const index = section === 'profile' ? 0 : section === 'goals' ? 1 : 2;
        horizontalPagerRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    };

    const handleMomentumScrollEnd = (e: any) => {
        const offset = e.nativeEvent.contentOffset.x;
        const index = Math.round(offset / SCREEN_WIDTH);
        if (index === 0) setActiveSection('profile');
        else if (index === 1) setActiveSection('goals');
        else if (index === 2) setActiveSection('sprints');
    };

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
            color: '#3B82F6', // Neutral default
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
            profileScrollRef.current?.scrollToEnd({ animated: true });
        }, 150);
    };

    const updateGoalItem = (id: string, newTitle: string, listType: 'goals' | 'antigoals') => {
        const now = new Date().toISOString();
        const updater = (g: any) => g.id === id && g.title !== newTitle
            ? { ...g, title: newTitle, events: [...(g.events || []), { id: Date.now().toString(), type: 'modified' as const, date: now }] }
            : g;

        if (listType === 'goals') {
            const updated = (profile.goals || []).map(updater);
            updateProfile({ goals: updated });
        } else {
            const updated = (profile.antigoals || []).map(updater);
            updateProfile({ antigoals: updated });
        }
    };

    const toggleGoalCompletion = async (id: string, isCompleted: boolean, listType: 'goals' | 'antigoals') => {
        // Can only check off in View Mode
        if (isEditing) return;

        if (isCompleted) {
            // Show note modal first
            setPendingGoalAction({ id, listType });
            setGoalNoteText('');
            setIsNoteModalVisible(true);
            return;
        }

        // Un-completing logic (direct)
        performToggleCompletion(id, false, listType);
    };

    const performToggleCompletion = async (id: string, isCompleted: boolean, listType: 'goals' | 'antigoals', note?: string) => {
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
                note: note || g.note,
                events
            };
        };

        if (listType === 'goals') {
            newProfile.goals = (newProfile.goals || []).map(updater);
        } else {
            newProfile.antigoals = (newProfile.antigoals || []).map(updater);
        }

        setProfile(newProfile);
        await StorageService.saveProfile(newProfile);
    };

    const deleteGoalItem = (id: string, listType: 'goals' | 'antigoals') => {
        // Hard-delete the Goal
        if (listType === 'goals') {
            const updated = (profile.goals || []).filter(g => g.id !== id);
            updateProfile({ goals: updated });
        } else {
            const updated = (profile.antigoals || []).filter(g => g.id !== id);
            updateProfile({ antigoals: updated });
        }
    };

    const cancelGoalItem = async (id: string, listType: 'goals' | 'antigoals') => {
        Alert.alert(
            "Cancel Goal?",
            "This will move the goal to your timeline as cancelled. Are you sure?",
            [
                { text: "No", style: "cancel" },
                {
                    text: "Yes, Cancel",
                    style: "destructive",
                    onPress: async () => {
                        let newProfile = { ...profile };
                        const now = new Date().toISOString();
                        const updater = (g: any) => {
                            if (g.id !== id) return g;
                            return {
                                ...g,
                                cancelled: true,
                                cancelledAt: now,
                                events: [...(g.events || []), { id: Date.now().toString(), type: 'cancelled' as const, date: now }]
                            };
                        };

                        if (listType === 'goals') {
                            newProfile.goals = (newProfile.goals || []).map(updater);
                        } else {
                            newProfile.antigoals = (newProfile.antigoals || []).map(updater);
                        }

                        setProfile(newProfile);
                        await StorageService.saveProfile(newProfile);
                    }
                }
            ]
        );
    };

    // Split active tasks into pending and completed for the view mode
    const pendingItems = activeList.filter(item => !item.completed && !item.cancelled);

    const handleUndoTask = async (taskId: string) => {
        const task = await StorageService.removeFromHistory(taskId);
        if (task) {
            const activeTasks = await StorageService.loadActiveTasks();
            await StorageService.saveActiveTasks([{ 
                ...task, 
                completed: false, 
                completedAt: undefined,
                date: toISODateString(new Date()),
                daysRolled: undefined,
                originalDate: undefined
            }, ...activeTasks]);
            // Refresh history
            const history = await StorageService.loadHistory();
            setTaskHistory(history);
        }
    };

    const handleDeleteHistoryTask = async (taskId: string) => {
        await StorageService.deleteFromHistory(taskId);
        const history = await StorageService.loadHistory();
        setTaskHistory(history);
    };

    const toggleSprintNote = (id: string) => {
        setNoteVisibleIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleUpdateHistorySprint = async (id: string, updates: Partial<SavedSprint>) => {
        const isHistory = sprintHistory.some(s => s.id === id);
        if (isHistory) {
            const next = sprintHistory.map(s => s.id === id ? { ...s, ...updates } : s);
            setSprintHistory(next);
            await StorageService.updateSprintHistory(next);
        } else {
            const next = savedSprints.map(s => s.id === id ? { ...s, ...updates } : s);
            setSavedSprints(next);
            await StorageService.updateSavedSprints(next);
        }
    };

    // Derived: Recent Sprints (History + Saved, sorted by date)
    const recentSprints = [...sprintHistory, ...savedSprints]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i) // Unique IDs
        .slice(0, 3);

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                {/* Top Bar (Exit Button with Top Gap before Banner) */}
                {/* Top Navigation Bar */}
                <View style={styles.topBar}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.exitBtn}>
                        <View style={styles.backCircle}>
                            <Ionicons name="chevron-back" size={20} color="#007AFF" />
                        </View>
                    </TouchableOpacity>

                    {/* Centered Tab Switcher */}
                    <View style={styles.topSelectorWrapper}>
                        <View style={styles.sectionTabRow}>
                            <TouchableOpacity
                                onPress={() => scrollToSection('profile')}
                                style={[styles.sectionTab, activeSection === 'profile' && styles.sectionTabActive]}
                            >
                                <Text style={[styles.sectionTabText, activeSection === 'profile' && styles.sectionTabTextActive]}>Profile</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => scrollToSection('goals')}
                                style={[styles.sectionTab, activeSection === 'goals' && styles.sectionTabActive]}
                            >
                                <Text style={[styles.sectionTabText, activeSection === 'goals' && styles.sectionTabTextActive]}>Goals</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => scrollToSection('sprints')}
                                style={[styles.sectionTab, activeSection === 'sprints' && styles.sectionTabActive]}
                            >
                                <Text style={[styles.sectionTabText, activeSection === 'sprints' && styles.sectionTabTextActive]}>Archive</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    
                    {/* Balanced right side with Settings Button */}
                    <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsBtn}>
                        <View style={styles.backCircle}>
                            <Ionicons name="settings-outline" size={20} color="#007AFF" />
                        </View>
                    </TouchableOpacity>
                </View>

                <ScrollView
                    ref={horizontalPagerRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={handleMomentumScrollEnd}
                    scrollEventThrottle={16}
                    keyboardShouldPersistTaps="handled"
                    bounces={false}
                >
                    {/* SLIDE 1: PROFILE */}
                    <ScrollView
                        ref={profileScrollRef}
                        style={{ width: SCREEN_WIDTH }}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.profileTabContent}>
                            <View style={styles.bannerContainer}>
                                <Text style={styles.fillerTitle}>Personal overview</Text>
                                <View style={styles.profileEditWrapper}>
                                    {isEditing ? (
                                        <TouchableOpacity onPress={saveChanges} style={styles.editProfileBtnInline}>
                                            <Text style={[styles.editProfileText, { color: '#007AFF' }]}>Done</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity onPress={handleEditToggle} style={styles.editProfileBtnInline}>
                                            <Text style={styles.editProfileText}>Edit</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            {/* YouTube-Style Banner (Profile Tab Only) */}
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
                                                <Text style={{ fontSize: 36, opacity: 0.5 }}>👤</Text>
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
                                        <View style={styles.bioDisplayBox}>
                                            <Text style={styles.userBioText}>
                                                {profile.bio || "No description yet."}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                    </ScrollView>

                    {/* SLIDE 2: GOALS */}
                    <ScrollView
                        ref={goalsScrollRef}
                        style={{ width: SCREEN_WIDTH }}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.goalsTabContent}>
                            <Text style={styles.fillerTitle}>Current progress</Text>
                            {/* --- TIMELINE HERO --- */}
                            {!isEditing && (
                                <View style={styles.archivedSectionBlock}>
                                    <TouchableOpacity
                                        style={styles.timelineHeroBlock}
                                        onPress={() => router.push('/timeline')}
                                        activeOpacity={0.8}
                                    >
                                        <View style={styles.heroContentInner}>
                                            <View style={styles.timelineHeroHeader}>
                                                <View style={styles.timelineIconBox}>
                                                    <Ionicons name="git-commit-outline" size={22} color="#FFF" />
                                                </View>
                                                <Text style={styles.timelineHeroTag}>ACTIVITY & TIMELINE</Text>
                                            </View>
                                            <Text style={styles.timelineHeroTitle}>Goals Timeline</Text>
                                            {longestActiveGoal ? (
                                                <View style={styles.timelineHeroInsight}>
                                                    <Ionicons name="trending-up" size={14} color="rgba(255,255,255,0.7)" />
                                                    <Text style={styles.timelineInsightText}>
                                                        Longest goal: {longestActiveGoal.title}
                                                    </Text>
                                                </View>
                                            ) : (
                                                <Text style={styles.timelineHeroSub}>View your daily work flow and milestones</Text>
                                            )}
                                        </View>
                                        <View style={styles.timelineHeroArrow}>
                                            <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.6)" />
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* --- COMBINED LISTS --- */}
                            <View style={styles.combinedListContainer}>
                                <Text style={styles.journalSectionHeading}>GOALS</Text>
                                {(profile.goals || []).filter(g => !g.completed && !g.cancelled).length === 0 ? (
                                    <Text style={styles.emptyText}>No active goals.</Text>
                                ) : (
                                    (profile.goals || []).filter(g => !g.completed && !g.cancelled).map((item) => (
                                        <View key={item.id} style={styles.inlineEditRow}>
                                            <TouchableOpacity
                                                onPress={() => toggleGoalCompletion(item.id, true, 'goals')}
                                                style={styles.inlineCheckbox}
                                            >
                                                <Ionicons
                                                    name={item.completed ? "checkmark-circle" : "ellipse-outline"}
                                                    size={24}
                                                    color="#3B82F6"
                                                />
                                            </TouchableOpacity>

                                            <View style={styles.inlineContentWrapper}>
                                                <TextInput
                                                    style={styles.inlineInput}
                                                    value={item.title}
                                                    onChangeText={(t) => updateGoalItem(item.id, t, 'goals')}
                                                    onFocus={(e) => {
                                                        setActiveTab('goals');
                                                        if (!isEditing) handleEditToggle();
                                                        e.target.measure((x, y, width, height, pageX, pageY) => {
                                                            handleFieldFocus(pageY);
                                                        });
                                                    }}
                                                    placeholder="Enter Goal..."
                                                    placeholderTextColor="#94A3B8"
                                                />

                                                {!isEditing && (
                                                    <View style={styles.tagWrapper}>
                                                        <View style={[styles.listCategoryTag, { backgroundColor: '#3B82F615' }]}>
                                                            <Text style={[styles.listCategoryTagText, { color: '#3B82F6' }]}>
                                                                {item.category ? item.category.toUpperCase() : 'GOAL'}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                )}
                                            </View>

                                            {!isEditing && (
                                                <TouchableOpacity onPress={() => cancelGoalItem(item.id, 'goals')} style={styles.inlineCancelBtn}>
                                                    <Ionicons name="close-circle-outline" size={20} color="#94A3B8" />
                                                </TouchableOpacity>
                                            )}

                                            {isEditing && (
                                                <TouchableOpacity onPress={() => deleteGoalItem(item.id, 'goals')} style={styles.inlineDeleteBtn}>
                                                    <Ionicons name="close" size={20} color="#94A3B8" />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    ))
                                )}
                                {(profile.goals || []).filter(g => !g.completed && !g.cancelled).length < 5 ? (
                                    <TouchableOpacity
                                        style={styles.addGoalBtnSmall}
                                        onPress={() => { setActiveTab('goals'); setIsAddingGoal(true); }}
                                    >
                                        <Ionicons name="add" size={18} color="#3B82F6" />
                                        <Text style={styles.addGoalTextSmall}>Add Goal</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <Text style={styles.capMessage}>Goal limit reached (5)</Text>
                                )}

                                <Text style={[styles.sectionHeading, { marginTop: 32 }]}>ANTI-GOALS</Text>
                                {(profile.antigoals || []).filter(g => !g.completed && !g.cancelled).length === 0 ? (
                                    <Text style={styles.emptyText}>No active anti-goals.</Text>
                                ) : (
                                    (profile.antigoals || []).filter(g => !g.completed && !g.cancelled).map((item) => (
                                        <View key={item.id} style={styles.inlineEditRow}>
                                            <TouchableOpacity
                                                onPress={() => toggleGoalCompletion(item.id, true, 'antigoals')}
                                                style={styles.inlineCheckbox}
                                            >
                                                <Ionicons
                                                    name={item.completed ? "checkmark-circle" : "ellipse-outline"}
                                                    size={24}
                                                    color="#EF4444"
                                                />
                                            </TouchableOpacity>

                                            <View style={styles.inlineContentWrapper}>
                                                <TextInput
                                                    style={styles.inlineInput}
                                                    value={item.title}
                                                    onChangeText={(t) => updateGoalItem(item.id, t, 'antigoals')}
                                                    onFocus={(e) => {
                                                        setActiveTab('antigoals');
                                                        if (!isEditing) handleEditToggle();
                                                        e.target.measure((x, y, width, height, pageX, pageY) => {
                                                            handleFieldFocus(pageY);
                                                        });
                                                    }}
                                                    placeholder="Enter Anti-Goal..."
                                                    placeholderTextColor="#94A3B8"
                                                />

                                                {!isEditing && (
                                                    <View style={styles.tagWrapper}>
                                                        <View style={[styles.listCategoryTag, { backgroundColor: '#EF444415' }]}>
                                                            <Text style={[styles.listCategoryTagText, { color: '#EF4444' }]}>
                                                                {item.category ? item.category.toUpperCase() : 'ANTI-GOAL'}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                )}
                                            </View>

                                            {!isEditing && (
                                                <TouchableOpacity onPress={() => cancelGoalItem(item.id, 'antigoals')} style={styles.inlineCancelBtn}>
                                                    <Ionicons name="close-circle-outline" size={20} color="#94A3B8" />
                                                </TouchableOpacity>
                                            )}

                                            {isEditing && (
                                                <TouchableOpacity onPress={() => deleteGoalItem(item.id, 'antigoals')} style={styles.inlineDeleteBtn}>
                                                    <Ionicons name="close" size={20} color="#94A3B8" />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    ))
                                )}
                                {(profile.antigoals || []).filter(g => !g.completed && !g.cancelled).length < 5 ? (
                                    <TouchableOpacity
                                        style={styles.addGoalBtnSmall}
                                        onPress={() => { setActiveTab('antigoals'); setIsAddingGoal(true); }}
                                    >
                                        <Ionicons name="add" size={18} color="#EF4444" />
                                        <Text style={[styles.addGoalTextSmall, { color: '#EF4444' }]}>Add Anti-Goal</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <Text style={styles.capMessage}>Anti-goal limit reached (5)</Text>
                                )}
                            </View>
                        </View>
                    </ScrollView>

                    {/* SLIDE 3: SPRINTS */}
                    <ScrollView
                        ref={sprintsScrollRef}
                        style={{ width: SCREEN_WIDTH }}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.sprintsTabContent}>
                            <Text style={styles.fillerTitle}>Hall of Fame</Text>
                            <View style={styles.bestDaysContainer}>
                                <TouchableOpacity
                                    activeOpacity={0.9}
                                    onPress={() => router.push('/achievements')}
                                >
                                    <LinearGradient
                                        colors={['#F59E0B', '#FBBF24']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.heroCard}
                                    >
                                        <View style={styles.heroBadge}>
                                            <Ionicons name="trophy" size={12} color="#F59E0B" />
                                            <Text style={styles.heroBadgeText}>LIFETIME CAREER</Text>
                                        </View>
                                        <View style={styles.heroContentInner}>
                                            <View style={styles.heroMain}>
                                                <Text style={styles.heroTime}>{formatDuration(careerStats.totalWorkSeconds)}</Text>
                                                <Text style={styles.heroTask} numberOfLines={1}>Total Deep Focus Time</Text>
                                            </View>
                                            <View style={styles.heroFooter}>
                                                <View style={styles.heroStat}>
                                                    <Ionicons name="checkmark-done-circle" size={16} color="rgba(255,255,255,0.9)" />
                                                    <Text style={styles.heroStatText}>{careerStats.totalWins} Total Wins</Text>
                                                </View>
                                                <View style={styles.heroStat}>
                                                    <Ionicons name="ribbon" size={16} color="rgba(255,255,255,0.9)" />
                                                    <Text style={styles.heroStatText}>{careerStats.totalAchievements} Achievements</Text>
                                                </View>
                                            </View>
                                        </View>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>

                            <View style={{ height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 8, marginVertical: 16 }} />

                            <View style={{ height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 8, marginVertical: 16 }} />

                            <View style={styles.bestDaysContainer}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <Text style={styles.bestDaysTitle}>Journal</Text>
                                    <TouchableOpacity onPress={() => {
                                        // Exit animation: slide up + fade out
                                        Animated.parallel([
                                            Animated.timing(journalCardTranslateY, { toValue: -30, duration: 250, useNativeDriver: true }),
                                            Animated.timing(journalCardOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
                                        ]).start(() => {
                                            router.push('/journal');
                                            // Reset after navigation
                                            setTimeout(() => {
                                                journalCardTranslateY.setValue(0);
                                                journalCardOpacity.setValue(1);
                                            }, 500);
                                        });
                                    }}>
                                        <Text style={{ color: '#3B82F6', fontWeight: '700', fontSize: 14 }}>Full Log</Text>
                                    </TouchableOpacity>
                                </View>

                                <Animated.View style={[styles.logDayBlock, { transform: [{ translateY: journalCardTranslateY }], opacity: journalCardOpacity }]}>
                                    <View style={styles.dayHeaderRow}>
                                        <Text style={styles.dayTitleText}>
                                            {`${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} -0D`}
                                        </Text>
                                        <TouchableOpacity 
                                            onPress={handleToggleStarDay}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            style={styles.starCircleButton}
                                        >
                                            <Ionicons 
                                                name={"star"} 
                                                size={20} 
                                                color={dailyData?.isStarred ? "#F59E0B" : "#CBD5E1"} 
                                            />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={[styles.reflectionCard, { marginTop: 0, marginBottom: 24 }]}>
                                        <View style={styles.reflectionHeader}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <Text style={styles.reflectionTitle}>Reflection</Text>
                                                {(dailyData?.rating || 0) > 0 && (
                                                    <TouchableOpacity 
                                                        onPress={async () => {
                                                            const todayStr = toISODateString(new Date());
                                                            const newData = { ...(dailyData || { date: todayStr }), rating: 0, updatedAt: new Date().toISOString() } as DailyData;
                                                            setDailyData(newData);
                                                            await StorageService.saveDailyData(todayStr, newData);
                                                        }}
                                                        style={{ padding: 4 }}
                                                    >
                                                        <Ionicons name="refresh-outline" size={16} color="#94A3B8" />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                            <MoodCounterButton 
                                                rating={dailyData?.rating || 0} 
                                                onPress={handleRatingPress} 
                                            />
                                        </View>
                                        <TextInput
                                            style={styles.reflectionInput}
                                            placeholder="Notes for yourself..."
                                            placeholderTextColor="#ABB5C2"
                                            multiline
                                            scrollEnabled={false}
                                            value={dailyData?.reflection || ''}
                                            onChangeText={handleUpdateReflection}
                                            onBlur={() => {
                                                if (dailyData?.reflection && dailyData.reflection.trim() !== dailyData.reflection) {
                                                    handleUpdateReflection(dailyData.reflection.trim());
                                                }
                                            }}
                                        />
                                    </View>

                                    {todayTasks.length > 0 && (
                                        <View style={styles.listSection}>
                                            <Text style={styles.journalSectionHeading}>Tasks Completed</Text>
                                            <View style={{ gap: 10 }}>
                                                {todayTasks.map((task) => (
                                                    <View key={task.id} style={styles.taskItemRow}>
                                                        <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                                                        <Text style={[styles.taskItemText, { color: '#94A3B8' }]} numberOfLines={1}>
                                                            {task.title}
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    )}

                                    {sprintHistory.filter(s => s.date === toISODateString(new Date())).length > 0 && (
                                        <View style={styles.listSection}>
                                            <Text style={styles.journalSectionHeading}>Archived Sessions</Text>
                                            <View style={{ gap: 8 }}>
                                            {sprintHistory.filter(s => s.date === toISODateString(new Date())).map((sprint, sIdx) => (
                                                <View key={sprint.id || sIdx} style={styles.sprintItemRow}>
                                                    <View style={styles.sprintIconWrap}>
                                                        <Ionicons name="flash-outline" size={16} color="#3B82F6" />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.sprintItemText} numberOfLines={1}>{sprint.primaryTask || 'Focus Session'}</Text>
                                                        {sprint.note && <Text style={styles.sprintLogNote}>"{sprint.note}"</Text>}
                                                    </View>
                                                    <Text style={styles.completedSprintDuration}>{Math.floor((sprint.durationSeconds || 0) / 60)}m</Text>
                                                </View>
                                            ))}
                                            </View>
                                        </View>
                                    )}

                                    {todayTasks.length === 0 && sprintHistory.filter(s => s.date === toISODateString(new Date())).length === 0 && !dailyData?.reflection && !dailyData?.rating && (
                                        <View style={{ height: 40 }} />
                                    )}
                                </Animated.View>
                            </View>

                            {!isEditing && (
                                <>
                                    <View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 32 }} />
                                </>
                            )}
                        </View>
                    </ScrollView>
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

                {/* GOAL COMPLETION NOTE MODAL */}
                {isNoteModalVisible && (
                    <>
                        <TouchableOpacity
                            style={styles.quickAddBackdrop}
                            activeOpacity={1}
                            onPress={() => {
                                setIsNoteModalVisible(false);
                                setPendingGoalAction(null);
                            }}
                        />
                        <View style={styles.triggeredQuickAddBar}>
                            <Text style={styles.noteModalHeader}>CONGRATS! ANY REFLECTIONS?</Text>
                            <View style={styles.triggeredInputWrapper}>
                                <TextInput
                                    style={styles.triggeredInput}
                                    placeholder="Add a result note (optional)..."
                                    placeholderTextColor="#94A3B8"
                                    value={goalNoteText}
                                    onChangeText={setGoalNoteText}
                                    autoFocus
                                />
                                <TouchableOpacity
                                    onPress={() => {
                                        if (pendingGoalAction) {
                                            performToggleCompletion(pendingGoalAction.id, true, pendingGoalAction.listType, goalNoteText);
                                        }
                                        setIsNoteModalVisible(false);
                                        setPendingGoalAction(null);
                                    }}
                                    style={styles.triggeredSubmitBtn}
                                >
                                    <Text style={styles.triggeredSubmitText}>Done</Text>
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
        paddingLeft: 6, // Moved further left
        paddingRight: 16,
        paddingBottom: 8,
        backgroundColor: '#FFF',
        justifyContent: 'space-between',
    },
    fillerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0F172A',
        marginLeft: 8,
        marginBottom: 4,
        marginTop: 0,
    },
    exitBtn: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12, // More space to the selector
    },
    settingsBtn: {
        width: 44,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    backCircle: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    topSelectorWrapper: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    editProfileBtnInline: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    editProfileText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
    bannerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingRight: 16,
        marginBottom: 2,
    },
    profileEditWrapper: {
        marginTop: -8,
        marginBottom: 0,
    },
    exitEditBtn: {
        padding: 4,
    },

    // Edit Action Row - Removed Cancel/Save specific styles

    pageScroll: { flex: 1 },
    scrollContent: { paddingBottom: 300 },
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
        paddingTop: 16, // Reduced padding to tighten vertical space below banner
    },
    identityRow: {
        flexDirection: 'row',
        alignItems: 'center', // Align avatar and name block side-by-side
        marginBottom: 20,
    },
    avatarWrapper: {
        marginRight: 20,
        borderRadius: 16,
        overflow: 'hidden',
    },
    avatarImage: { width: 100, height: 100, borderRadius: 16 },
    avatarPlaceholder: { width: 100, height: 100, borderRadius: 16, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#000000' },
    avatarEditOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 16,
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
    bioDisplayBox: {
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        minHeight: 80,
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

    // Section Navigation Centered
    sectionTabRow: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderRadius: 14,
        padding: 4,
        minWidth: 280,
    },
    sectionTab: {
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        alignItems: 'center',
    },
    sectionTabActive: {
        backgroundColor: '#FFF',
        borderColor: '#007AFF', // Blue border for active tab
        shadowColor: "#007AFF",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 3,
        elevation: 3,
    },
    sectionTabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#94A3B8',
    },
    sectionTabTextActive: {
        color: '#007AFF', // Blue text for active tab
        fontWeight: 'bold',
    },

    // Combined List Styles
    profileTabContent: {
        paddingTop: 12,
    },
    goalsTabContent: {
        paddingTop: 12,
    },
    combinedListContainer: {
        paddingHorizontal: 20,
        marginTop: 24,
    },
    sectionHeading: {
        fontSize: 11,
        fontWeight: '900',
        color: '#94A3B8',
        letterSpacing: 1.5,
        marginBottom: 16,
    },
    addGoalBtnSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        marginTop: 8,
    },
    addGoalTextSmall: {
        fontSize: 14,
        fontWeight: '700',
        color: '#3B82F6',
        marginLeft: 8,
    },

    sprintsTabContent: {
        paddingTop: 12,
    },

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
    capMessage: {
        fontSize: 12,
        color: '#94A3B8',
        fontStyle: 'italic',
        marginTop: 8,
        textAlign: 'center',
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
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    inlineCheckbox: {
        marginRight: 12,
    },
    tagWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    listCategoryTag: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    listCategoryTagText: {
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    inlineInput: {
        fontSize: 16,
        color: '#1E293B',
        minHeight: 24,
        paddingTop: 0,
    },
    inlineContentWrapper: {
        flex: 1,
        flexDirection: 'column',
    },
    inlineDeleteBtn: {
        padding: 4,
        marginLeft: 4,
    },
    inlineCancelBtn: {
        padding: 4,
        marginLeft: 4,
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
    noteModalHeader: {
        fontSize: 10,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 1,
        marginBottom: 12,
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

    // Timeline Hero Block
    timelineHeroBlock: {
        backgroundColor: '#1E293B',
        borderRadius: 24,
        padding: 28,
        marginHorizontal: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 8,
        minHeight: 180,
    },
    heroContentInner: {
        flex: 1,
        marginHorizontal: 4,
    },
    timelineHeroHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    timelineIconBox: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    timelineHeroTag: {
        fontSize: 10,
        fontWeight: '900',
        color: '#94A3B8',
        letterSpacing: 1.5,
    },
    timelineHeroTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#FFF',
        marginBottom: 8,
    },
    timelineHeroSub: {
        fontSize: 14,
        color: '#94A3B8',
        fontWeight: '500',
    },
    timelineHeroInsight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    timelineInsightText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '600',
    },
    timelineHeroArrow: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 16,
    },

    // Reset Styles
    resetContainer: {
        marginTop: 16,
        paddingBottom: 40,
    },
    resetHeader: {
        fontSize: 12,
        fontWeight: '900',
        color: '#EF4444',
        letterSpacing: 1.5,
        marginBottom: 12,
    },
    resetFullBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#FEF2F2',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FEE2E2',
    },
    resetFullText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#EF4444',
    },
    resetSubtext: {
        fontSize: 13,
        color: '#94A3B8',
        marginTop: 10,
        fontWeight: '500',
        lineHeight: 18,
    },

    // Best Days Section
    archiveContainer: {
        marginTop: 16,
    },
    archivedSectionBlock: {
        marginTop: 0,
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
        marginTop: 0,
        marginBottom: 20,
        paddingHorizontal: 8,
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
    },

    // Best Days / Hero Card
    heroCard: {
        borderRadius: 24,
        padding: 28,
        marginHorizontal: 8,
        minHeight: 180,
        position: 'relative',
        overflow: 'hidden',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10,
    },
    heroBadge: {
        position: 'absolute',
        top: 20,
        right: 20,
        backgroundColor: 'rgba(255,255,255,0.9)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    heroBadgeText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#F59E0B',
        letterSpacing: 1,
    },
    heroMain: {
        marginTop: 20,
    },
    heroTime: {
        fontSize: 42,
        fontWeight: '900',
        color: '#FFF',
        letterSpacing: -1,
    },
    heroTask: {
        fontSize: 18,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.9)',
        marginTop: -4,
    },
    heroFooter: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 'auto',
        paddingTop: 20,
    },
    heroStat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    heroStatText: {
        fontSize: 13,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)',
    },

    // Focus Journal
    savedSprintsList: {
        gap: 12,
    },
    journalCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    journalContent: {
        flex: 1,
    },
    journalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    journalTitleInput: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
        maxWidth: '65%',
        padding: 0,
        margin: 0,
    },
    journalActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    journalActionBtn: {
        padding: 4,
    },
    journalDate: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
    },
    journalNoteContainer: {
        marginTop: 8,
        padding: 12,
        backgroundColor: '#FFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    journalNoteInput: {
        fontSize: 13,
        color: '#1E293B',
        lineHeight: 18,
        padding: 0,
        margin: 0,
        textAlignVertical: 'top',
    },
    journalStats: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    journalDuration: {
        fontSize: 13,
        fontWeight: '700',
        color: '#3B82F6',
    },
    journalTaskCount: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: '500',
    },
    journalTimeline: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        gap: 8,
    },
    timelineItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    timelineDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    timelineText: {
        flex: 1,
        fontSize: 13,
        color: '#334155',
    },
    timelineTime: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8',
    },

    viewAllFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 6,
        marginTop: 8,
    },
    viewAllFooterText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#3B82F6',
    },
    statDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#CBD5E1',
        marginHorizontal: 8,
    },
    expandedTimelineSection: {
        marginTop: 16,
    },
    expandedDivider: {
        height: 1,
        backgroundColor: '#E2E8F0',
        marginBottom: 16,
    },
    timelineLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 1,
        marginBottom: 12,
    },
    timelineListRow: {
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
    timelineTextContent: {
        flex: 1,
        paddingBottom: 12,
    },
    timelineInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    timelineTaskTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
        maxWidth: '80%',
    },
    timelineTaskTime: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '700',
    },
    historyActions: {
        flexDirection: 'row',
        gap: 8,
    },
    historyActionBtn: {
        padding: 6,
        backgroundColor: '#FFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    logDayBlock: { marginBottom: 40 },
    dayHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 16 },
    dayTitleText: { fontSize: 18, fontWeight: '700', fontFamily: 'Georgia', color: '#1E293B', letterSpacing: 0.5 },
    starCircleButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
    listSection: { marginBottom: 24 },
    journalSectionHeading: { fontSize: 14, fontWeight: '700', color: '#94A3B8', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },
    taskItemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    taskItemText: { flex: 1, fontSize: 16, fontFamily: 'Times New Roman' },
    sprintItemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, gap: 12 },
    sprintIconWrap: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
    sprintItemText: { fontSize: 15, fontWeight: '600', color: '#334155' },
    completedSprintDuration: { fontSize: 14, fontWeight: '700', color: '#3B82F6' },
    sprintLogNote: { fontSize: 13, color: '#94A3B8', marginTop: 2, fontStyle: 'italic' },
    reflectionCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginTop: 8, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    reflectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    reflectionTitle: { fontSize: 16, fontWeight: 'bold', fontFamily: 'Georgia', color: '#64748B' },
    moodPillSmall: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, gap: 6 },
    moodLabelText: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 1 },
    moodNumberText: { fontSize: 16, fontWeight: '600', color: '#333', fontFamily: 'Georgia' },
    reflectionInput: { fontSize: 16, color: '#475569', lineHeight: 24, textAlignVertical: 'top', minHeight: 80, fontFamily: 'Times New Roman' },
});
