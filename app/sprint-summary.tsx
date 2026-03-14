import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, PanResponder, Animated, Modal, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Task, StorageService } from '../src/services/storage';

const THEME = {
    bg: '#F8FAFC',
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
    success: '#10B981',
    successBg: '#F0FFF4', // Light green background for completion
    accent: '#3B82F6', // Blue like the sprint button
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
    // BUT if the user wants to adjust, they can.
    const [progress, setProgress] = useState(100);
    const [isDragging, setIsDragging] = useState(false);
    const progressAnim = useRef(new Animated.Value(100)).current;

    // We treat 100% (or very close to it) as "Confirmed"
    const isConfirmed = progress >= 95;

    const widthRef = useRef(0);
    const startTouchXRef = useRef(0);

    // Refs for callbacks to avoid stale closures in PanResponder
    const onProgressChangeRef = useRef(onProgressChange);
    const onStatusChangeRef = useRef(onStatusChange);
    useEffect(() => { onProgressChangeRef.current = onProgressChange; }, [onProgressChange]);
    useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onStartShouldSetPanResponderCapture: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
            },
            onPanResponderGrant: (evt) => {
                setIsDragging(true);
                const w = widthRef.current;
                if (w > 0) {
                    const touchX = evt.nativeEvent.locationX;
                    startTouchXRef.current = touchX;
                    let p = (touchX / w) * 100;
                    p = Math.max(0, Math.min(100, p));
                    setProgress(p);
                    progressAnim.setValue(p);
                    onProgressChangeRef.current(task.id, p);
                }
            },
            onPanResponderMove: (_, gestureState) => {
                const w = widthRef.current;
                if (w > 0) {
                    // Absolute tracking if we start from jump
                    // But if we want relative dragging from initial touch point?
                    // We used "Jump to finger" logic in Grant, so we are tracking finger position relative to view
                    // gestureState.moveX is page-relative.
                    // locationX is element-relative but ONLY at start of gesture (in Grant).
                    // To track accurately:
                    // Current X = Start X (from Grant) + dx
                    const currentX = startTouchXRef.current + gestureState.dx;
                    let p = (currentX / w) * 100;
                    p = Math.max(0, Math.min(100, p));
                    if (p > 95) p = 100; // Magnetic Snap
                    setProgress(p);
                    progressAnim.setValue(p);
                    onProgressChangeRef.current(task.id, p);
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
                    Animated.spring(progressAnim, {
                        toValue: p,
                        useNativeDriver: false,
                        bounciness: 0
                    }).start();
                    setProgress(p);
                    onProgressChangeRef.current(task.id, p);
                    onStatusChangeRef.current(task.id, p >= 95);
                }
            },
            onPanResponderTerminationRequest: () => false,
            onPanResponderTerminate: () => setIsDragging(false)
        })
    ).current;

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
            <Animated.View style={[
                styles.progressFill,
                {
                    width: progressAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%']
                    }),
                    backgroundColor: progressAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['#F1F5F9', THEME.successBg]
                    })
                }
            ]} />

            {/* Overlay allows gestures anywhere on the row */}
            {/* zIndex 20 ensures it is above background but below Content if Content is higher */}
            <View style={[styles.sliderOverlay, { zIndex: 20 }]} {...panResponder.panHandlers} />

            {/* Content sits visually on top. 
                pointerEvents="box-none" lets touches pass through the container.
                Checkbox is touchable.
                Text wrapper is NOT touchable (pointerEvents="none"), so touches fall through to Overlay.
            */}
            <View style={[styles.taskContent, { zIndex: 30 }]} pointerEvents="box-none">
                <TouchableOpacity
                    onPress={handleToggle}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ marginRight: 12 }}
                >
                    <Ionicons
                        name={isConfirmed ? "checkmark-circle" : "ellipse-outline"}
                        size={24}
                        color={isConfirmed ? THEME.success : THEME.textSecondary}
                    />
                </TouchableOpacity>

                <View style={{ flex: 1 }} pointerEvents="none">
                    <Text style={[styles.taskTitle, isConfirmed && { color: '#065F46' }]} numberOfLines={1}>
                        {task.title}
                    </Text>
                    <View style={styles.metaRow}>
                        <Text style={styles.metaText}>
                            {isConfirmed ? 'Completed' : `${Math.round(progress)}% done - Slide to adjust`}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

