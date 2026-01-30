import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, PanResponder, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Task, StorageService } from '../src/services/storage';

const THEME = {
    bg: '#F8FAFC',
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
    success: '#10B981',
    successBg: '#F0FFF4', // Light green background for completion
    cardBg: '#FFFFFF',
    border: '#E2E8F0',
};

// Helper for remaining time display
const calculateRemainingTime = (estimatedTime: string, progress: number) => {
    if (!estimatedTime) return null;
    // If progress is near 100, we consider it done for visual purposes in calculation, 
    // but the row handles the "Done" text state.
    if (progress >= 99) return 'Done';

    let totalMinutes = 0;
    const hoursMatch = estimatedTime.match(/(\d+(?:[.,]\d+)?)\s*h/i);
    const minutesMatch = estimatedTime.match(/(\d+(?:[.,]\d+)?)\s*m/i) || estimatedTime.match(/h\s*(\d+(?:[.,]\d+)?)/i);
    const colonMatch = estimatedTime.match(/(\d+):(\d+)/);

    if (colonMatch) {
        totalMinutes = parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2]);
    } else {
        if (hoursMatch) totalMinutes += parseFloat(hoursMatch[1].replace(',', '.')) * 60;
        if (minutesMatch) totalMinutes += parseFloat(minutesMatch[1].replace(',', '.'));
    }

    if (totalMinutes === 0 && /^[\d.,]+$/.test(estimatedTime.trim())) {
        totalMinutes = parseFloat(estimatedTime.trim().replace(',', '.'));
    }

    if (totalMinutes === 0) return estimatedTime;

    const remaining = Math.round(totalMinutes * (1 - progress / 100));
    const h = Math.floor(remaining / 60);
    const m = remaining % 60;

    if (h > 0) return m > 0 ? `${h}h${m}` : `${h}h`;
    return `${m}min`;
};

