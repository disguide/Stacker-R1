import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    ScrollView, 
    TextInput, 
    Animated,
    Dimensions,
    ActivityIndicator,
    Modal
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StorageService, DailyData } from '../src/services/storage';
import { toISODateString } from '../src/utils/dateHelpers';

const { width } = Dimensions.get('window');

export interface LogDay {
    date: string;
    rating: number;
    reflection: string;
    isStarred: boolean;
    tasks: any[];
    sprints: any[];
}

const getMoodColor = (rating: number) => {
    if (rating === 0) return '#94A3B8';
    if (rating >= 100) return '#A855F7'; // Secret prestige color!
    if (rating > 10) return '#EAB308'; // Golden

    // 1 to 10: Smooth Red to Green Gradient
    const gradient = [
        '#EF4444', // 1: Red
        '#F87171', // 2: Light Red
        '#F97316', // 3: Orange
        '#FB923C', // 4: Light Orange
        '#F59E0B', // 5: Amber
        '#FBBF24', // 6: Yellow-Amber
        '#84CC16', // 7: Yellow-Green
        '#A3E635', // 8: Light Lime
        '#34D399', // 9: Light Emerald
        '#10B981', // 10: Emerald/Green
    ];
    return gradient[rating - 1];
};

const MoodCounterButton = ({ day, onPress }: { day: LogDay, onPress: () => void }) => {
    const { t } = useTranslation();
    const scale = useRef(new Animated.Value(1)).current;
    const tilt = useRef(new Animated.Value(0)).current;

    const rotation = tilt.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: ['-15deg', '0deg', '15deg']
    });

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
        <TouchableOpacity 
            style={styles.moodPillSmall}
            onPress={handlePress}
            activeOpacity={0.7}
        >
            <Text style={styles.moodLabelText}>{t('journal.mood')}</Text>
            <Animated.View style={{ transform: [{ scale }, { rotate: rotation }] }}>
                <Text style={[styles.moodNumberText, { color: getMoodColor(day.rating) }]}>{`${day.rating}/10`}</Text>
            </Animated.View>
        </TouchableOpacity>
    );
};

