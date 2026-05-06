import { useTranslation } from 'react-i18next';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, KeyboardAvoidingView, Platform, Alert, useWindowDimensions, Animated, Easing, Modal, Dimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StorageService, UserProfile, GoalCategory, SavedSprint, Task, DailyData } from '../src/services/storage';
import { toISODateString } from '../src/utils/dateHelpers';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { ImageUploadService } from '../src/services/ImageUploadService';
import { useAuth } from '../src/providers/AuthProvider';
import Slider from '@react-native-community/slider';
import SwipeableTaskRow from '../src/components/SwipeableTaskRow';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
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
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { user } = useAuth();

    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activeSection, setActiveSection] = useState<'profile' | 'goals' | 'sprints'>('profile');
    const [addingToList, setAddingToList] = useState<'goals' | 'antigoals' | null>(null);
    const [quickAddText, setQuickAddText] = useState('');
    const [quickAddTargetCount, setQuickAddTargetCount] = useState<string>('1');
    const [quickAddDeadline, setQuickAddDeadline] = useState<Date | null>(null);
    const [quickAddNote, setQuickAddNote] = useState('');
    const [showCalendar, setShowCalendar] = useState(false);
    const [calYear, setCalYear] = useState(new Date().getFullYear());
    const [calMonth, setCalMonth] = useState(new Date().getMonth());
    const [isAddingGoal, setIsAddingGoal] = useState(false);
    const [isScrollEnabled, setIsScrollEnabled] = useState(true);
    const [editingGoal, setEditingGoal] = useState<{item: any, listType: 'goals' | 'antigoals'} | null>(null);
    const [editGoalTitle, setEditGoalTitle] = useState('');
    const [editGoalNote, setEditGoalNote] = useState('');
    const [editGoalTarget, setEditGoalTarget] = useState('100');
    const [editGoalCategory, setEditGoalCategory] = useState('');
    const [editGoalDeadline, setEditGoalDeadline] = useState('');
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
        const newData = { ...(dailyData || { date: todayStr }), date: todayStr, rating: nextRating, isStarred: nextStarred, updated_at: Date.now() } as DailyData;
        setDailyData(newData);
        await StorageService.saveDailyData(todayStr, newData);
    };

    const handleUpdateReflection = async (text: string) => {
        const todayStr = toISODateString(new Date());
        const newData = { ...(dailyData || { date: todayStr }), date: todayStr, reflection: text, updated_at: Date.now() } as DailyData;
        setDailyData(newData);
        await StorageService.saveDailyData(todayStr, newData);
    };

    const handleToggleStarDay = async () => {
        const todayStr = toISODateString(new Date());
        const newStatus = !(dailyData?.isStarred);
        const newData = { ...(dailyData || { date: todayStr }), date: todayStr, isStarred: newStatus, updated_at: Date.now() } as DailyData;
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
                    const completedToday = tasks.filter(t => t.isCompleted && t.date === today);
                    setTodayTasks(completedToday);
                }
            });
            return () => { mounted = false; };
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
        ].filter(g => !g.isCompleted && !g.cancelled);
        
        if (allActive.length === 0) return null;
        
        // Find the one that's been active longest (earliest created_at)
        return [...allActive].sort((a, b) => {
            const aTime = a.created_at || Date.now();
            const bTime = b.created_at || Date.now();
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
        setIsSaving(true);
        
        let finalProfile = { ...profile };
        
        // 1. ENSURE ALL LOCAL ASSETS ARE REMOTE
        // We do this again here in case the background upload from handlePickImage 
        // hasn't finished or was interrupted.
        if (user?.id) {
            try {
                if (ImageUploadService.isLocalUri(finalProfile.avatar)) {
                    if (__DEV__) console.log('[Profile] Syncing avatar before save...');
                    const url = await ImageUploadService.upload(finalProfile.avatar!, user.id, 'avatar');
                    if (url) finalProfile.avatar = url;
                }
                
                if (ImageUploadService.isLocalUri(finalProfile.banner)) {
                    if (__DEV__) console.log('[Profile] Syncing banner before save...');
                    const url = await ImageUploadService.upload(finalProfile.banner!, user.id, 'banner');
                    if (url) finalProfile.banner = url;
                }
            } catch (err) {
                if (__DEV__) console.error('[Profile] Asset sync failed:', err);
                // We proceed anyway to save the text changes, but assets might stay local
            }
        }

        // 2. PERSIST TO STORAGE
        setProfile(finalProfile);
        await StorageService.saveProfile(finalProfile);
        setDraftProfile(null);
        setIsEditing(false);
        setIsSaving(false);
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
            aspect: type === 'banner' ? [16, 6] : [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            const localUri = result.assets[0].uri;

            // Show the image IMMEDIATELY using the local URI
            updateProfile({ [type]: localUri });

            // Then upload in the background (if authenticated)
            if (user?.id) {
                ImageUploadService.upload(localUri, user.id, type).then(publicUrl => {
                    if (publicUrl) {
                        // Silently swap local URI → public URL for sync
                        setProfile(prev => ({ ...prev, [type]: publicUrl }));
                        if (__DEV__) console.log(`[Profile] ${type} uploaded → ${publicUrl}`);
                    }
                }).catch(err => {
                    if (__DEV__) console.warn(`[Profile] ${type} background upload failed:`, err);
                });
            }
        }
    };

    // --- GOAL MANAGEMENT ---
    const activeList = addingToList === 'goals'
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
        if (!goalTitle || !addingToList) return;

        const validTarget = 1;

        const newId = Date.now().toString();
        const now = Date.now();
        const deadlineStr = quickAddDeadline
            ? quickAddDeadline.toISOString().split('T')[0]
            : undefined;
        const newItem = {
            id: newId,
            title: goalTitle,
            isCompleted: false,
            created_at: now,
            category: selectedCategory,
            color: '#3B82F6',
            events: [{ id: newId, type: 'added' as const, date: now }],
            targetCount: validTarget,
            currentCount: 0,
            deadline: deadlineStr,
            note: quickAddNote.trim(),
        };
        if (addingToList === 'goals') {
            updateProfile({ goals: [...(profile.goals || []), newItem] });
        } else {
            updateProfile({ antigoals: [...(profile.antigoals || []), newItem] });
        }

        setQuickAddText('');
        setQuickAddNote('');
        setQuickAddDeadline(null);
        setShowCalendar(false);
        setAddingToList(null);
        setIsAddingGoal(false);
    };

    const updateGoalItem = (id: string, newTitle: string, listType: 'goals' | 'antigoals') => {
        const now = Date.now();
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

    const openEditGoalModal = (item: any, listType: 'goals' | 'antigoals') => {
        setEditingGoal({item, listType});
        setEditGoalTitle(item.title);
        setEditGoalNote(item.note || '');
        setEditGoalTarget((item.targetCount || 10).toString());
        setSelectedCategory(item.category || 'traits');
        
        // Initialize Date state for the calendar picker
        if (item.deadline) {
            const [y, m, d] = item.deadline.split('-').map(Number);
            const dateObj = new Date(y, m-1, d);
            dateObj.setHours(12, 0, 0, 0);
            setQuickAddDeadline(dateObj);
            setCalYear(dateObj.getFullYear());
            setCalMonth(dateObj.getMonth());
        } else {
            setQuickAddDeadline(null);
            const today = new Date();
            setCalYear(today.getFullYear());
            setCalMonth(today.getMonth());
        }
        setShowCalendar(false);
    };

    const saveGoalEdit = () => {
        if (!editingGoal) return;
        
        const now = Date.now();
        const deadlineStr = quickAddDeadline
            ? quickAddDeadline.toISOString().split('T')[0]
            : undefined;

        let newProfile = { ...profile };
        const updater = (g: any) => g.id === editingGoal.item.id ? { 
            ...g, 
            title: editGoalTitle,
            note: editGoalNote.trim(),
            category: selectedCategory,
            deadline: deadlineStr,
            events: [...(g.events || []), { id: Date.now().toString(), type: 'modified' as const, date: now }]
        } : g;

        if (editingGoal.listType === 'goals') {
            newProfile.goals = (newProfile.goals || []).map(updater);
        } else {
            newProfile.antigoals = (newProfile.antigoals || []).map(updater);
        }
        
        setProfile(newProfile);
        StorageService.saveProfile(newProfile);
        setEditingGoal(null);
    };


    const renderGoal = (item: any, listType: 'goals' | 'antigoals', color: string) => {
        const isCompleted = item.isCompleted;
        const deadlineStr = item.deadline;
        let daysRemaining = '';
        if (deadlineStr) {
            try {
                const deadlineDate = new Date(deadlineStr);
                const today = new Date();
                today.setHours(0,0,0,0);
                const diff = deadlineDate.getTime() - today.getTime();
                const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                daysRemaining = days === 0 ? 'Today' : days < 0 ? 'Exp' : `${days}d`;
            } catch (e) {}
        }

        const opacity = isCompleted ? 0.6 : 1;
        const isAntiGoal = listType === 'antigoals';
        const cardBg = isAntiGoal ? '#FFF8F8' : '#F8FBFF';
        const borderColor = isAntiGoal ? '#FEE2E2' : '#E0F2FE';

        return (
            <TouchableOpacity 
                key={item.id} 
                activeOpacity={0.7}
                onPress={() => openEditGoalModal(item, listType)}
                style={{ 
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: cardBg, 
                    borderRadius: 16, 
                    paddingVertical: 12,
                    paddingHorizontal: 14, 
                    marginBottom: 8, 
                    borderWidth: 1.5, 
                    borderColor: borderColor,
                    opacity,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.03,
                    shadowRadius: 2,
                    elevation: 1,
                }}
            >
                <TouchableOpacity 
                    onPress={() => toggleGoalCompletion(item.id, true, listType)}
                    style={[
                        styles.checkbox,
                        { borderColor: color, borderRadius: isAntiGoal ? 12 : 8, width: 22, height: 22 },
                        isCompleted && { backgroundColor: color, borderColor: color }
                    ]}
                >
                    {isCompleted ? (
                        <Ionicons name="checkmark" size={14} color="#FFF" />
                    ) : isAntiGoal ? (
                        <Ionicons name="shield-outline" size={12} color={color} />
                    ) : null}
                </TouchableOpacity>

                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text 
                        numberOfLines={1}
                        style={{ 
                            fontSize: 15, 
                            fontWeight: '700', 
                            color: '#1E293B',
                            textDecorationLine: isCompleted ? 'line-through' : 'none',
                            letterSpacing: -0.2
                        }}
                    >
                        {item.title}
                    </Text>
                    {item.note ? (
                        <Text numberOfLines={1} style={{ fontSize: 12, color: '#64748B', marginTop: 2, fontWeight: '500', fontStyle: 'italic' }}>
                            {item.note}
                        </Text>
                    ) : item.category ? (
                        <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 1, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {item.category}
                        </Text>
                    ) : null}
                </View>

                {daysRemaining !== '' && !isCompleted && (
                    <View style={{ 
                        backgroundColor: daysRemaining === 'Exp' ? '#FEF2F2' : (isAntiGoal ? '#FEE2E2' : '#E0F2FE'),
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 8,
                        marginLeft: 8
                    }}>
                        <Text style={{ 
                            fontSize: 11, 
                            fontWeight: '800', 
                            color: daysRemaining === 'Exp' ? '#EF4444' : color 
                        }}>
                            {daysRemaining}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };


    const incrementGoalCount = async (id: string, listType: 'goals' | 'antigoals') => {
        let newProfile = { ...profile };
        let showNoteModal = false;

        const updater = (g: any) => {
            if (g.id !== id || g.isCompleted) return g;
            
            const tgt = g.targetCount || 10;
            const current = (g.currentCount || 0) + 1;
            const isCompleted = current >= tgt;
            
            if (isCompleted) {
                showNoteModal = true;
            }

            return {
                ...g,
                currentCount: current,
            };
        };

        if (listType === 'goals') {
            newProfile.goals = (newProfile.goals || []).map(updater);
        } else {
            newProfile.antigoals = (newProfile.antigoals || []).map(updater);
        }
        
        setProfile(newProfile);
        await StorageService.saveProfile(newProfile);

        if (showNoteModal) {
            toggleGoalCompletion(id, true, listType);
        }
    };

    const updateGoalProgress = async (id: string, listType: 'goals' | 'antigoals', newValue: number) => {
        let newProfile = { ...profile };
        let showNoteModal = false;

        const updater = (g: any) => {
            if (g.id !== id || g.isCompleted) return g;
            
            const tgt = g.targetCount || 10;
            const current = Math.floor(Math.max(0, Math.min(newValue, tgt)));
            const isCompleted = current >= tgt;

            if (isCompleted) {
                showNoteModal = true;
            }

            return {
                ...g,
                currentCount: current,
            };
        };

        if (listType === 'goals') {
            newProfile.goals = (newProfile.goals || []).map(updater);
        } else {
            newProfile.antigoals = (newProfile.antigoals || []).map(updater);
        }
        
        setProfile(newProfile);
        await StorageService.saveProfile(newProfile);

        if (showNoteModal) {
            toggleGoalCompletion(id, true, listType);
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
            const now = Date.now();
            const baseEvents = g.events || [];
            const events = isCompleted
                ? [...baseEvents, { id: Date.now().toString(), type: 'achieved' as const, date: now }]
                : baseEvents.filter((e: any) => e.type !== 'achieved');

            return {
                ...g,
                isCompleted: isCompleted,
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
                        const now = Date.now();
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
    const pendingItems = activeList.filter(item => !item.isCompleted && !item.cancelled);

    const handleUndoTask = async (taskId: string) => {
        const task = await StorageService.removeFromHistory(taskId);
        if (task) {
            const activeTasks = await StorageService.loadActiveTasks();
            await StorageService.saveActiveTasks([{ 
                ...task, 
                isCompleted: false, 
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
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

                {isSaving && (
                    <View style={styles.syncOverlay}>
                        <View style={styles.syncModal}>
                            <Ionicons name="cloud-upload" size={32} color="#007AFF" />
                            <Text style={styles.syncText}>Uploading Banner...</Text>
                        </View>
                    </View>
                )}

                <ScrollView
                    ref={horizontalPagerRef}
                    horizontal
                    pagingEnabled
                    scrollEnabled={isScrollEnabled}
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
                                            <Text style={[styles.editProfileText, { color: '#007AFF' }]}>{t('profile.done')}</Text>
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
                                                <Ionicons name="person" size={40} color="#CBD5E1" />
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
                        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.goalsTabContent}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 }}>
                                <Text style={[styles.fillerTitle, { marginLeft: 0, marginBottom: 0 }]}>Objectives</Text>
                            </View>

                            {/* --- TIMELINE HERO --- */}
                            {!isEditing && (
                                <View style={[styles.archivedSectionBlock, { marginHorizontal: 12, marginBottom: 16 }]}>
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

                            {/* --- GOALS & ANTI-GOALS STACKED --- */}
                            <View style={{ paddingHorizontal: 12, gap: 20 }}>
                                
                                {/* GOALS BOX */}
                                <View style={{ 
                                    backgroundColor: '#FFF', 
                                    borderRadius: 28, 
                                    padding: 24, 
                                    borderWidth: 1.5, 
                                    borderColor: '#E0F2FE',
                                    shadowColor: '#0284C7',
                                    shadowOffset: { width: 0, height: 8 },
                                    shadowOpacity: 0.05,
                                    shadowRadius: 15,
                                    elevation: 5
                                }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <View style={{ width: 4, height: 16, backgroundColor: '#0284C7', borderRadius: 2 }} />
                                            <Text style={{ fontSize: 13, fontWeight: '900', color: '#0284C7', letterSpacing: 1.5 }}>GOALS</Text>
                                        </View>
                                    </View>
                                    <View>
                                        {(profile.goals || []).filter(g => !g.isCompleted && !g.cancelled).length === 0 ? (
                                            <Text style={{ fontSize: 14, color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', marginVertical: 20 }}>No active goals</Text>
                                        ) : (
                                            (profile.goals || []).filter(g => !g.isCompleted && !g.cancelled).map(item => renderGoal(item, 'goals', '#0284C7'))
                                        )}
                                        
                                        {/* ADD GOAL ROW (Main Menu Style) */}
                                        <TouchableOpacity 
                                            style={{ marginTop: 12, paddingVertical: 12 }} 
                                            onPress={() => { 
                                                setAddingToList('goals'); 
                                                setIsAddingGoal(true); 
                                                setQuickAddText(''); 
                                                setQuickAddNote('');
                                                setQuickAddDeadline(null); 
                                                setShowCalendar(false); 
                                            }}
                                        >
                                            <View style={{ alignSelf: 'flex-start' }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Ionicons name="add-circle" size={22} color="#0284C7" />
                                                    <Text style={{ color: '#0284C7', fontSize: 16, fontWeight: '700' }}>Add Goal</Text>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* ANTI GOALS BOX */}
                                <View style={{ 
                                    backgroundColor: '#FFF', 
                                    borderRadius: 28, 
                                    padding: 24, 
                                    borderWidth: 1.5, 
                                    borderColor: '#FEE2E2',
                                    shadowColor: '#DC2626',
                                    shadowOffset: { width: 0, height: 8 },
                                    shadowOpacity: 0.05,
                                    shadowRadius: 15,
                                    elevation: 5
                                }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <View style={{ width: 4, height: 16, backgroundColor: '#DC2626', borderRadius: 2 }} />
                                            <Text style={{ fontSize: 13, fontWeight: '900', color: '#DC2626', letterSpacing: 1.5 }}>ANTI-GOALS</Text>
                                        </View>
                                    </View>
                                    <View>
                                        {(profile.antigoals || []).filter(g => !g.isCompleted && !g.cancelled).length === 0 ? (
                                            <Text style={{ fontSize: 14, color: '#94A3B8', fontStyle: 'italic', textAlign: 'center', marginVertical: 20 }}>No anti-goals</Text>
                                        ) : (
                                            (profile.antigoals || []).filter(g => !g.isCompleted && !g.cancelled).map(item => renderGoal(item, 'antigoals', '#DC2626'))
                                        )}

                                        {/* ADD ANTI-GOAL ROW (Main Menu Style) */}
                                        <TouchableOpacity 
                                            style={{ marginTop: 12, paddingVertical: 12 }} 
                                            onPress={() => { 
                                                setAddingToList('antigoals'); 
                                                setIsAddingGoal(true); 
                                                setQuickAddText(''); 
                                                setQuickAddNote('');
                                                setQuickAddDeadline(null); 
                                                setShowCalendar(false); 
                                            }}
                                        >
                                            <View style={{ alignSelf: 'flex-start' }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Ionicons name="add-circle" size={22} color="#DC2626" />
                                                    <Text style={{ color: '#DC2626', fontSize: 16, fontWeight: '700' }}>Add Anti-Goal</Text>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                </View>
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

                            <View style={{ height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 8, marginTop: 4, marginBottom: 12 }} />

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
                                                            const newData = { ...(dailyData || { date: todayStr }), rating: 0, updated_at: Date.now() } as DailyData;
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

                {/* --- QUICK ADD FLOATING CARD --- */}
                {isAddingGoal && addingToList && (() => {
                    const isGoals = addingToList === 'goals';
                    const accentColor = isGoals ? '#0284C7' : '#DC2626';
                    const label = isGoals ? 'Goal' : 'Anti-Goal';

                    const firstDay = new Date(calYear, calMonth, 1).getDay();
                    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                    const calCells: (number | null)[] = [];
                    for (let i = 0; i < firstDay; i++) calCells.push(null);
                    for (let d = 1; d <= daysInMonth; d++) calCells.push(d);

                    const shiftDays = (n: number) => {
                        const base = quickAddDeadline ? new Date(quickAddDeadline) : new Date();
                        base.setHours(12, 0, 0, 0);
                        base.setDate(base.getDate() + n);
                        setQuickAddDeadline(base);
                        setCalYear(base.getFullYear());
                        setCalMonth(base.getMonth());
                    };

                    const deadlineLabel = quickAddDeadline
                        ? quickAddDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'Set Deadline';

                    const canCreate = quickAddText.trim().length > 0 && quickAddNote.trim().length > 0;

                    return (
                        <Modal 
                            visible={isAddingGoal} 
                            animationType="fade" 
                            transparent={true} 
                            onRequestClose={() => { setIsAddingGoal(false); setAddingToList(null); }}
                        >
                            <KeyboardAvoidingView 
                                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                                style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
                            >
                                <TouchableOpacity 
                                    style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.6)' }} 
                                    activeOpacity={1} 
                                    onPress={() => { setIsAddingGoal(false); setAddingToList(null); }} 
                                />
                                <View style={{ 
                                    backgroundColor: '#FFF', 
                                    borderRadius: 32, 
                                    width: SCREEN_WIDTH * 0.9,
                                    maxHeight: SCREEN_HEIGHT * 0.8,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 20 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 30,
                                    elevation: 25,
                                    overflow: 'hidden'
                                }}>
                                    {/* Premium Header */}
                                    <View style={{ backgroundColor: accentColor, paddingVertical: 24, paddingHorizontal: 24 }}>
                                        <Text style={{ fontSize: 24, fontWeight: '800', color: '#FFF' }}>{label.toUpperCase()}</Text>
                                    </View>

                                    <ScrollView style={{ padding: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                                        {/* Title Input */}
                                        <View style={{ marginBottom: 20 }}>
                                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1, marginBottom: 8 }}>TITLE</Text>
                                            <TextInput
                                                ref={quickAddInputRef}
                                                style={{ fontSize: 18, fontWeight: '600', color: '#0F172A', backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}
                                                placeholder={`What is this ${label.toLowerCase()}?`}
                                                placeholderTextColor="#94A3B8"
                                                value={quickAddText}
                                                onChangeText={setQuickAddText}
                                                autoFocus
                                            />
                                        </View>

                                        {/* Conditions for Success Input */}
                                        <View style={{ marginBottom: 24 }}>
                                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1, marginBottom: 8 }}>CONDITIONS FOR SUCCESS</Text>
                                            <TextInput
                                                style={{ fontSize: 15, fontWeight: '500', color: '#334155', backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', minHeight: 80 }}
                                                placeholder="Define exactly what victory looks like..."
                                                placeholderTextColor="#94A3B8"
                                                value={quickAddNote}
                                                onChangeText={setQuickAddNote}
                                                multiline
                                            />
                                        </View>

                                        {/* Category Selection */}
                                        <View style={{ marginBottom: 24 }}>
                                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1, marginBottom: 12 }}>TYPE</Text>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                                {([['traits', 'Traits'], ['habits', 'Habits'], ['environment', 'Environment'], ['outcomes', 'Outcomes']] as const).map(([key, lbl]) => (
                                                    <TouchableOpacity
                                                        key={key}
                                                        onPress={() => setSelectedCategory(key)}
                                                        style={{ 
                                                            paddingHorizontal: 16, 
                                                            paddingVertical: 10, 
                                                            borderRadius: 14, 
                                                            backgroundColor: selectedCategory === key ? accentColor : '#F1F5F9', 
                                                            borderWidth: 1, 
                                                            borderColor: selectedCategory === key ? accentColor : '#E2E8F0',
                                                        }}
                                                    >
                                                        <Text style={{ fontSize: 13, fontWeight: '700', color: selectedCategory === key ? '#FFF' : '#64748B' }}>{lbl}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>

                                        {/* Deadline Section */}
                                        <View style={{ marginBottom: 32 }}>
                                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1, marginBottom: 12 }}>DEADLINE</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                <TouchableOpacity
                                                    onPress={() => setShowCalendar(v => !v)}
                                                    style={{ 
                                                        flex: 1,
                                                        flexDirection: 'row', 
                                                        alignItems: 'center', 
                                                        gap: 10, 
                                                        padding: 14, 
                                                        borderRadius: 16, 
                                                        backgroundColor: quickAddDeadline ? '#EFF6FF' : '#F1F5F9', 
                                                        borderWidth: 1.5, 
                                                        borderColor: quickAddDeadline ? '#3B82F6' : '#E2E8F0' 
                                                    }}
                                                >
                                                    <Ionicons name="calendar-outline" size={20} color={quickAddDeadline ? '#3B82F6' : '#94A3B8'} />
                                                    <Text style={{ fontSize: 15, fontWeight: '700', color: quickAddDeadline ? '#3B82F6' : '#64748B' }}>{deadlineLabel}</Text>
                                                </TouchableOpacity>
                                                
                                                {quickAddDeadline && (
                                                    <TouchableOpacity
                                                        onPress={() => { setQuickAddDeadline(null); setShowCalendar(false); }}
                                                        style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <Ionicons name="close-circle" size={22} color="#EF4444" />
                                                    </TouchableOpacity>
                                                )}

                                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 4 }}>
                                                    <TouchableOpacity 
                                                        onPress={() => shiftDays(-1)}
                                                        style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <Ionicons name="remove" size={20} color="#475569" />
                                                    </TouchableOpacity>
                                                    <View style={{ paddingHorizontal: 8, minWidth: 60, alignItems: 'center' }}>
                                                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
                                                            {(() => {
                                                                if (!quickAddDeadline) return "0 days";
                                                                const diff = Math.round((quickAddDeadline.getTime() - new Date().setHours(0,0,0,0)) / 86400000);
                                                                return `${diff} days`;
                                                            })()}
                                                        </Text>
                                                    </View>
                                                    <TouchableOpacity 
                                                        onPress={() => shiftDays(1)}
                                                        style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <Ionicons name="add" size={20} color="#475569" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            {showCalendar && (
                                                <View style={{ marginTop: 16, backgroundColor: '#F8FAFC', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', padding: 16 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                                        <TouchableOpacity onPress={() => { const d = new Date(calYear, calMonth - 1, 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }}>
                                                            <Ionicons name="chevron-back" size={20} color="#0F172A" />
                                                        </TouchableOpacity>
                                                        <Text style={{ fontWeight: '800', fontSize: 16, color: '#0F172A' }}>{MONTHS[calMonth]} {calYear}</Text>
                                                        <TouchableOpacity onPress={() => { const d = new Date(calYear, calMonth + 1, 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }}>
                                                            <Ionicons name="chevron-forward" size={20} color="#0F172A" />
                                                        </TouchableOpacity>
                                                    </View>
                                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                                        {calCells.map((day, idx) => {
                                                            if (!day) return <View key={`e${idx}`} style={{ width: `${100/7}%`, aspectRatio: 1 }} />;
                                                            const cellDate = new Date(calYear, calMonth, day);
                                                            const isSelected = quickAddDeadline ? cellDate.toDateString() === quickAddDeadline.toDateString() : false;
                                                            return (
                                                                <TouchableOpacity
                                                                    key={day}
                                                                    onPress={() => { cellDate.setHours(12,0,0,0); setQuickAddDeadline(cellDate); setShowCalendar(false); }}
                                                                    style={{ width: `${100/7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}
                                                                >
                                                                    <View style={{ 
                                                                        width: 38, 
                                                                        height: 38, 
                                                                        borderRadius: 19, 
                                                                        backgroundColor: isSelected ? accentColor : 'transparent', 
                                                                        alignItems: 'center', 
                                                                        justifyContent: 'center',
                                                                    }}>
                                                                        <Text style={{ fontSize: 14, fontWeight: isSelected ? '800' : '600', color: isSelected ? '#FFF' : '#0F172A' }}>{day}</Text>
                                                                    </View>
                                                                </TouchableOpacity>
                                                            );
                                                        })}
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    </ScrollView>

                                    {/* Action Footer */}
                                    <View style={{ flexDirection: 'row', padding: 20, gap: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                                        <TouchableOpacity 
                                            onPress={() => { setIsAddingGoal(false); setAddingToList(null); }}
                                            style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 16, backgroundColor: '#F1F5F9' }}
                                        >
                                            <Text style={{ fontSize: 15, fontWeight: '700', color: '#64748B' }}>CANCEL</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => addGoalItem(quickAddText)}
                                            disabled={!canCreate}
                                            style={{ 
                                                flex: 2, 
                                                paddingVertical: 14, 
                                                alignItems: 'center', 
                                                borderRadius: 16, 
                                                backgroundColor: canCreate ? accentColor : '#F1F5F9',
                                                shadowColor: canCreate ? accentColor : 'transparent',
                                                shadowOffset: { width: 0, height: 6 },
                                                shadowOpacity: 0.3,
                                                shadowRadius: 10,
                                            }}
                                        >
                                            <Text style={{ fontSize: 15, fontWeight: '800', color: canCreate ? '#FFF' : '#94A3B8' }}>CREATE {label.toUpperCase()}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </KeyboardAvoidingView>
                        </Modal>
                    );
                })()}

                {/* --- EDIT GOAL FLOATING CARD --- */}
                {editingGoal && (() => {
                    const isGoals = editingGoal.listType === 'goals';
                    const accentColor = isGoals ? '#0284C7' : '#DC2626';
                    const label = isGoals ? 'Goal' : 'Anti-Goal';

                    const firstDay = new Date(calYear, calMonth, 1).getDay();
                    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                    const calCells: (number | null)[] = [];
                    for (let i = 0; i < firstDay; i++) calCells.push(null);
                    for (let d = 1; d <= daysInMonth; d++) calCells.push(d);

                    const shiftDays = (n: number) => {
                        const base = quickAddDeadline ? new Date(quickAddDeadline) : new Date();
                        base.setHours(12, 0, 0, 0);
                        base.setDate(base.getDate() + n);
                        setQuickAddDeadline(base);
                        setCalYear(base.getFullYear());
                        setCalMonth(base.getMonth());
                    };

                    const deadlineLabel = quickAddDeadline
                        ? quickAddDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'Set Deadline';

                    const canSave = editGoalTitle.trim().length > 0 && editGoalNote.trim().length > 0;

                    return (
                        <Modal 
                            visible={!!editingGoal} 
                            animationType="fade" 
                            transparent={true} 
                            onRequestClose={() => setEditingGoal(null)}
                        >
                            <KeyboardAvoidingView 
                                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                                style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
                            >
                                <TouchableOpacity 
                                    style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.6)' }} 
                                    activeOpacity={1} 
                                    onPress={() => setEditingGoal(null)} 
                                />
                                <View style={{ 
                                    backgroundColor: '#FFF', 
                                    borderRadius: 32, 
                                    width: SCREEN_WIDTH * 0.9,
                                    maxHeight: SCREEN_HEIGHT * 0.8,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 20 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 30,
                                    elevation: 25,
                                    overflow: 'hidden'
                                }}>
                                    {/* Premium Header */}
                                    <View style={{ backgroundColor: accentColor, paddingVertical: 24, paddingHorizontal: 24 }}>
                                        <Text style={{ fontSize: 24, fontWeight: '800', color: '#FFF' }}>{label.toUpperCase()}</Text>
                                    </View>

                                    <ScrollView style={{ padding: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                                        {/* Title Input */}
                                        <View style={{ marginBottom: 20 }}>
                                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1, marginBottom: 8 }}>TITLE</Text>
                                            <TextInput
                                                style={{ fontSize: 18, fontWeight: '600', color: '#0F172A', backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' }}
                                                placeholder="Goal title"
                                                placeholderTextColor="#94A3B8"
                                                value={editGoalTitle}
                                                onChangeText={setEditGoalTitle}
                                            />
                                        </View>

                                        {/* Conditions for Success Input */}
                                        <View style={{ marginBottom: 24 }}>
                                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1, marginBottom: 8 }}>CONDITIONS FOR SUCCESS</Text>
                                            <TextInput
                                                style={{ fontSize: 15, fontWeight: '500', color: '#334155', backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', minHeight: 80 }}
                                                placeholder="Define exactly what victory looks like..."
                                                placeholderTextColor="#94A3B8"
                                                value={editGoalNote}
                                                onChangeText={setEditGoalNote}
                                                multiline
                                            />
                                        </View>

                                        {/* Category Selection */}
                                        <View style={{ marginBottom: 24 }}>
                                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1, marginBottom: 12 }}>TYPE</Text>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                                {([['traits', 'Traits'], ['habits', 'Habits'], ['environment', 'Environment'], ['outcomes', 'Outcomes']] as const).map(([key, lbl]) => (
                                                    <TouchableOpacity
                                                        key={key}
                                                        onPress={() => setSelectedCategory(key)}
                                                        style={{ 
                                                            paddingHorizontal: 16, 
                                                            paddingVertical: 10, 
                                                            borderRadius: 14, 
                                                            backgroundColor: selectedCategory === key ? accentColor : '#F1F5F9', 
                                                            borderWidth: 1, 
                                                            borderColor: selectedCategory === key ? accentColor : '#E2E8F0',
                                                        }}
                                                    >
                                                        <Text style={{ fontSize: 13, fontWeight: '700', color: selectedCategory === key ? '#FFF' : '#64748B' }}>{lbl}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>

                                        {/* Deadline Section */}
                                        <View style={{ marginBottom: 32 }}>
                                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1, marginBottom: 12 }}>DEADLINE</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                <TouchableOpacity
                                                    onPress={() => setShowCalendar(v => !v)}
                                                    style={{ 
                                                        flex: 1,
                                                        flexDirection: 'row', 
                                                        alignItems: 'center', 
                                                        gap: 10, 
                                                        padding: 14, 
                                                        borderRadius: 16, 
                                                        backgroundColor: quickAddDeadline ? '#EFF6FF' : '#F1F5F9', 
                                                        borderWidth: 1.5, 
                                                        borderColor: quickAddDeadline ? '#3B82F6' : '#E2E8F0' 
                                                    }}
                                                >
                                                    <Ionicons name="calendar-outline" size={20} color={quickAddDeadline ? '#3B82F6' : '#94A3B8'} />
                                                    <Text style={{ fontSize: 15, fontWeight: '700', color: quickAddDeadline ? '#3B82F6' : '#64748B' }}>{deadlineLabel}</Text>
                                                </TouchableOpacity>

                                                {quickAddDeadline && (
                                                    <TouchableOpacity
                                                        onPress={() => { setQuickAddDeadline(null); setShowCalendar(false); }}
                                                        style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <Ionicons name="close-circle" size={22} color="#EF4444" />
                                                    </TouchableOpacity>
                                                )}

                                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 4 }}>
                                                    <TouchableOpacity 
                                                        onPress={() => shiftDays(-1)}
                                                        style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <Ionicons name="remove" size={20} color="#475569" />
                                                    </TouchableOpacity>
                                                    <View style={{ paddingHorizontal: 8, minWidth: 60, alignItems: 'center' }}>
                                                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
                                                            {(() => {
                                                                if (!quickAddDeadline) return "0 days";
                                                                const diff = Math.round((quickAddDeadline.getTime() - new Date().setHours(0,0,0,0)) / 86400000);
                                                                return `${diff} days`;
                                                            })()}
                                                        </Text>
                                                    </View>
                                                    <TouchableOpacity 
                                                        onPress={() => shiftDays(1)}
                                                        style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <Ionicons name="add" size={20} color="#475569" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            {showCalendar && (
                                                <View style={{ marginTop: 16, backgroundColor: '#F8FAFC', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', padding: 16 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                                        <TouchableOpacity onPress={() => { const d = new Date(calYear, calMonth - 1, 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }}>
                                                            <Ionicons name="chevron-back" size={20} color="#0F172A" />
                                                        </TouchableOpacity>
                                                        <Text style={{ fontWeight: '800', fontSize: 16, color: '#0F172A' }}>{MONTHS[calMonth]} {calYear}</Text>
                                                        <TouchableOpacity onPress={() => { const d = new Date(calYear, calMonth + 1, 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }}>
                                                            <Ionicons name="chevron-forward" size={20} color="#0F172A" />
                                                        </TouchableOpacity>
                                                    </View>
                                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                                        {calCells.map((day, idx) => {
                                                            if (!day) return <View key={`e${idx}`} style={{ width: `${100/7}%`, aspectRatio: 1 }} />;
                                                            const cellDate = new Date(calYear, calMonth, day);
                                                            const isSelected = quickAddDeadline ? cellDate.toDateString() === quickAddDeadline.toDateString() : false;
                                                            return (
                                                                <TouchableOpacity
                                                                    key={day}
                                                                    onPress={() => { cellDate.setHours(12,0,0,0); setQuickAddDeadline(cellDate); setShowCalendar(false); }}
                                                                    style={{ width: `${100/7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}
                                                                >
                                                                    <View style={{ 
                                                                        width: 38, 
                                                                        height: 38, 
                                                                        borderRadius: 19, 
                                                                        backgroundColor: isSelected ? accentColor : 'transparent', 
                                                                        alignItems: 'center', 
                                                                        justifyContent: 'center',
                                                                    }}>
                                                                        <Text style={{ fontSize: 14, fontWeight: isSelected ? '800' : '600', color: isSelected ? '#FFF' : '#0F172A' }}>{day}</Text>
                                                                    </View>
                                                                </TouchableOpacity>
                                                            );
                                                        })}
                                                    </View>
                                                </View>
                                            )}
                                        </View>

                                        {/* Danger Zone */}
                                        <TouchableOpacity 
                                            onPress={() => {
                                                const list = editingGoal.listType === 'goals' ? profile.goals : profile.antigoals;
                                                const filtered = (list || []).filter((g: any) => g.id !== editingGoal.item.id);
                                                updateProfile({ [editingGoal.listType]: filtered });
                                                setEditingGoal(null);
                                            }}
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, marginBottom: 20 }}
                                        >
                                            <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#EF4444' }}>Delete {label}</Text>
                                        </TouchableOpacity>
                                    </ScrollView>

                                    {/* Action Footer */}
                                    <View style={{ flexDirection: 'row', padding: 20, gap: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                                        <TouchableOpacity 
                                            onPress={() => setEditingGoal(null)}
                                            style={{ flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 16, backgroundColor: '#F1F5F9' }}
                                        >
                                            <Text style={{ fontSize: 15, fontWeight: '700', color: '#64748B' }}>CANCEL</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={saveGoalEdit}
                                            disabled={!canSave}
                                            style={{ 
                                                flex: 2, 
                                                paddingVertical: 14, 
                                                alignItems: 'center', 
                                                borderRadius: 16, 
                                                backgroundColor: canSave ? accentColor : '#F1F5F9',
                                                shadowColor: canSave ? accentColor : 'transparent',
                                                shadowOffset: { width: 0, height: 6 },
                                                shadowOpacity: 0.3,
                                                shadowRadius: 10,
                                            }}
                                        >
                                            <Text style={{ fontSize: 15, fontWeight: '800', color: canSave ? '#FFF' : '#94A3B8' }}>SAVE CHANGES</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </KeyboardAvoidingView>
                        </Modal>
                    );
                })()}

                {/* GOAL COMPLETION NOTE MODAL */}
                <Modal 
                    visible={isNoteModalVisible} 
                    transparent 
                    animationType="fade" 
                    onRequestClose={() => setIsNoteModalVisible(false)}
                >
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                        style={{ flex: 1 }}
                    >
                        <TouchableOpacity 
                            style={styles.quickAddBackdrop} 
                            activeOpacity={1} 
                            onPress={() => {
                                setIsNoteModalVisible(false);
                                setPendingGoalAction(null);
                            }}
                        />
                        <View style={styles.premiumNoteTray}>
                            <View style={styles.noteTrayHandle} />
                            <Text style={styles.noteTrayHeader}>{t('profile.congratsReflections')}</Text>
                            
                            <View style={styles.noteInputWrapper}>
                                <TextInput
                                    style={styles.premiumNoteInput}
                                    placeholder={t('profile.addResultNote')}
                                    placeholderTextColor="#94A3B8"
                                    value={goalNoteText}
                                    onChangeText={setGoalNoteText}
                                    autoFocus
                                    multiline
                                />
                                
                                <TouchableOpacity
                                    onPress={() => {
                                        if (pendingGoalAction) {
                                            performToggleCompletion(pendingGoalAction.id, true, pendingGoalAction.listType, goalNoteText);
                                        }
                                        setIsNoteModalVisible(false);
                                        setPendingGoalAction(null);
                                    }}
                                    style={styles.premiumDoneBtn}
                                >
                                    <Ionicons name="arrow-up" size={24} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>
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
        paddingLeft: 6,
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
        marginRight: 12,
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

    pageScroll: { flex: 1 },
    scrollContent: { paddingBottom: 300 },
    headerContainer: { flex: 1 },

    bannerWrapper: {
        marginHorizontal: 16,
        borderRadius: 16,
        overflow: 'hidden',
    },

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
        paddingTop: 16,
    },
    identityRow: {
        flexDirection: 'row',
        alignItems: 'center',
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
        borderColor: '#007AFF',
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
        color: '#007AFF',
        fontWeight: 'bold',
    },

    profileTabContent: {
        paddingTop: 12,
    },
    goalsTabContent: {
        paddingTop: 12,
    },

    quickAddBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        zIndex: 10,
    },
    categorySelectorRow: {
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
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxCompleted: {
        borderWidth: 0,
    },
    sprintsTabContent: {
        paddingTop: 12,
    },
    syncOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    syncModal: {
        backgroundColor: '#FFF',
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    syncText: {
        marginTop: 12,
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
    // Premium Note Tray Styles
    premiumNoteTray: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingTop: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 20,
    },
    noteTrayHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#E2E8F0',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    noteTrayHeader: {
        fontSize: 18,
        fontFamily: 'Inter_900Black',
        color: '#0F172A',
        marginBottom: 16,
        textAlign: 'center',
    },
    noteInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    premiumNoteInput: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
        paddingHorizontal: 20,
        paddingVertical: 14,
        fontSize: 16,
        color: '#1E293B',
        fontFamily: 'Inter_600SemiBold',
        minHeight: 56,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
    },
    premiumDoneBtn: {
        width: 56,
        height: 56,
        borderRadius: 20,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
});
