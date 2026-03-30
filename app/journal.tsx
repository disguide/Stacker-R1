import React, { useState, useRef, useCallback } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    ScrollView, 
    TextInput, 
    Animated,
    Dimensions,
    ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
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
            <Text style={styles.moodLabelText}>MOOD</Text>
            <Animated.View style={{ transform: [{ scale }, { rotate: rotation }] }}>
                <Text style={[styles.moodNumberText, { color: getMoodColor(day.rating) }]}>{`${day.rating}/10`}</Text>
            </Animated.View>
        </TouchableOpacity>
    );
};

export default function JournalScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [logDays, setLogDays] = useState<LogDay[]>([]);
    const [todayData, setTodayData] = useState<LogDay | null>(null);

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
        activeTasks.filter(t => t.completed).forEach(t => {
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
                ...activeTasks.filter(t => t.completed && t.date === date)
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
        const dataToSave = extData || { date: dayDate, updatedAt: new Date().toISOString() };
        dataToSave.isStarred = newStatus;
        dataToSave.updatedAt = new Date().toISOString();
        await StorageService.saveDailyData(dayDate, dataToSave);
    };

    const toggleTaskCompletion = async (taskId: string) => {
        let activeTasks = await StorageService.loadActiveTasks();
        let historyTasks = await StorageService.loadHistory();

        const activeIndex = activeTasks.findIndex(t => t.id === taskId);
        const historyIndex = historyTasks.findIndex(t => t.id === taskId);

        if (activeIndex > -1) {
            // Uncheck if it's sitting locally in active memory
            activeTasks[activeIndex] = { 
                ...activeTasks[activeIndex], 
                completed: false, 
                completedAt: undefined,
                date: toISODateString(new Date()),
                daysRolled: undefined,
                originalDate: undefined
            };
            await StorageService.saveActiveTasks(activeTasks);
        } else if (historyIndex > -1) {
            // Uncheck and move it OUT of history back into active
            const removedTask = await StorageService.removeFromHistory(taskId);
            if (removedTask) {
                const taskToRestore = { 
                    ...removedTask, 
                    completed: false, 
                    completedAt: undefined,
                    date: toISODateString(new Date()),
                    daysRolled: undefined,
                    originalDate: undefined
                };
                activeTasks.push(taskToRestore);
                await StorageService.saveActiveTasks(activeTasks);
            }
        }

        loadData();
    };

    const handleRatingPress = (day: LogDay) => {
        const nextRating = day.rating + 1; // Infinite increment
        const nextStarred = nextRating >= 10 ? true : day.isStarred;

        const newData = { 
            ...day, 
            rating: nextRating, 
            isStarred: nextStarred,
            updatedAt: new Date().toISOString() 
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
        const newData = { ...day, reflection: text, updatedAt: new Date().toISOString() };
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
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={[styles.header, { justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={28} color="#1E293B" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Journal</Text>
                </View>
                <TouchableOpacity 
                    style={styles.vaultButton}
                    onPress={() => router.push('/saved')}
                >
                    <Ionicons name="bookmark" size={24} color="#1E293B" />
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
                    const dateParts = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
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
                                        color={day.isStarred ? "#F59E0B" : "#CBD5E1"} 
                                    />
                                </TouchableOpacity>
                            </View>

                            {/* 2. Reflection Text & Mood */}
                            <View style={[styles.reflectionCard, { marginTop: 0, marginBottom: 24 }]}>
                                <View style={styles.reflectionHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={styles.reflectionTitle}>Reflection</Text>
                                        {day.rating > 0 && (
                                            <TouchableOpacity 
                                                onPress={() => {
                                                    const newData = { ...day, rating: 0, updatedAt: new Date().toISOString() };
                                                    if (todayData?.date === day.date) setTodayData(newData);
                                                    setLogDays(prev => prev.map(d => d.date === day.date ? newData : d));
                                                    StorageService.saveDailyData(day.date, newData);
                                                }}
                                                style={{ padding: 4 }}
                                            >
                                                <Ionicons name="refresh-outline" size={16} color="#94A3B8" />
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
                                    placeholder="Notes for yourself..."
                                    placeholderTextColor="#ABB5C2"
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
                                    <Text style={styles.sectionHeading}>Tasks Completed</Text>
                                    <View style={{ gap: 10 }}>
                                        {day.tasks.map((task) => (
                                            <TouchableOpacity 
                                                key={task.id} 
                                                style={styles.taskItemRow}
                                                onPress={() => toggleTaskCompletion(task.id)}
                                                activeOpacity={0.5}
                                            >
                                                <Ionicons 
                                                    name="checkmark-circle" 
                                                    size={24} 
                                                    color="#10B981" 
                                                />
                                                <Text style={[styles.taskItemText, { color: '#94A3B8' }]} numberOfLines={1}>
                                                    {task.title}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* 4. Sprints Completed */}
                            {day.sprints.length > 0 && (
                                <View style={styles.listSection}>
                                    <Text style={styles.sectionHeading}>Focus Sessions</Text>
                                    <View style={{ gap: 8 }}>
                                    {day.sprints.map((sprint, sIdx) => (
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

                            {day.tasks.length === 0 && day.sprints.length === 0 && !day.reflection && !day.rating && (
                                <View style={{ height: 40 }} />
                            )}
                        </DayWrapper>
                    );
                })}
            </ScrollView>

            {/* Vault moved to a dedicated active screen. */}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF',
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
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1E293B',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    vaultButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F1F5F9',
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
        color: '#1E293B',
        letterSpacing: 0.5,
    },
    starCircleButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    listSection: {
        marginBottom: 24,
    },
    sectionHeading: {
        fontSize: 14,
        fontWeight: '700',
        color: '#94A3B8',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginBottom: 12,
    },
    taskItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    taskItemText: {
        flex: 1,
        fontSize: 16,
        fontFamily: 'Times New Roman',
    },
    sprintItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        gap: 12,
    },
    sprintIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#DBEAFE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sprintItemText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#334155',
    },
    completedSprintDuration: {
        fontSize: 14,
        fontWeight: '700',
        color: '#3B82F6',
    },
    sprintLogNote: {
        fontSize: 13,
        color: '#94A3B8',
        marginTop: 2,
        fontStyle: 'italic',
    },
    reflectionCard: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 20,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
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
        color: '#64748B',
    },
    moodPillSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 16,
        gap: 6,
    },
    moodLabelText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#94A3B8',
        letterSpacing: 1,
    },
    moodNumberText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        fontFamily: 'Georgia',
    },
    reflectionInput: {
        fontSize: 16,
        color: '#475569',
        lineHeight: 24,
        textAlignVertical: 'top',
        minHeight: 80,
        fontFamily: 'Times New Roman',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1E293B',
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
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
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
        color: '#1E293B',
    },
    savedDayContentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    savedDayReflectionText: {
        flex: 1,
        fontSize: 15,
        color: '#475569',
        fontStyle: 'italic',
        lineHeight: 22,
    },
    emptySavedText: {
        fontSize: 16,
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 40,
        fontStyle: 'italic',
    }
});