// --- SLIDER ROW COMPONENT ---
const SprintSummaryTaskRow = ({
    task,
    onStatusChange,
    onProgressChange
}: {
    task: Task,
    onStatusChange: (id: string, isConfirmed: boolean) => void,
    onProgressChange: (id: string, progress: number) => void
}) => {
    // Default to 100% since these are tasks from the "Completed" list
    const [progress, setProgress] = useState(100);
    const [isDragging, setIsDragging] = useState(false);
    const progressAnim = useRef(new Animated.Value(100)).current;

    // We treat 100% (or very close to it) as "Confirmed"
    const isConfirmed = progress >= 95;

    const widthRef = useRef(0);
    const startTouchXRef = useRef(0);

    const panResponder = useRef(
        PanResponder.create({
            // Capture touches immediately for responsive sliding
            onStartShouldSetPanResponder: () => true,
            onStartShouldSetPanResponderCapture: () => true,

            // Allow vertical scroll if movement is clearly vertical, otherwise hold
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
            },

            onPanResponderGrant: (evt) => {
                setIsDragging(true);
                const w = widthRef.current;
                if (w > 0) {
                    // Jump to finger immediately
                    const touchX = evt.nativeEvent.locationX;
                    startTouchXRef.current = touchX;

                    let p = (touchX / w) * 100;
                    p = Math.max(0, Math.min(100, p));

                    setProgress(p);
                    progressAnim.setValue(p);
                }
            },

            onPanResponderMove: (_, gestureState) => {
                const w = widthRef.current;
                if (w > 0) {
                    // Track finger exactly: Start + Delta
                    const currentX = startTouchXRef.current + gestureState.dx;
                    let p = (currentX / w) * 100;

                    // Clamp
                    p = Math.max(0, Math.min(100, p));

                    // Magnetic Snap at 100%
                    if (p > 95) p = 100;

                    setProgress(p);
                    progressAnim.setValue(p);
                }
            },

            onPanResponderRelease: (_, gestureState) => {
                setIsDragging(false);
                const w = widthRef.current;
                if (w > 0) {
                    const currentX = startTouchXRef.current + gestureState.dx;
                    let p = (currentX / w) * 100;

                    if (p > 95) p = 100;
                    p = Math.max(0, Math.min(100, p));

                    // Animate visual snap
                    Animated.spring(progressAnim, {
                        toValue: p,
                        useNativeDriver: false,
                        bounciness: 0
                    }).start();

                    setProgress(p);
                    onProgressChange(task.id, p);
                    onStatusChange(task.id, p === 100);
                }
            },

            // Prevent ScrollView from stealing the gesture when dragging
            onPanResponderTerminationRequest: () => false,

            onPanResponderTerminate: () => {
                setIsDragging(false);
            }
        })
    ).current;

    // Toggle via checkmark tap
    const handleToggle = () => {
        const target = isConfirmed ? 0 : 100;

        Animated.timing(progressAnim, {
            toValue: target,
            duration: 300,
            useNativeDriver: false
        }).start();

        setProgress(target);
        onProgressChange(task.id, target);
        onStatusChange(task.id, target === 100);
    };

    return (
        <View
            style={styles.taskItemContainer}
            onLayout={(e) => widthRef.current = e.nativeEvent.layout.width}
        >
            {/* PROGRESS FILL (The Slider Visual) */}
            <Animated.View style={[
                styles.progressFill,
                {
                    width: progressAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%']
                    }),
                    // visual feedback: darker green when confirmed, slightly muted when dragging?
                    backgroundColor: progressAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['#F1F5F9', THEME.successBg] // Grey to Green
                    })
                }
            ]} />

            {/* CONTENT with PanHandlers */}
            <View
                style={styles.taskContent}
                {...panResponder.panHandlers}
            >
                {/* Checkmark Area - Tappable specifically to toggle */}
                <TouchableOpacity
                    onPress={handleToggle}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ marginRight: 12, opacity: isDragging ? 0 : 1 }}
                >
                    <Ionicons
                        name={isConfirmed ? "checkmark-circle" : "ellipse-outline"}
                        size={24}
                        color={isConfirmed ? THEME.success : THEME.textSecondary}
                    />
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                    <Text
                        style={[
                            styles.taskTitle,
                            isConfirmed && { color: '#065F46' } // Darker green text when done
                        ]}
                        numberOfLines={1}
                    >
                        {task.title}
                    </Text>

                    {/* Meta Info */}
                    <View style={styles.metaRow}>
                        {!isConfirmed || isDragging ? (
                            <>
                                <Feather name="clock" size={12} color={THEME.textSecondary} />
                                <Text style={styles.metaText}>
                                    {task.estimatedTime ? calculateRemainingTime(task.estimatedTime, progress) + ' remaining' : `${Math.round(progress)}% done`}
                                </Text>
                            </>
                        ) : (
                            <Text style={[styles.metaText, { color: THEME.success }]}>Completed</Text>
                        )}
                    </View>
                </View>
            </View>

            {/* Invisible Overlay for Pan Gesture */}
            <View
                style={styles.sliderOverlay}
                {...panResponder.panHandlers}
            />
        </View>
    );
};