export default function JournalScreen() {
    const { t, i18n } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [logDays, setLogDays] = useState<LogDay[]>([]);
    const [todayData, setTodayData] = useState<LogDay | null>(null);
    const [selectedSprint, setSelectedSprint] = useState<any | null>(null);
    const [savedSprintIds, setSavedSprintIds] = useState<Set<string>>(new Set());
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    // Shared Element Entry Animation
    const entryTranslateY = useRef(new Animated.Value(-25)).current;
    const entryOpacity = useRef(new Animated.Value(0)).current;
    const hasAnimatedEntry = useRef(false);

    const loadData = async (showSpinner = false) => {
        if (showSpinner) setLoading(true);
        const today = toISODateString(new Date());

        // 1. Load All Data Sources
        const allDaily = await StorageService.loadAllDailyData();
        const sprintHistory = await StorageService.loadSprintHistory();
        const taskHistory = await StorageService.loadHistory();
        const activeTasks = await StorageService.loadActiveTasks();
        const savedSprints = await StorageService.loadSavedSprints();
        setSavedSprintIds(new Set(savedSprints.map(s => s.id)));

        // Helper to safely normalize any date value to YYYY-MM-DD
        const normalize = (val: any) => {
            if (!val) return null;
            try {
                // If it's already YYYY-MM-DD, return it
                if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
                return toISODateString(new Date(val));
            } catch (e) {
                return null;
            }
        };

        const getActionDate = (t: any) => {
            if (t.completedAt) return normalize(t.completedAt);
            return normalize(t.date);
        };

        // 2. Identify Unique Dates with Normalization
        const dateSet = new Set<string>();
        allDaily.forEach(d => {
            const n = normalize(d.date);
            if (n) {
                d.date = n; // Normalizing in-place for grouping
                dateSet.add(n);
            }
        });
        sprintHistory.forEach(s => {
            const n = normalize(s.date);
            if (n) {
                s.date = n;
                dateSet.add(n);
            }
        });
        taskHistory.forEach(t => {
            const n = getActionDate(t);
            if (n) {
                t.date = n;
                dateSet.add(n);
            }
        });
        activeTasks.filter(t => t.isCompleted).forEach(t => {
            const n = getActionDate(t);
            if (n) {
                t.date = n;
                dateSet.add(n);
            }
        });
        dateSet.add(today);

        // 3. Group Data by Date
        const grouped: Record<string, LogDay> = {};
        dateSet.forEach(date => {
            const dayDaily = allDaily.find(d => d.date === date);
            const daySprints = sprintHistory.filter(s => s.date === date);
            const dayTasks = [
                ...taskHistory.filter(t => t.date === date),
                ...activeTasks.filter(t => t.isCompleted && t.date === date)
            ];

            // Deduplicate tasks by ID
            const uniqueTaskMap = new Map();
            dayTasks.forEach(t => uniqueTaskMap.set(t.id, t));

            grouped[date] = {
                date,
                rating: dayDaily?.rating || 0,
                reflection: dayDaily?.reflection || '',
                isStarred: dayDaily?.isStarred || false,
                tasks: Array.from(uniqueTaskMap.values()),
                sprints: daySprints
            };
        });

        // 4. Sort and Set
        const sortedDays = Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
        setLogDays(sortedDays);
        setTodayData(grouped[today] || null);
        
        setLoading(false);
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const toggleStar = async (dayDate: string, currentStatus: boolean) => {
        const newStatus = !currentStatus;
        
        // Optimistic UI Update
        setLogDays(prev => prev.map(d => d.date === dayDate ? { ...d, isStarred: newStatus } : d));
        if (todayData?.date === dayDate) {
            setTodayData(prev => prev ? { ...prev, isStarred: newStatus } : null);
        }
        
        // Save to Storage
        const extData = await StorageService.loadDailyData(dayDate);
        const dataToSave = extData || { date: dayDate, updated_at: Date.now() };
        dataToSave.isStarred = newStatus;
        dataToSave.updated_at = Date.now();
        await StorageService.saveDailyData(dayDate, dataToSave);
    };

    const handleDeleteTask = async (taskId: string, dayDate: string) => {
        // Optimistic UI update - remove immediately from view
        setLogDays(prev => prev.map(d =>
            d.date === dayDate
                ? { ...d, tasks: d.tasks.filter(t => t.id !== taskId) }
                : d
        ));
        // Permanently delete from history storage
        await StorageService.removeFromHistory(taskId);
        // Also clean up from active tasks if it's there
        const activeTasks = await StorageService.loadActiveTasks();
        const filtered = activeTasks.filter((t: any) => t.id !== taskId);
        if (filtered.length !== activeTasks.length) {
            await StorageService.saveActiveTasks(filtered);
        }
    };

    const handleDeleteSprint = async (sprintId: string, dayDate: string) => {
        // Optimistic UI update - remove immediately
        setLogDays(prev => prev.map(d =>
            d.date === dayDate
                ? { ...d, sprints: d.sprints.filter((s: any) => s.id !== sprintId) }
                : d
        ));
        // Close modal if this sprint was open
        if (selectedSprint?.id === sprintId) setSelectedSprint(null);
        // Permanently delete from sprint history
        await StorageService.deleteSprintHistory(sprintId);
    };

    const handleToggleSaveSprint = async (sprint: any) => {
        if (!sprint.id) return;
        const isSaved = savedSprintIds.has(sprint.id);
        const newSavedIds = new Set(savedSprintIds);
        
        if (isSaved) {
            newSavedIds.delete(sprint.id);
            await StorageService.deleteSavedSprint(sprint.id);
            setToastMessage(null);
        } else {
            newSavedIds.add(sprint.id);
            await StorageService.saveSavedSprint(sprint);
            setToastMessage(t('journal.savedToast'));
            setTimeout(() => setToastMessage(null), 2500);
        }
        setSavedSprintIds(newSavedIds);
    };

    const toggleTaskCompletion = async (taskId: string, dayDate: string) => {
        let activeTasks = await StorageService.loadActiveTasks();
        
        // 1. Resolve master ID in case it's a recurring ghost task
        let masterId = taskId;
        if (taskId.includes('_')) {
            const parts = taskId.split('_');
            if (parts[parts.length - 1].match(/^\d{4}-\d{2}-\d{2}$/)) {
                masterId = parts.slice(0, parts.length - 1).join('_');
            }
        }

        const activeIndex = activeTasks.findIndex(t => t.id === masterId);

        if (activeIndex > -1) {
            // Task still exists in active memory (Standard or Recurring)
            const task = activeTasks[activeIndex];
            if (task.completedDates) {
                task.completedDates = task.completedDates.filter((d: string) => d !== dayDate);
            }
            // Clear legacy single-completion fields
            task.isCompleted = false;
            task.completedAt = undefined;
            // DONT change its original date string so it returns to its scheduled slot
            } else {
            // Task was physically deleted from active memory and only exists in history
            const removedTask = await StorageService.removeFromHistory(taskId);
            if (removedTask) {
                const taskToRestore = {
                    ...removedTask,
                    id: masterId,
                    isCompleted: false,
                    completedAt: undefined
                };                if (taskToRestore.completedDates) {
                    taskToRestore.completedDates = taskToRestore.completedDates.filter((d: string) => d !== dayDate);
                }
                activeTasks.push(taskToRestore);
            }
        }

        // Clean up history and save!
        await StorageService.saveActiveTasks(activeTasks);
        await StorageService.removeFromHistory(taskId);

        loadData();
    };

    const handleRatingPress = (day: LogDay) => {
        const nextRating = day.rating + 1; // Infinite increment
        const nextStarred = nextRating >= 10 ? true : day.isStarred;

        const newData = { 
            ...day, 
            rating: nextRating, 
            isStarred: nextStarred,
            updated_at: Date.now() 
        };
        
        // Update local state for immediate feedback
        setLogDays(prev => prev.map(d => d.date === day.date ? newData : d));
        if (todayData?.date === day.date) {
            setTodayData(newData);
        }
        
        // Persist
        StorageService.saveDailyData(day.date, newData);
    };

    const handleUpdateReflection = (day: LogDay, text: string) => {
        const newData = { ...day, reflection: text, updated_at: Date.now() };
        setLogDays(prev => prev.map(d => d.date === day.date ? newData : d));
        if (todayData?.date === day.date) setTodayData(newData);
        StorageService.saveDailyData(day.date, newData);
    };

    const getDayCounter = (dateStr: string) => {
        const today = new Date();
        today.setHours(0,0,0,0);
        const [y, m, d] = dateStr.split('-').map(Number);
        const target = new Date(y, m - 1, d);
        target.setHours(0,0,0,0);
        
        const diffTime = target.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return '-0D';
        return `${diffDays}D`; // Will already include '-' for negative (past) days
    };

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: '#F9F7F2' }]}>
                <ActivityIndicator size="large" color="#C19A6B" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={[styles.header, { justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={28} color="#3E362E" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('journal.title')}</Text>
                </View>
                <TouchableOpacity 
                    style={styles.vaultButton}
                    onPress={() => router.push('/saved')}
                >
                    <Ionicons name="bookmark" size={24} color="#3E362E" />
                </TouchableOpacity>
            </View>

            <ScrollView 
                style={styles.content} 
                contentContainerStyle={{ paddingBottom: 220 }}
                showsVerticalScrollIndicator={false}
            >
                {logDays.map((day, dayIndex) => {
                    const isToday = day.date === toISODateString(new Date());
                    const [y, m, d] = day.date.split('-').map(Number);
                    const dateObj = new Date(y, m - 1, d);
                    const dateParts = dateObj.toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' });
                    const formattedTitle = `${dateParts} ${getDayCounter(day.date).toUpperCase()}`;

                    // Entry animation only for the first day block
                    const isFirstBlock = dayIndex === 0;
                    if (isFirstBlock && !hasAnimatedEntry.current) {
                        hasAnimatedEntry.current = true;
                        Animated.parallel([
                            Animated.spring(entryTranslateY, { toValue: 0, useNativeDriver: true, friction: 8, tension: 50 }),
                            Animated.timing(entryOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
                        ]).start();
                    }

                    const DayWrapper = isFirstBlock ? Animated.View : View;
                    const dayWrapperStyle = isFirstBlock
                        ? [styles.logDayBlock, { transform: [{ translateY: entryTranslateY }], opacity: entryOpacity }]
                        : [styles.logDayBlock];

                    return (
                        <DayWrapper key={day.date} style={dayWrapperStyle}>
                            {/* 1. Day Header */}
                            <View style={styles.dayHeaderRow}>
                                <Text style={styles.dayTitleText}>{formattedTitle}</Text>
                                <TouchableOpacity 
                                    onPress={() => toggleStar(day.date, day.isStarred)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    style={styles.starCircleButton}
                                >
                                    <Ionicons 
                                        name={"star"} 
                                        size={20} 
                                        color={day.isStarred ? "#F59E0B" : "#E8E2D8"} 
                                    />
                                </TouchableOpacity>
                            </View>

                            {/* 2. Reflection Text & Mood */}
                            <View style={[styles.reflectionCard, { marginTop: 0, marginBottom: 24 }]}>
                                <View style={styles.reflectionHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={styles.reflectionTitle}>{t('journal.reflection')}</Text>
                                        {day.rating > 0 && (
                                            <TouchableOpacity 
                                                onPress={() => {
                                                    const newData = { ...day, rating: 0, updated_at: Date.now() };
                                                    if (todayData?.date === day.date) setTodayData(newData);
                                                    setLogDays(prev => prev.map(d => d.date === day.date ? newData : d));
                                                    StorageService.saveDailyData(day.date, newData);
                                                }}
                                                style={{ padding: 4 }}
                                            >
                                                <Ionicons name="refresh-outline" size={16} color="#8C7E6E" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    <MoodCounterButton 
                                        day={day} 
                                        onPress={() => handleRatingPress(day)} 
                                    />
                                </View>
                                <TextInput
                                    style={styles.reflectionInput}
                                    placeholder={t('journal.notesPlaceholder')}
                                    placeholderTextColor="#C4B7A6"
                                    multiline
                                    scrollEnabled={false}
                                    value={day.reflection}
                                    onChangeText={(text) => handleUpdateReflection(day, text)}
                                    onBlur={() => {
                                        if (day.reflection && day.reflection.trim() !== day.reflection) {
                                            handleUpdateReflection(day, day.reflection.trim());
                                        }
                                    }}
                                />
                            </View>

                            {/* 3. Tasks Completed (All tasks) */}
                            {day.tasks.length > 0 && (
                                <View style={styles.listSection}>
                                    <Text style={styles.sectionHeading}>{t('journal.tasksCompleted')}</Text>
                                    <View style={{ gap: 10 }}>
                                        {day.tasks.map((task) => (
                                            <View key={task.id} style={styles.taskItemRow}>
                                                <TouchableOpacity
                                                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                                                    onPress={() => toggleTaskCompletion(task.id, day.date)}
                                                    activeOpacity={0.5}
                                                >
                                                    <Ionicons 
                                                        name="checkmark-circle" 
                                                        size={24} 
                                                        color="#84CC16" 
                                                    />
                                                    <Text style={[styles.taskItemText, { color: '#8C7E6E' }]} numberOfLines={1}>
                                                        {task.title}
                                                    </Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => handleDeleteTask(task.id, day.date)}
                                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                    style={styles.rowDeleteBtn}
                                                >
                                                    <Ionicons name="trash-outline" size={16} color="#C4B7A6" />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* 4. Sprints Completed */}
                            {day.sprints.length > 0 && (
                                <View style={styles.listSection}>
                                    <Text style={styles.sectionHeading}>{t('journal.focusSessions')}</Text>
                                    <View style={{ gap: 8 }}>
                                    {day.sprints.map((sprint, sIdx) => (
                                        <View key={sprint.id || sIdx} style={styles.sprintItemRow}>
                                            <TouchableOpacity
                                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                                                activeOpacity={0.7}
                                                onPress={() => setSelectedSprint(sprint)}
                                            >
                                                <View style={styles.sprintIconWrap}>
                                                    <Ionicons name="flash-outline" size={16} color="#C19A6B" />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.sprintItemText} numberOfLines={1}>{sprint.primaryTask || t('journal.defaultFocusTitle')}</Text>
                                                    {sprint.note && <Text style={styles.sprintLogNote}>"{sprint.note}"</Text>}
                                                </View>
                                                <Text style={styles.completedSprintDuration}>{Math.floor((sprint.durationSeconds || 0) / 60)}m</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleDeleteSprint(sprint.id, day.date)}
                                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                style={styles.rowDeleteBtn}
                                            >
                                                <Ionicons name="trash-outline" size={16} color="#C4B7A6" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                    </View>
                                </View>
                            )}

                            {day.tasks.length === 0 && day.sprints.length === 0 && !day.reflection && !day.rating && (
                                <View style={{ height: 40 }} />
                            )}
                        </DayWrapper>
                    );
                })}
            </ScrollView>

            {/* Vault moved to a dedicated active screen. */}

            {/* Selected Sprint Modal - Floating Tab format */}
            {selectedSprint && (
                <View style={[styles.modalBackdrop, StyleSheet.absoluteFillObject]}>
                    <TouchableOpacity style={styles.modalDismissArea} activeOpacity={1} onPress={() => setSelectedSprint(null)} />
                    <View style={styles.sprintModalContent}>
                        <View style={styles.sprintModalHeader}>
                            <TouchableOpacity 
                                style={[styles.sprintModalIconBox, savedSprintIds.has(selectedSprint?.id || '') && { backgroundColor: '#FEF3C7' }]}
                                activeOpacity={0.7}
                                onPress={() => handleToggleSaveSprint(selectedSprint)}
                            >
                                <Ionicons 
                                    name={savedSprintIds.has(selectedSprint?.id || '') ? "flash" : "flash-outline"} 
                                    size={24} 
                                    color={savedSprintIds.has(selectedSprint?.id || '') ? "#F59E0B" : "#94A3B8"} 
                                />
                            </TouchableOpacity>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity 
                                    onPress={() => selectedSprint && handleDeleteSprint(selectedSprint.id, selectedSprint.date)}
                                    style={[styles.sprintCloseBtn, { backgroundColor: '#FEF2F2' }]}
                                >
                                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setSelectedSprint(null)} style={styles.sprintCloseBtn}>
                                    <Ionicons name="close" size={24} color="#94A3B8" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <ScrollView style={{maxHeight: Dimensions.get('window').height * 0.6}} showsVerticalScrollIndicator={false}>
                            <Text style={styles.sprintModalDate}>
                                {new Date(selectedSprint.date).toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                            </Text>
                            <Text style={styles.sprintModalTitle}>{selectedSprint.primaryTask || t('journal.defaultFocusTitle')}</Text>
                            
                            <View style={styles.sprintModalStatsRow}>
                                <View style={styles.sprintModalStatBox}>
                                    <Ionicons name="time-outline" size={18} color="#3B82F6" />
                                    <Text style={styles.sprintModalStatLabel}>{formatDuration(selectedSprint.durationSeconds)}</Text>
                                </View>
                                {selectedSprint.taskCount ? (
                                    <View style={styles.sprintModalStatBox}>
                                        <Ionicons name="checkmark-done" size={18} color="#10B981" />
                                        <Text style={[styles.sprintModalStatLabel, { color: '#10B981' }]}>{selectedSprint.taskCount} {t('journal.tasks')}</Text>
                                    </View>
                                ) : null}
                            </View>

                            {selectedSprint.note ? (
                                <View style={styles.sprintModalNoteBox}>
                                    <Text style={styles.sprintModalNoteLabel}>{t('journal.sessionNote')}</Text>
                                    <Text style={styles.sprintModalNoteText}>"{selectedSprint.note}"</Text>
                                </View>
                            ) : null}

                            {selectedSprint.timelineEvents && selectedSprint.timelineEvents.length > 0 && (
                                <View style={styles.sprintModalTimeline}>
                                    <Text style={styles.sprintModalNoteLabel}>{t('journal.timeline')}</Text>
                                    {selectedSprint.timelineEvents.map((evt: any, i: number, arr: any[]) => (
                                        <View key={i} style={styles.sprintTimelineRow}>
                                            <View style={styles.sprintTimelineVisuals}>
                                                <View style={[styles.sprintTimelineDot, { backgroundColor: evt.type === 'break' ? '#10B981' : '#3B82F6' }]} />
                                                {i < arr.length - 1 && <View style={styles.sprintTimelineLine} />}
                                            </View>
                                            <View style={styles.sprintTimelineEventContent}>
                                                <Text style={styles.sprintTimelineEventText} numberOfLines={1}>{evt.title}</Text>
                                                <Text style={styles.sprintTimelineEventDuration}>{formatDuration(evt.durationSeconds)}</Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </ScrollView>
                    </View>
                    {toastMessage && (
                        <View style={styles.sprintToast}>
                            <Text style={styles.sprintToastText}>{toastMessage}</Text>
                        </View>
                    )}
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9F7F2',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F2F0E9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#3E362E',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    vaultButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F2F0E9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logDayBlock: {
        marginBottom: 40,
    },
    dayHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 16,
    },
    dayTitleText: {
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'Georgia',
        color: '#000000',
        letterSpacing: 0.5,
    },
    starCircleButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F2F0E9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    listSection: {
        marginBottom: 24,
    },
    sectionHeading: {
        fontSize: 14,
        fontWeight: '700',
        color: '#8C7E6E',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 12,
    },
    taskItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 0,
    },
    rowDeleteBtn: {
        padding: 6,
        marginLeft: 4,
    },
    taskItemText: {
        flex: 1,
        fontSize: 16,
        fontFamily: 'Times New Roman',
    },
    sprintItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F2F0E9',
        paddingVertical: 10,
        paddingLeft: 12,
        paddingRight: 8,
        borderRadius: 12,
        gap: 4,
    },
    sprintIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#E8E2D8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sprintItemText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#3E362E',
    },
    completedSprintDuration: {
        fontSize: 14,
        fontWeight: '700',
        color: '#C19A6B',
    },
    sprintLogNote: {
        fontSize: 13,
        color: '#8C7E6E',
        marginTop: 2,
        fontStyle: 'italic',
    },
    reflectionCard: {
        backgroundColor: '#FFFDF5',
        borderRadius: 16,
        padding: 20,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#E8E2D8',
        shadowColor: '#3E362E',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    reflectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    reflectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: 'Georgia',
        color: '#8C7E6E',
    },
    moodPillSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F2F0E9',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 16,
        gap: 6,
    },
    moodLabelText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#8C7E6E',
        letterSpacing: 1,
    },
    moodNumberText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#3E362E',
        fontFamily: 'Georgia',
    },
    reflectionInput: {
        fontSize: 16,
        color: '#3E362E',
        lineHeight: 24,
        textAlignVertical: 'top',
        minHeight: 80,
        fontFamily: 'Times New Roman',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#F9F7F2',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#FFFDF5',
        borderBottomWidth: 1,
        borderBottomColor: '#E8E2D8',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#3E362E',
        fontFamily: 'Georgia',
    },
    modalCloseButton: {
        padding: 4,
    },
    modalContent: {
        flex: 1,
        padding: 16,
    },
    savedDayCard: {
        backgroundColor: '#FFFDF5',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E8E2D8',
        shadowColor: '#3E362E',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    savedDayHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    savedDayDate: {
        fontSize: 16,
        fontWeight: '700',
        color: '#3E362E',
    },
    savedDayContentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    savedDayReflectionText: {
        flex: 1,
        fontSize: 15,
        color: '#3E362E',
        fontStyle: 'italic',
        lineHeight: 22,
    },
    emptySavedText: {
        fontSize: 16,
        color: '#8C7E6E',
        textAlign: 'center',
        marginTop: 40,
        fontStyle: 'italic',
    },

    // Sprint Floating Modal Styles inside Journal
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
    sprintModalContent: {
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
    sprintModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    sprintModalIconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sprintCloseBtn: {
        padding: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
    },
    sprintModalDate: {
        fontSize: 13,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    sprintModalTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0F172A',
        lineHeight: 30,
        marginBottom: 20,
    },
    sprintModalStatsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    sprintModalStatBox: {
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
    sprintModalStatLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#3B82F6',
    },
    sprintModalNoteBox: {
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 24,
    },
    sprintModalNoteLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 1,
        marginBottom: 8,
    },
    sprintModalNoteText: {
        fontSize: 15,
        color: '#1E293B',
        fontStyle: 'italic',
        lineHeight: 22,
    },
    sprintModalTimeline: {
        marginTop: 8,
    },
    sprintTimelineRow: {
        flexDirection: 'row',
        minHeight: 40,
    },
    sprintTimelineVisuals: {
        width: 16,
        alignItems: 'center',
        marginRight: 12,
    },
    sprintTimelineDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 4,
        zIndex: 2,
    },
    sprintTimelineLine: {
        width: 2,
        flex: 1,
        backgroundColor: '#E2E8F0',
        marginTop: 4,
        marginBottom: -4,
        zIndex: 1,
    },
    sprintTimelineEventContent: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 16,
    },
    sprintTimelineEventText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1E293B',
        flex: 1,
        marginRight: 8,
    },
    sprintTimelineEventDuration: {
        fontSize: 13,
        color: '#64748B',
        fontWeight: 'bold',
    },
    sprintToast: {
        position: 'absolute',
        bottom: 40,
        backgroundColor: '#3E362E',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 6,
    },
    sprintToastText: {
        color: '#FFFDF5',
        fontSize: 14,
        fontWeight: '700',
    }
});