export default function SprintSummaryScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const durationSeconds = parseInt(params.duration as string || '0', 10);
    const initialCompletedTasks: Task[] = params.tasks ? JSON.parse(params.tasks as string) : [];

    // Track confirmed status and progress percentage
    const [confirmedTaskIds, setConfirmedTaskIds] = React.useState<Set<string>>(
        new Set(initialCompletedTasks.map(t => t.id))
    );
    const [taskProgress, setTaskProgress] = useState<{ [id: string]: number }>({});

    // Timeline State
    const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
    const [showTimeline, setShowTimeline] = useState(false);

    // Initialize progress map with 100 for all initially
    useEffect(() => {
        const initialMap: any = {};
        initialCompletedTasks.forEach(t => initialMap[t.id] = 100);
        setTaskProgress(initialMap);

        if (params.timeline) {
            try {
                setTimelineEvents(JSON.parse(params.timeline as string));
            } catch (e) { console.error('Failed to parse timeline', e); }
        }
    }, []);

    const handleStatusChange = (taskId: string, isConfirmed: boolean) => {
        setConfirmedTaskIds(prev => {
            const next = new Set(prev);
            if (isConfirmed) next.add(taskId);
            else next.delete(taskId);
            return next;
        });
    };

    const handleProgressChange = (taskId: string, progress: number) => {
        setTaskProgress(prev => ({ ...prev, [taskId]: progress }));
    };

    const handleSaveSprint = async () => {
        try {
            await StorageService.saveSavedSprint({
                id: Date.now().toString(),
                date: new Date().toISOString(),
                durationSeconds,
                timelineEvents
            });
            Alert.alert("Success", "Sprint saved to Best Days!");
        } catch (error) {
            console.error("Failed to save sprint:", error);
            Alert.alert("Error", "Could not save sprint. Please try again.");
        }
    };

    const handleFinish = async () => {
        try {
            const activeTasks = await StorageService.loadActiveTasks();
            let finalActiveTasks = [...activeTasks];
            let hasChanges = false;

            // 1. Confirmed -> Archive or Mark Completed
            const tasksToComplete = initialCompletedTasks.filter(t => confirmedTaskIds.has(t.id));

            if (tasksToComplete.length > 0) {
                const idsToArchive = new Set<string>();

                for (const task of tasksToComplete) {
                    // --- NEW LOGIC: Subtask Extraction Handling ---
                    if (task.sprintParentId && task.sprintSubtaskId) {
                        const masterIndex = finalActiveTasks.findIndex(t => t.id === task.sprintParentId);
                        if (masterIndex >= 0) {
                            const masterTask = finalActiveTasks[masterIndex];

                            // Map over subtasks to mark the matching one completed
                            const updatedSubtasks = masterTask.subtasks?.map(st =>
                                st.id === task.sprintSubtaskId ? { ...st, completed: true } : st
                            ) || [];

                            // Check if all subtasks are now complete
                            const allSubtasksCompleted = updatedSubtasks.every(st => st.completed);

                            if (allSubtasksCompleted) {
                                // Subtasks are all done!
                                // Check if the master is a recurring instance (handled further down normally if it was a direct task)
                                if (masterTask.originalTaskId && masterTask.originalTaskId !== masterTask.id) {
                                    // It's a recurring instance
                                    const dateToMark = (masterTask as any).originalDate || masterTask.date;
                                    const newCompletedDates = [...(masterTask.completedDates || []), dateToMark];
                                    finalActiveTasks[masterIndex] = { ...masterTask, completedDates: newCompletedDates };
                                    hasChanges = true;
                                } else {
                                    // Regular master task - all subtasks done, so archive the whole parent!
                                    const taskWithDate = { ...masterTask, completed: true, completedAt: new Date().toISOString() };
                                    await StorageService.addToHistory(taskWithDate);
                                    idsToArchive.add(masterTask.id);
                                }
                            } else {
                                // Not all subtasks are done, just save the parent back to active tasks with updated array
                                finalActiveTasks[masterIndex] = { ...masterTask, subtasks: updatedSubtasks };
                                hasChanges = true;
                            }
                        }
                    }
                    // Check if it's a Ghost/Recurring Instance
                    else if (task.originalTaskId && task.originalTaskId !== task.id) {
                        // It's a recurring instance!
                        // We don't archive the master task. We update its completedDates.
                        const masterIndex = finalActiveTasks.findIndex(t => t.id === task.originalTaskId);
                        if (masterIndex >= 0) {
                            const masterTask = finalActiveTasks[masterIndex];
                            const dateToMark = (task as any).originalDate || (task as any).date; // specific date of instance

                            const newCompletedDates = [...(masterTask.completedDates || []), dateToMark];

                            finalActiveTasks[masterIndex] = {
                                ...masterTask,
                                completedDates: newCompletedDates
                            };
                            hasChanges = true;
                        }
                    } else {
                        // Regular task -> Archive it
                        const taskWithDate = { ...task, completed: true, completedAt: new Date().toISOString() };
                        await StorageService.addToHistory(taskWithDate);
                        idsToArchive.add(task.id);
                    }
                }

                // Remove archived regular tasks from active list
                if (idsToArchive.size > 0) {
                    finalActiveTasks = finalActiveTasks.filter(t => !idsToArchive.has(t.id));
                    hasChanges = true;
                }
            }

            // 2. Partial / Not Completed (Update Progress)
            const tasksToUpdate = initialCompletedTasks.filter(t => !confirmedTaskIds.has(t.id));

            for (const task of tasksToUpdate) {
                const newProgress = taskProgress[task.id];
                if (newProgress !== undefined) {
                    if (task.sprintParentId && task.sprintSubtaskId) {
                        // Update specific subtask progress
                        const masterIndex = finalActiveTasks.findIndex(t => t.id === task.sprintParentId);
                        if (masterIndex >= 0) {
                            const masterTask = finalActiveTasks[masterIndex];
                            const updatedSubtasks = masterTask.subtasks?.map(st =>
                                st.id === task.sprintSubtaskId ? { ...st, progress: newProgress } : st
                            ) || [];

                            finalActiveTasks[masterIndex] = { ...masterTask, subtasks: updatedSubtasks };
                            hasChanges = true;
                        }
                    } else if (task.originalTaskId && task.originalTaskId !== task.id) {
                        const masterIndex = finalActiveTasks.findIndex(t => t.id === task.originalTaskId);
                        if (masterIndex >= 0) {
                            const masterTask = finalActiveTasks[masterIndex];
                            const dateKey = (task as any).originalDate || (task as any).date;

                            const newInstanceProgress = {
                                ...(masterTask.instanceProgress || {}),
                                [dateKey]: newProgress
                            };

                            finalActiveTasks[masterIndex] = {
                                ...masterTask,
                                instanceProgress: newInstanceProgress
                            };
                            hasChanges = true;
                        }
                    } else {
                        // Regular task
                        finalActiveTasks = finalActiveTasks.map(t => {
                            if (t.id === task.id) {
                                return { ...t, progress: newProgress };
                            }
                            return t;
                        });
                        hasChanges = true;
                    }
                }
            }

            if (hasChanges) {
                await StorageService.saveActiveTasks(finalActiveTasks);
            }
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
        return `${m}m`;
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleFinish} style={styles.exitButton}>
                    <Ionicons name="close" size={24} color={THEME.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveSprint} style={styles.headerSaveButton}>
                    <Ionicons name="bookmark-outline" size={20} color={THEME.accent} style={{ marginRight: 6 }} />
                    <Text style={styles.headerSaveText}>Save</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.summaryHeader}>
                    <Text style={styles.summaryLabel}>FOCUS TIME</Text>
                    <Text style={styles.scaryBigTime}>{formatDuration(durationSeconds)}</Text>
                </View>

                <Text style={styles.sectionHeader}>REVIEW PROGRESS</Text>
                <View style={styles.taskListContainer}>
                    {initialCompletedTasks.map((task) => (
                        <SprintSummaryTaskRow
                            key={task.id}
                            task={task}
                            onStatusChange={handleStatusChange}
                            onProgressChange={handleProgressChange}
                        />
                    ))}
                </View>

                {/* See Timeline Button */}
                {timelineEvents.length > 0 && (
                    <TouchableOpacity
                        style={styles.timelineButton}
                        onPress={() => setShowTimeline(true)}
                    >
                        <MaterialCommunityIcons name="timeline-clock-outline" size={20} color={THEME.textSecondary} />
                        <Text style={styles.timelineButtonText}>See Timeline</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.doneButton} onPress={handleFinish} activeOpacity={0.8}>
                    <Text style={styles.doneButtonText}>Finish Sprint</Text>
                </TouchableOpacity>
            </View>

            {/* TIMELINE MODAL */}
            <Modal visible={showTimeline} animationType="slide" transparent>
                <View style={styles.timelineModalOverlay}>
                    <View style={styles.timelineModalContent}>
                        <View style={styles.timelineModalHeader}>
                            <Text style={styles.timelineModalTitle}>Sprint Timeline</Text>
                            <TouchableOpacity onPress={() => setShowTimeline(false)} style={styles.timelineCloseBtn}>
                                <Ionicons name="close" size={24} color={THEME.textPrimary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.timelineScroll} showsVerticalScrollIndicator={false}>
                            {timelineEvents.map((evt, idx) => {
                                const isTask = evt.type === 'task';
                                const isBreak = evt.type === 'break';
                                return (
                                    <View key={idx} style={styles.timelineRow}>
                                        <View style={styles.timelineVisuals}>
                                            <View style={[
                                                styles.timelineDot,
                                                { backgroundColor: isTask ? THEME.accent : (isBreak ? THEME.success : '#94A3B8') }
                                            ]} />
                                            {idx < timelineEvents.length - 1 && <View style={styles.timelineLine} />}
                                        </View>
                                        <View style={styles.timelineInfo}>
                                            <Text style={styles.timelineTitle}>{evt.title}</Text>
                                            <Text style={styles.timelineDuration}>{formatDuration(evt.durationSeconds)}</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.bg },
    header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    exitButton: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 20 },
    headerSaveButton: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#EFF6FF', 
        paddingHorizontal: 16, 
        paddingVertical: 8, 
        borderRadius: 20 
    },
    headerSaveText: { color: THEME.accent, fontWeight: 'bold', fontSize: 16 },
    content: { padding: 24, paddingBottom: 100 },
    summaryHeader: {
        alignItems: 'center', marginBottom: 24
    },
    summaryLabel: { fontSize: 13, color: THEME.textSecondary, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 8 },
    scaryBigTime: { fontSize: 48, fontWeight: 'bold', color: THEME.textPrimary },
    sectionHeader: { fontSize: 14, fontWeight: 'bold', color: THEME.textSecondary, marginBottom: 16, letterSpacing: 1 },
    taskListContainer: { gap: 6 },
    taskItemContainer: {
        backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: THEME.border,
        height: 56, justifyContent: 'center'
    },
    progressFill: { position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 0 },
    taskContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, zIndex: 10 },
    taskTitle: { fontSize: 16, fontWeight: '600', color: THEME.textPrimary, marginBottom: 2 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { fontSize: 13, color: THEME.textSecondary },
    footer: { padding: 24, position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(248, 250, 252, 0.9)' },
    doneButton: {
        backgroundColor: '#0F172A', borderRadius: 50, height: 56, alignItems: 'center', justifyContent: 'center',
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6
    },
    doneButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
    sliderOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 },

    // Timeline Styles
    timelineButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, marginTop: 24,
        backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: THEME.border, gap: 8
    },
    timelineButtonText: { fontSize: 15, fontWeight: '600', color: THEME.textSecondary },

    timelineModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    timelineModalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '70%', padding: 24 },
    timelineModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    timelineModalTitle: { fontSize: 20, fontWeight: 'bold', color: THEME.textPrimary },
    timelineCloseBtn: { padding: 4, backgroundColor: '#F1F5F9', borderRadius: 20 },
    timelineScroll: { flex: 1 },
    timelineRow: { flexDirection: 'row', minHeight: 60 },
    timelineVisuals: { width: 30, alignItems: 'center' },
    timelineDot: { width: 12, height: 12, borderRadius: 6, zIndex: 2, marginTop: 4 },
    timelineLine: { width: 2, flex: 1, backgroundColor: '#E2E8F0', marginTop: 4, marginBottom: -4, zIndex: 1 },
    timelineInfo: { flex: 1, paddingLeft: 12, paddingBottom: 24 },
    timelineTitle: { fontSize: 16, fontWeight: '600', color: THEME.textPrimary, marginBottom: 4 },
    timelineDuration: { fontSize: 14, color: THEME.textSecondary }
});
