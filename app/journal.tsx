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

export default function JournalScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [logDays, setLogDays] = useState<LogDay[]>([]);
    const [todayData, setTodayData] = useState<LogDay | null>(null);
    const [isSavedModalVisible, setIsSavedModalVisible] = useState(false);

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
        const nextRating = todayData.rating + 1;
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
                    style={styles.filterToggle}
                    onPress={() => setIsSavedModalVisible(true)}
                >
                    <Ionicons name="bookmark" size={16} color="#475569" />
                    <Text style={styles.filterText}>Saved Days</Text>
                </TouchableOpacity>
            </View>

            <ScrollView 
                style={styles.content} 
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                {logDays.map((day) => {
                    const isToday = day.date === toISODateString(new Date());
                    const [y, m, d] = day.date.split('-').map(Number);
                    const dateObj = new Date(y, m - 1, d);
                    // Standard locale string gives 'Wednesday, March 18'
                    const dateParts = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                    const formattedTitle = isToday 
                        ? `TODAY ${getDayCounter(day.date).toUpperCase()}`
                        : `${dateParts} ${getDayCounter(day.date).toUpperCase()}`;

                    return (
                        <View key={day.date} style={styles.logDayBlock}>
                            {/* Date Header */}
                            <View style={styles.dateSeparatorHeader}>
                                <View style={styles.fullBlackLine} />
                                <Text style={styles.dateSeparatorText}>{formattedTitle}</Text>
                                <View style={styles.fullBlackLine} />
                            </View>

                            {/* Mood and Star Row */}
                            <View style={styles.moodAndStarRow}>
                                {isToday ? (
                                    <View style={styles.moodPill}>
                                        <TouchableOpacity 
                                            onPress={handleRatingPress}
                                            activeOpacity={0.7}
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                                        >
                                            <Text style={styles.moodLabelText}>MOOD</Text>
                                            <Animated.View style={{ transform: [{ scale: ratingScale }, { rotate: rotation }] }}>
                                                <Text style={styles.moodNumberText}>{day.rating || 0}</Text>
                                            </Animated.View>
                                        </TouchableOpacity>
                                        {day.rating > 0 && (
                                            <TouchableOpacity 
                                                onPress={() => {
                                                    const newData = { ...day, rating: 0, updatedAt: new Date().toISOString() };
                                                    setTodayData(newData);
                                                    setLogDays(prev => prev.map(d => d.date === day.date ? newData : d));
                                                    StorageService.saveDailyData(day.date, newData);
                                                }}
                                                style={{ marginLeft: 6, padding: 4 }}
                                                hitSlop={{ top: 15, bottom: 15, left: 10, right: 10 }}
                                            >
                                                <Ionicons name="refresh-outline" size={16} color="#94A3B8" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ) : (
                                    <View style={styles.moodPill}>
                                        <Text style={styles.moodLabelText}>MOOD</Text>
                                        <Text style={styles.moodNumberText}>{day.rating || 0}</Text>
                                    </View>
                                )}

                                <TouchableOpacity 
                                    style={styles.starCircleButton}
                                    onPress={() => toggleStar(day.date, day.isStarred)}
                                >
                                    <Ionicons 
                                        name={day.isStarred ? "star" : "star"} 
                                        size={18} 
                                        color={day.isStarred ? "#333" : "#CBD5E1"} 
                                    />
                                </TouchableOpacity>
                            </View>

                            {/* Reflection Section */}
                            <View style={styles.reflectionSection}>
                                {isToday ? (
                                    <TextInput
                                        style={styles.reflectionInputMode}
                                        placeholder="What's on your mind today?"
                                        placeholderTextColor="#ABB5C2"
                                        multiline
                                        value={day.reflection}
                                        onChangeText={handleUpdateReflection}
                                    />
                                ) : (
                                    <Text style={[styles.reflectionInputMode, !day.reflection && { color: '#ABB5C2' }]}>
                                        {day.reflection || "What's on your mind today?"}
                                    </Text>
                                )}
                            </View>

                            {/* Completed Tasks Group Card */}
                            {day.tasks.length > 0 && (
                                <View style={styles.completedTasksGroupCard}>
                                    <View style={styles.completedTasksHeaderRow}>
                                        <Text style={styles.completedTasksTitle}>Completed Tasks</Text>
                                        <View style={styles.itemsPill}>
                                            <Text style={styles.itemsPillText}>{day.tasks.length} {day.tasks.length === 1 ? 'Item' : 'Items'}</Text>
                                        </View>
                                    </View>

                                    {day.tasks.map((task) => (
                                        <View key={task.id} style={styles.completedTaskRow}>
                                            <TouchableOpacity 
                                                onPress={() => isToday && toggleTaskCompletion(task.id)}
                                                disabled={!isToday}
                                                activeOpacity={0.5}
                                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            >
                                                <Ionicons 
                                                    name="checkmark-circle" 
                                                    size={22} 
                                                    color={isToday ? "#10B981" : "#A7F3D0"} 
                                                />
                                            </TouchableOpacity>
                                            <Text style={[styles.completedTaskText, { textDecorationLine: 'line-through', color: '#94A3B8' }]} numberOfLines={1}>
                                                {task.title}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Completed Sprints (appended below tasks in similar grouped style if any) */}
                            {day.sprints.length > 0 && (
                                <View style={styles.completedTasksGroupCard}>
                                    <View style={styles.completedTasksHeaderRow}>
                                        <Text style={styles.completedTasksTitle}>Focus Sessions</Text>
                                        <View style={styles.itemsPill}>
                                            <Text style={styles.itemsPillText}>{day.sprints.length} {day.sprints.length === 1 ? 'Session' : 'Sessions'}</Text>
                                        </View>
                                    </View>

                                    {day.sprints.map((sprint, sIdx) => (
                                        <View key={sprint.id || sIdx} style={styles.completedSprintRow}>
                                            <Ionicons name="flash-outline" size={18} color="#3B82F6" />
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.completedTaskText, { color: '#64748B' }]} numberOfLines={1}>{sprint.primaryTask || 'Focus Session'}</Text>
                                                {sprint.note && <Text style={styles.sprintLogNote}>"{sprint.note}"</Text>}
                                            </View>
                                            <Text style={styles.completedSprintDuration}>{Math.floor((sprint.durationSeconds || 0) / 60)}m</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {day.tasks.length === 0 && day.sprints.length === 0 && !day.reflection && !day.rating && (
                                <View style={{ height: 40 }} />
                            )}
                        </View>
                    );
                })}
            </ScrollView>

            {/* Saved Days Modal */}
            <Modal
                visible={isSavedModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setIsSavedModalVisible(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Saved Days</Text>
                        <TouchableOpacity onPress={() => setIsSavedModalVisible(false)} style={styles.modalCloseButton}>
                            <Ionicons name="close" size={24} color="#1E293B" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                        {logDays.filter(d => d.isStarred).map(day => {
                            const [y, m, dNum] = day.date.split('-').map(Number);
                            const dateObj = new Date(y, m - 1, dNum);
                            const dateParts = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
                            return (
                                <View key={day.date} style={styles.savedDayCard}>
                                    <View style={styles.savedDayHeader}>
                                         <Text style={styles.savedDayDate}>{dateParts}</Text>
                                         <TouchableOpacity onPress={() => toggleStar(day.date, true)}>
                                             <Ionicons name="star" size={20} color="#333" />
                                         </TouchableOpacity>
                                    </View>
                                    <View style={styles.savedDayContentRow}>
                                         <View style={[styles.moodPill, { paddingVertical: 4, paddingHorizontal: 12 }]}>
                                             <Text style={styles.moodLabelText}>MOOD</Text>
                                             <Text style={styles.moodNumberText}>{day.rating || 0}</Text>
                                         </View>
                                         <Text style={styles.savedDayReflectionText} numberOfLines={2}>
                                             {day.reflection || "A quiet day..."}
                                         </Text>
                                    </View>
                                </View>
                            );
                        })}
                        {logDays.filter(d => d.isStarred).length === 0 && (
                            <Text style={styles.emptySavedText}>You haven't saved any days yet.</Text>
                        )}
                    </ScrollView>
                </SafeAreaView>
            </Modal>
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
        height: 2, // Darker/thicker line
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
    moodAndStarRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 16,
    },
    moodPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 24,
        gap: 8,
    },
    moodLabelText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94A3B8',
        letterSpacing: 1,
    },
    moodNumberText: {
        fontSize: 20,
        fontWeight: '500',
        color: '#333',
        fontFamily: 'Georgia',
    },
    starCircleButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
    },
    reflectionSection: {
        marginBottom: 24,
    },
    reflectionInputMode: {
        fontSize: 20,
        color: '#333',
        lineHeight: 28,
        textAlignVertical: 'top',
        minHeight: 40,
    },
    completedTasksGroupCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
    },
    completedTasksHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    completedTasksTitle: {
        fontSize: 18,
        color: '#333',
        fontFamily: 'Georgia',
    },
    itemsPill: {
        backgroundColor: '#DBEAFE',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    itemsPillText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#3B82F6',
    },
    completedTaskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    completedTaskText: {
        flex: 1,
        fontSize: 16,
    },
    completedSprintRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 12,
        backgroundColor: '#FFF',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    completedSprintDuration: {
        fontSize: 14,
        fontWeight: '600',
        color: '#3B82F6',
    },
    sprintLogNote: {
        fontSize: 13,
        color: '#94A3B8',
        marginTop: 4,
        fontStyle: 'italic',
    },
    dot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#CBD5E1',
    },
    filterToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        gap: 6,
    },
    filterToggleActive: {
        backgroundColor: '#FEF3C7',
    },
    filterText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
    },
    filterTextActive: {
        color: '#D97706',
    },
    starButton: {
        padding: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    undoButton: {
        padding: 4,
        justifyContent: 'center',
        alignItems: 'center',
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