export default function SprintSummaryScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    // Parse params
    const durationSeconds = parseInt(params.duration as string || '0', 10);
    const initialCompletedTasks: Task[] = params.tasks ? JSON.parse(params.tasks as string) : [];

    // State 
    const [confirmedTaskIds, setConfirmedTaskIds] = React.useState<Set<string>>(
        new Set(initialCompletedTasks.map(t => t.id))
    );
    const [taskProgress, setTaskProgress] = useState<{ [id: string]: number }>({});

    // Handlers
    const handleStatusChange = (taskId: string, isConfirmed: boolean) => {
        setConfirmedTaskIds(prev => {
            const next = new Set(prev);
            if (isConfirmed) next.add(taskId);
            else next.delete(taskId);
            return next;
        });
    };

    const handleProgressChange = (taskId: string, progress: number) => {
        setTaskProgress(prev => ({
            ...prev,
            [taskId]: progress
        }));
    };

    const handleFinish = async () => {
        try {
            const activeTasks = await StorageService.loadActiveTasks();
            let finalActiveTasks = [...activeTasks];
            let hasChanges = false;

            // 1. Confirmed -> Archive
            const tasksToComplete = initialCompletedTasks.filter(t => confirmedTaskIds.has(t.id));
            if (tasksToComplete.length > 0) {
                const activeTaskIdsToComplete = new Set(tasksToComplete.map(t => t.id));

                for (const task of tasksToComplete) {
                    const taskWithDate = { ...task, completed: true, completedAt: new Date().toISOString() };
                    await StorageService.addToHistory(taskWithDate);
                }

                finalActiveTasks = finalActiveTasks.filter(t => !activeTaskIdsToComplete.has(t.id));
                hasChanges = true;
            }

            // 2. Unconfirmed -> Update Time/Progress
            const tasksToUpdate = initialCompletedTasks.filter(t => !confirmedTaskIds.has(t.id));

            for (const task of tasksToUpdate) {
                // If we have updated progress in the map, use it.
                // If not in map, it keeps original progress or whatever was set.
                // Default in Row was 100. If user dragged it, it's in the map.
                // If user toggled to unconfirm but didn't drag, it might be 0 or previous value? 
                // Row sets p=0 if unconfirmed by default toggle? Let's check Row behavior.
                // Row: handleToggle sets progress=0. And calls onProgressChange(0).

                const newProgress = taskProgress[task.id];

                // We update if it's defined. (0 is a valid update)
                if (newProgress !== undefined) {
                    finalActiveTasks = finalActiveTasks.map(t => {
                        if (t.id === task.id) {
                            return {
                                ...t,
                                // Update Progress to the new percentage
                                progress: newProgress
                                // Keep original Estimated Time so percentage relates to same total
                            };
                        }
                        return t;
                    });
                    hasChanges = true;
                }
            }

            if (hasChanges) {
                await StorageService.saveActiveTasks(finalActiveTasks);
            }

            // Navigate home
            router.replace('/');

        } catch (e) {
            console.error("Failed to save sprint completion", e);
            router.replace('/');
        }
    };

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        if (m < 1) return `${seconds}s`;
        return `${m}m`;
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.replace('/')} style={styles.exitButton}>
                    <Ionicons name="arrow-back" size={24} color={THEME.textPrimary} />
                    <Text style={styles.exitText}>Back to Home</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>TOTAL FOCUS TIME</Text>
                    <Text style={styles.scaryBigTime}>{formatDuration(durationSeconds)}</Text>

                    <Text style={[styles.summaryLabel, { marginTop: 30 }]}>COMPLETED TASKS</Text>
                    <Text style={styles.countText}>{confirmedTaskIds.size} tasks crushed</Text>
                </View>

                <View style={styles.taskListContainer}>
                    {initialCompletedTasks.length > 0 ? (
                        initialCompletedTasks.map((task, index) => (
                            <SprintSummaryTaskRow
                                key={task.id || index}
                                task={task}
                                onStatusChange={handleStatusChange}
                                onProgressChange={handleProgressChange}
                            />
                        ))
                    ) : (
                        <Text style={styles.emptyText}>No tasks completed this session.</Text>
                    )}
                </View>

            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.doneButton}
                    onPress={handleFinish}
                    activeOpacity={0.8}
                >
                    <Text style={styles.doneButtonText}>Good Job! (Finish)</Text>
                </TouchableOpacity>
            </View>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.bg,
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    exitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    exitText: {
        fontSize: 16,
        color: THEME.textPrimary,
        fontWeight: '500',
    },
    content: {
        padding: 24,
    },
    summaryCard: {
        backgroundColor: THEME.cardBg,
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
        marginBottom: 32,
    },
    summaryLabel: {
        fontSize: 13,
        color: THEME.textSecondary,
        fontWeight: 'bold',
        letterSpacing: 1.5,
        marginBottom: 12,
    },
    scaryBigTime: {
        fontSize: 56,
        fontWeight: 'bold',
        color: THEME.textPrimary,
        fontVariant: ['tabular-nums'],
    },
    countText: {
        fontSize: 18,
        color: THEME.success,
        fontWeight: '600',
    },
    taskListContainer: {
        gap: 16,
    },
    taskItemContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: THEME.border,
        marginBottom: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        position: 'relative',
        height: 70, // Fixed height for reliable layout
    },
    progressFill: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        backgroundColor: THEME.successBg,
        zIndex: 0,
    },
    taskContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        zIndex: 10,
    },
    taskTitle: {
        fontSize: 16,
        color: THEME.textPrimary,
        fontWeight: '600',
        marginBottom: 2,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    metaText: {
        fontSize: 12,
        color: THEME.textSecondary,
    },
    emptyText: {
        textAlign: 'center',
        color: THEME.textSecondary,
        fontStyle: 'italic',
        marginTop: 20,
    },
    footer: {
        padding: 24,
        paddingBottom: 40,
    },
    doneButton: {
        backgroundColor: THEME.textPrimary,
        borderRadius: 50,
        height: 64,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    doneButtonText: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    sliderOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1, // Capture touches above background but below checkmark
    },
});
