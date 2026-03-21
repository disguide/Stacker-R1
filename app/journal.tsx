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
    tasks: any[];
    sprints: any[];
}

export default function JournalScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [logDays, setLogDays] = useState<LogDay[]>([]);
    const [todayData, setTodayData] = useState<LogDay | null>(null);

    // Animations
    const ratingScale = useRef(new Animated.Value(1)).current;
    const ratingTilt = useRef(new Animated.Value(0)).current;

    const loadData = async () => {
        setLoading(true);
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
            const n = normalize(t.date);
            if (n) {
                t.date = n;
                dateSet.add(n);
            }
        });
        activeTasks.filter(t => t.completed).forEach(t => {
            const n = normalize(t.date);
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

    const toggleTaskCompletion = async (taskId: string) => {
        const allTasks = await StorageService.loadActiveTasks();
        const updated = allTasks.map(t => {
            if (t.id === taskId) {
                const isCompleted = !t.completed;
                return { 
                    ...t, 
                    completed: isCompleted,
                    completedAt: isCompleted ? new Date().toISOString() : undefined 
                };
            }
            return t;
        });
        await StorageService.saveActiveTasks(updated);
        loadData();
    };

    const handleRatingPress = () => {
        if (!todayData) return;
        const nextRating = (todayData.rating % 10) + 1;
        const newData = { ...todayData, rating: nextRating, updatedAt: new Date().toISOString() };
        
        // Update local state for immediate feedback
        setTodayData(newData);
        setLogDays(prev => prev.map(d => d.date === todayData.date ? newData : d));
        
        // Persist
        StorageService.saveDailyData(todayData.date, newData);

        // Physics Animation
        Animated.sequence([
            Animated.parallel([
                Animated.spring(ratingScale, { toValue: 1.4, useNativeDriver: true, friction: 3 }),
                Animated.spring(ratingTilt, { toValue: 1, useNativeDriver: true, friction: 3 })
            ]),
            Animated.parallel([
                Animated.spring(ratingScale, { toValue: 1, useNativeDriver: true, friction: 5 }),
                Animated.spring(ratingTilt, { toValue: 0, useNativeDriver: true, friction: 5 })
            ])
        ]).start();
    };

    const handleUpdateReflection = (text: string) => {
        if (!todayData) return;
        const newData = { ...todayData, reflection: text, updatedAt: new Date().toISOString() };
        setTodayData(newData);
        setLogDays(prev => prev.map(d => d.date === todayData.date ? newData : d));
        StorageService.saveDailyData(todayData.date, newData);
    };

    const rotation = ratingTilt.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '15deg']
    });

    const getDayCounter = (dateStr: string) => {
        const today = new Date();
        today.setHours(0,0,0,0);
        const target = new Date(dateStr);
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
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Journal</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView 
                style={styles.content} 
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                {logDays.map((day) => {
                    const isToday = day.date === toISODateString(new Date());
                    const dateObj = new Date(day.date);
                    // Standard locale string gives 'Wednesday, March 18'
                    const dateParts = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                    const formattedTitle = `${dateParts} ${getDayCounter(day.date).toUpperCase()}`;

                    return (
                        <View key={day.date} style={styles.logDayBlock}>
                            <View style={styles.dateSeparatorHeader}>
                                <View style={styles.fullBlackLine} />
                                <Text style={styles.dateSeparatorText}>{formattedTitle}</Text>
                                <View style={styles.fullBlackLine} />
                            </View>

                            {/* Daily Insight Section */}
                            <View style={styles.dayInsightRow}>
                                {isToday ? (
                                    <View style={styles.todayInsightLayout}>
                                        <View style={styles.ratingSection}>
                                            {day.rating > 0 && (
                                                <TouchableOpacity 
                                                    style={styles.ratingReset}
                                                    onPress={() => {
                                                        const newData = { ...day, rating: 0, updatedAt: new Date().toISOString() };
                                                        setTodayData(newData);
                                                        setLogDays(prev => prev.map(d => d.date === day.date ? newData : d));
                                                        StorageService.saveDailyData(day.date, newData);
                                                    }}
                                                >
                                                    <Ionicons name="refresh-outline" size={16} color="#64748B" />
                                                </TouchableOpacity>
                                            )}
                                            <Animated.View style={{ transform: [{ scale: ratingScale }, { rotate: rotation }] }}>
                                                <TouchableOpacity 
                                                    style={styles.ratingButton}
                                                    onPress={handleRatingPress}
                                                    activeOpacity={0.7}
                                                >
                                                    <Ionicons name="star" size={24} color="#F59E0B" />
                                                    <Text style={styles.ratingText}>{day.rating || 0}</Text>
                                                </TouchableOpacity>
                                            </Animated.View>
                                        </View>
                                        <View style={styles.reflectionContainer}>
                                            <TextInput
                                                style={styles.reflectionInput}
                                                placeholder="What did you achieve today?"
                                                placeholderTextColor="#94A3B8"
                                                multiline
                                                value={day.reflection}
                                                onChangeText={handleUpdateReflection}
                                            />
                                        </View>
                                    </View>
                                ) : (
                                    <View style={styles.historicalInsightLayout}>
                                        <View style={styles.historicalHeader}>
                                            <View style={styles.miniRating}>
                                                <Ionicons name="star" size={14} color="#F59E0B" />
                                                <Text style={styles.miniRatingText}>{day.rating || '-'}</Text>
                                            </View>
                                            {day.reflection ? (
                                                <Text style={styles.historicalReflection}>"{day.reflection}"</Text>
                                            ) : null}
                                        </View>
                                    </View>
                                )}
                            </View>

                            {/* Unified Activity List (Tasks & Sprints) */}
                            <View style={styles.activityList}>
                                {day.tasks.map((task) => (
                                    <TouchableOpacity 
                                        key={task.id} 
                                        style={styles.taskItem}
                                        onPress={() => isToday && toggleTaskCompletion(task.id)}
                                        activeOpacity={isToday ? 0.7 : 1}
                                    >
                                        <Ionicons 
                                            name="checkmark-circle" 
                                            size={22} 
                                            color={task.color || '#10B981'} 
                                        />
                                        <Text style={styles.taskText} numberOfLines={1}>{task.title}</Text>
                                        {task.estimatedTime && <Text style={styles.taskTime}>{task.estimatedTime}m</Text>}
                                    </TouchableOpacity>
                                ))}

                                {day.sprints.map((sprint, sIdx) => (
                                    <View key={sprint.id || sIdx} style={styles.sprintLogCard}>
                                        <View style={styles.sprintLogHeader}>
                                            <Ionicons name="flash" size={16} color="#3B82F6" />
                                            <Text style={styles.sprintLogTitle} numberOfLines={1}>{sprint.primaryTask || 'Focus Session'}</Text>
                                            <Text style={styles.sprintLogDuration}>{Math.floor((sprint.durationSeconds || 0) / 60)}m</Text>
                                        </View>
                                        {sprint.note && <Text style={styles.sprintLogNote}>"{sprint.note}"</Text>}
                                    </View>
                                ))}

                                {day.tasks.length === 0 && day.sprints.length === 0 && !day.reflection && !day.rating && (
                                    <Text style={styles.quietDayText}>A quiet day...</Text>
                                )}
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
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
    dateSeparatorHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 10,
        gap: 12,
    },
    fullBlackLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#000',
    },
    dateSeparatorText: {
        fontSize: 15,
        fontWeight: '400', 
        color: '#000',
        letterSpacing: 0.5,
    },
    logDayBlock: {
        marginBottom: 40,
    },
    dayInsightRow: {
        marginVertical: 16,
    },
    todayInsightLayout: {
        gap: 16,
    },
    historicalInsightLayout: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    historicalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    miniRating: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FFF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    miniRatingText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#F59E0B',
    },
    historicalReflection: {
        flex: 1,
        fontSize: 14,
        color: '#64748B',
        fontStyle: 'italic',
    },
    activityList: {
        gap: 8,
    },
    ratingSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    ratingButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FFF',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#F59E0B',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    ratingText: {
        fontSize: 18,
        fontWeight: '900',
        color: '#F59E0B',
    },
    ratingReset: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    reflectionContainer: {
        backgroundColor: '#F8FAFC',
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        minHeight: 120,
    },
    reflectionInput: {
        fontSize: 16,
        color: '#1E293B',
        lineHeight: 24,
        textAlignVertical: 'top',
    },
    taskItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        gap: 12,
    },
    taskText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: '#1E293B',
    },
    taskTime: {
        fontSize: 13,
        fontWeight: '700',
        color: '#94A3B8',
    },
    sprintLogCard: {
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    sprintLogHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sprintLogTitle: {
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
        color: '#1E293B',
    },
    sprintLogDuration: {
        fontSize: 12,
        fontWeight: '800',
        color: '#3B82F6',
    },
    sprintLogNote: {
        fontSize: 13,
        color: '#64748B',
        marginTop: 4,
        fontStyle: 'italic',
    },
    quietDayText: {
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 8,
    },
    dot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#CBD5E1',
    }
});
