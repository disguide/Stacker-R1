import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Modal, Alert, PanResponder } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Task, StorageService } from '../src/services/storage';
import { toISODateString } from '../src/utils/dateHelpers';

const THEME = {
    bg: '#F0F9FF', // Clean pale blue background
    textPrimary: '#0F172A', // Navy/Slate
    textSecondary: '#64748B',
    success: '#0EA5E9',
    successBg: '#F0F9FF', // Light blue background for completion
    accent: '#0EA5E9',
    border: 'rgba(255, 255, 255, 0.5)',
    cardBg: 'rgba(255, 255, 255, 0.98)',
};

// Helper for remaining time display
const calculateRemainingTime = (estimatedTime: string, progress: number, t: any) => {
    if (!estimatedTime) return null;
    // If progress is near 100, we consider it done for visual purposes in calculation,
    // but the row handles the "Done" text state.
    if (progress >= 99) return t('common.done');

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

    if (h > 0) return m > 0 ? `${h}${t('journal.h')}${m}${t('journal.m')}` : `${h}${t('journal.h')}`;
    return `${m}${t('sprints.min')}`;
};

// --- SLIDER ROW COMPONENT ---
const SprintSummaryTaskRow = ({
    task,
    onStatusChange,
    onProgressChange,
    isSubtask = false,
    isLast = false
}: {
    task: any,
    onStatusChange: (id: string, isConfirmed: boolean, parentId?: string) => void,
    onProgressChange: (id: string, progress: number, parentId?: string) => void,
    isSubtask?: boolean,
    isLast?: boolean
}) => {
    const { t } = useTranslation();
    // Use task status for initialization
    const initialProgress = task.isCompleted ? 100 : (task.progress || 0);
    const [progress, setProgress] = useState(initialProgress);
    const [isDragging, setIsDragging] = useState(false);
    const progressAnim = useRef(new Animated.Value(initialProgress)).current;

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
                    onProgressChangeRef.current(task.id, p, (task as any).parentId);
                }
            },
            onPanResponderMove: (_, gestureState) => {
                const w = widthRef.current;
                if (w > 0) {
                    const currentX = startTouchXRef.current + gestureState.dx;
                    let p = (currentX / w) * 100;
                    p = Math.max(0, Math.min(100, p));
                    if (p > 95) p = 100; // Magnetic Snap
                    setProgress(p);
                    progressAnim.setValue(p);
                    onProgressChangeRef.current(task.id, p, (task as any).parentId);
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
                    onProgressChangeRef.current(task.id, p, (task as any).parentId);
                    onStatusChangeRef.current(task.id, p >= 95, (task as any).parentId);
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
        onProgressChange(task.id, target, (task as any).parentId);
        onStatusChange(task.id, target === 100, (task as any).parentId);
    };

    return (
        <View
            style={[
                styles.taskItemContainer,
                !isLast && { borderBottomWidth: 1, borderBottomColor: '#CBD5E1' }
            ]}
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
                        outputRange: ['#F1F5F9', '#F0F9FF'] // Fades into background
                    })
                }
            ]} />

            <View style={[styles.sliderOverlay, { zIndex: 20 }]} {...panResponder.panHandlers} />

            <View style={[styles.taskContent, { zIndex: 30 }, isSubtask && { paddingLeft: 40 }]} pointerEvents="box-none">
                <TouchableOpacity
                    onPress={handleToggle}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ marginRight: 12 }}
                >
                    <Ionicons
                        name={isConfirmed ? "checkmark-circle" : "ellipse-outline"}
                        size={isSubtask ? 20 : 24}
                        color={isConfirmed ? '#4ADE80' : THEME.textSecondary}
                    />
                </TouchableOpacity>

                <View style={{ flex: 1 }} pointerEvents="none">
                    <Text style={[styles.taskTitle, isConfirmed && { color: THEME.textPrimary }, isSubtask && { fontSize: 14 }]} numberOfLines={1}>
                        {task.title}
                    </Text>
                    <View style={styles.metaRow}>
                        <Text style={styles.metaText}>
                            {isConfirmed ? t('profile.completed') : t('sprints.percentDone', { percent: Math.round(progress) })}
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

export default function SprintSummaryScreen() {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams();
    const workSeconds = parseInt(params.duration as string || '0', 10);
    const breakSeconds = parseInt(params.breakDuration as string || '0', 10);
    const totalDurationSeconds = parseInt(params.totalDuration as string || '0', 10);
    const initialSprintTasks: Task[] = params.tasks ? JSON.parse(params.tasks as string) : [];

    // Track confirmed status and progress percentage
    const [confirmedTaskIds, setConfirmedTaskIds] = React.useState<Set<string>>(
        new Set(initialSprintTasks.filter(t => t.isCompleted).map(t => t.id))
    );
    // { [taskId]: { [subtaskId]: progress } } for subtasks
    const [taskProgress, setTaskProgress] = useState<{ [id: string]: number }>({});
    const [subtaskProgress, setSubtaskProgress] = useState<{ [parentId: string]: { [subId: string]: number } }>({});
    const [confirmedSubtaskIds, setConfirmedSubtaskIds] = useState<{ [parentId: string]: Set<string> }>({});

    // Timeline State
    const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
    const [showTimeline, setShowTimeline] = useState(false);

    // Initializing progress maps
    const [savedSprintId, setSavedSprintId] = useState<string | null>(null);
    useEffect(() => {
        const initialTaskMap: any = {};
        const initialSubMap: any = {};
        const initialSubConfirmed: any = {};

        initialSprintTasks.forEach(t => {
            initialTaskMap[t.id] = t.isCompleted ? 100 : (t.progress || 0);
            if (t.subtasks && t.subtasks.length > 0) {
                const subProgress: any = {};
                const subConf = new Set<string>();
                t.subtasks.forEach(st => {
                    subProgress[st.id] = st.isCompleted ? 100 : (st.progress || 0);
                    if (st.isCompleted) subConf.add(st.id);
                });
                initialSubMap[t.id] = subProgress;
                initialSubConfirmed[t.id] = subConf;
            }
        });
        setTaskProgress(initialTaskMap);
        setSubtaskProgress(initialSubMap);
        setConfirmedSubtaskIds(initialSubConfirmed);

        if (params.timeline) {
            try {
                setTimelineEvents(JSON.parse(params.timeline as string));
            } catch (e) { console.error('Failed to parse timeline', e); }
        }
    }, []);

    const handleStatusChange = (taskId: string, isConfirmed: boolean, parentId?: string) => {
        // Find title for timeline entry
        let title = t('sprints.task');
        if (parentId) {
            const parent = initialSprintTasks.find(t => t.id === parentId);
            const sub = parent?.subtasks?.find(st => st.id === taskId);
            title = sub ? sub.title : t('sprints.subtask');
        } else {
            const task = initialSprintTasks.find(t => t.id === taskId);
            title = task ? task.title : t('sprints.task');
        }

        // Add "Review" marker if confirmed
        if (isConfirmed) {
            const now = Date.now();
            const newEvent = {
                type: 'task',
                title: `${t('sprints.review')}: ${title}`,
                startTime: now,
                endTime: now,
                durationSeconds: 0 // Duration is 0 for post-sprint adjustments
            };
            setTimelineEvents(prev => [...prev, newEvent]);
        }

        if (parentId) {
            setConfirmedSubtaskIds(prev => {
                const parentSet = new Set(prev[parentId] || []);
                if (isConfirmed) parentSet.add(taskId);
                else parentSet.delete(taskId);
                return { ...prev, [parentId]: parentSet };
            });
        } else {
            setConfirmedTaskIds(prev => {
                const next = new Set(prev);
                if (isConfirmed) next.add(taskId);
                else next.delete(taskId);
                return next;
            });
        }
    };

    const handleProgressChange = (taskId: string, progress: number, parentId?: string) => {
        if (parentId) {
            setSubtaskProgress(prev => ({
                ...prev,
                [parentId]: { ...(prev[parentId] || {}), [taskId]: progress }
            }));
        } else {
            setTaskProgress(prev => ({ ...prev, [taskId]: progress }));
        }
    };

    const getLongestTask = () => {
        if (!timelineEvents || timelineEvents.length === 0) return t('journal.defaultFocusTitle');

        const taskDurations: { [key: string]: number } = {};
        timelineEvents.forEach(event => {
            if (event.type === 'task' && event.title) {
                taskDurations[event.title] = (taskDurations[event.title] || 0) + (event.durationSeconds || 0);
            }
        });

        let longestTitle = '';
        let maxDuration = -1;

        Object.entries(taskDurations).forEach(([title, duration]) => {
            if (duration > maxDuration) {
                maxDuration = duration;
                longestTitle = title;
            }
        });

        return longestTitle || t('journal.defaultFocusTitle');
    };

    const handleSaveSprint = async () => {
        if (savedSprintId) {
            try {
                await StorageService.deleteSavedSprint(savedSprintId);
                setSavedSprintId(null);
            } catch (err) {
                console.error("Failed to unsave sprint:", err);
            }
            return;
        }

        try {
            const primaryTask = getLongestTask();
            const newId = Date.now().toString();

            await StorageService.saveSavedSprint({
                id: newId,
                date: toISODateString(new Date()),
                durationSeconds: workSeconds,
                breakDurationSeconds: breakSeconds,
                totalDurationSeconds,
                timelineEvents,
                primaryTask,
                taskCount: confirmedTaskIds.size,
                updated_at: Date.now()
            } as any);
            setSavedSprintId(newId);
        } catch (error) {
            console.error("Failed to save sprint:", error);
            Alert.alert(t('common.error'), t('profile.failedToAddGoal')); // Reusing error
        }
    };

    const handleFinish = async () => {
        try {
            const activeTasks = await StorageService.loadActiveTasks();
            let finalActiveTasks = [...activeTasks];
            let hasChanges = false;

            // 1. Process all initial sprint tasks
            for (const sprintTask of initialSprintTasks) {
                const isTaskConfirmed = confirmedTaskIds.has(sprintTask.id);
                const currentTaskProgress = taskProgress[sprintTask.id];

                // Check if it's a Ghost/Recurring Instance
                const isRecurringInstance = sprintTask.originalTaskId && sprintTask.originalTaskId !== sprintTask.id;
                const masterId = isRecurringInstance ? sprintTask.originalTaskId : sprintTask.id;
                const masterIndex = finalActiveTasks.findIndex(t => t.id === masterId);

                if (masterIndex >= 0) {
                    let masterTask = { ...finalActiveTasks[masterIndex] };

                    // --- Update Subtasks first ---
                    if (sprintTask.subtasks && sprintTask.subtasks.length > 0) {
                        const parentSubConf = confirmedSubtaskIds[sprintTask.id] || new Set();
                        const parentSubProg = subtaskProgress[sprintTask.id] || {};

                        masterTask.subtasks = masterTask.subtasks?.map(st => {
                            const newComp = parentSubConf.has(st.id);
                            const newProg = parentSubProg[st.id] ?? st.progress ?? 0;
                            return { ...st, isCompleted: newComp, progress: newProg };
                        });
                    }

                    // --- Update Task Completion/Progress ---
                    if (isTaskConfirmed) {
                        if (isRecurringInstance) {
                            const dateToMark = (sprintTask as any).originalDate || sprintTask.date;
                            const newCompletedDates = [...(masterTask.completedDates || []), dateToMark];
                            masterTask.completedDates = newCompletedDates;
                            finalActiveTasks[masterIndex] = masterTask;
                        } else {
                            // Regular task -> Archive it
                            const taskToArchive = { ...masterTask, isCompleted: true, completedAt: Date.now(), updated_at: Date.now() };
                            await StorageService.addToHistory(taskToArchive);
                            // Mark for removal but don't just filter yet to preserve index mapping during the loop
                            (finalActiveTasks[masterIndex] as any).__toBeArchived = true;
                        }
                    } else {
                        // Not confirmed, update progress
                        if (isRecurringInstance) {
                            const dateKey = (sprintTask as any).originalDate || (sprintTask as any).date;
                            const newInstanceProgress = {
                                ...(masterTask.instanceProgress || {}),
                                [dateKey]: currentTaskProgress
                            };
                            masterTask.instanceProgress = newInstanceProgress;
                        } else {
                            masterTask.progress = currentTaskProgress;
                        }
                        finalActiveTasks[masterIndex] = masterTask;
                    }
                    hasChanges = true;
                }
            }

            // Perform the final filtering of archived tasks
            if (hasChanges) {
                finalActiveTasks = finalActiveTasks.filter(t => !(t as any).__toBeArchived);
                await StorageService.saveActiveTasks(finalActiveTasks);
            }

            // Auto-save this sprint to history
            const primaryTask = getLongestTask();

            const sprintRecord = {
                id: `hist_${Date.now()}`,
                date: toISODateString(new Date()),
                durationSeconds: workSeconds,
                breakDurationSeconds: breakSeconds,
                totalDurationSeconds: workSeconds + breakSeconds,
                timelineEvents: timelineEvents,
                primaryTask,
                taskCount: confirmedTaskIds.size,
                updated_at: Date.now()
            };
            await StorageService.addToSprintHistory(sprintRecord as any);

            router.replace('/');
        } catch (e) {
            console.error("Failed to save sprint completion", e);
            router.replace('/');
        }
    };

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}${t('journal.h')} ${m}${t('journal.m')} ${s}${t('journal.s')}`;
        if (m > 0) return `${m}${t('journal.m')} ${s}${t('journal.s')}`;
        return `${s}${t('journal.s')}`;
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleFinish} style={styles.exitButton}>
                    <Ionicons name="close" size={20} color={THEME.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('sprints.summaryTitle')}</Text>
                <TouchableOpacity onPress={handleSaveSprint} style={styles.headerSaveButton}>
                    <Text style={[styles.headerSaveText, !!savedSprintId && { color: THEME.success }]}>
                        {savedSprintId ? t('journal.savedToast') : t('common.save')}
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.summaryHeader}>
                    <View style={styles.statContainer}>
                        <Text style={styles.summaryLabel}>{t('sprints.focusTime')}</Text>
                        <Text style={[styles.scaryBigTime, { color: '#166534' }]}>{formatDuration(workSeconds)}</Text>
                    </View>

                    <View style={styles.statDivider} />

                    <View style={styles.statContainer}>
                        <Text style={styles.summaryLabel}>{t('sprints.breakTime')}</Text>
                        <Text style={[styles.scaryBigTime, { color: '#3B82F6' }]}>{formatDuration(breakSeconds)}</Text>
                    </View>
                </View>

                <Text style={styles.sectionHeader}>{t('sprints.reviewProgress')}</Text>

                <View style={styles.taskListContainer}>
                    {initialSprintTasks.map((task, index) => {
                        const hasSubs = !!task.subtasks && task.subtasks.length > 0;
                        const isLastTask = index === initialSprintTasks.length - 1;
                        return (
                            <React.Fragment key={task.id}>
                                <SprintSummaryTaskRow
                                    task={task}
                                    onStatusChange={handleStatusChange}
                                    onProgressChange={handleProgressChange}
                                    isLast={isLastTask && !hasSubs}
                                />
                                {task.subtasks && task.subtasks.map((subtask, subIdx) => {
                                    const isSubOfLastTask = isLastTask;
                                    const isLastSubInParent = subIdx === task.subtasks!.length - 1;
                                    return (
                                        <SprintSummaryTaskRow
                                            key={subtask.id}
                                            task={{ ...subtask, parentId: task.id }}
                                            onStatusChange={handleStatusChange}
                                            onProgressChange={handleProgressChange}
                                            isSubtask={true}
                                            isLast={isSubOfLastTask && isLastSubInParent}
                                        />
                                    );
                                })}
                            </React.Fragment>
                        );
                    })}
                </View>

                {/* See Timeline Button */}
                {timelineEvents.length > 0 && (
                    <TouchableOpacity
                        style={styles.timelineButton}
                        onPress={() => setShowTimeline(true)}
                    >
                        <MaterialCommunityIcons name="timeline-clock-outline" size={20} color={THEME.textSecondary} />
                        <Text style={styles.timelineButtonText}>{t('sprints.seeTimeline')}</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.doneButton} onPress={handleFinish} activeOpacity={0.8}>
                    <Text style={styles.doneButtonText}>{t('sprints.finishSprint')}</Text>
                </TouchableOpacity>
            </View>

            {/* TIMELINE MODAL */}
            <Modal visible={showTimeline} animationType="slide" transparent>
                <View style={styles.timelineModalOverlay}>
                    <View style={styles.timelineModalContent}>
                        <View style={styles.timelineModalHeader}>
                            <Text style={styles.timelineModalTitle}>{t('sprints.timelineTitle')}</Text>
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
    header: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '700', color: THEME.textPrimary },
    exitButton: { padding: 6, backgroundColor: '#F1F5F9', borderRadius: 20 },
    headerSaveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'transparent',
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    headerSaveText: { color: THEME.accent, fontWeight: '600', fontSize: 14 },
    content: { padding: 16, paddingBottom: 100 },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        marginBottom: 24,
        backgroundColor: THEME.cardBg,
        paddingVertical: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.6)',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 8,
    },
    statContainer: {
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: 'rgba(226, 232, 240, 0.8)',
    },
    summaryLabel: {
        fontSize: 10,
        color: THEME.textSecondary,
        fontWeight: '900',
        letterSpacing: 1.5,
        marginBottom: 4,
    },
    scaryBigTime: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
    sectionHeader: {
        fontSize: 10,
        fontWeight: '900',
        color: THEME.textSecondary,
        marginBottom: 12,
        letterSpacing: 1.5,
        marginLeft: 8,
    },
    taskListContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 4, // Subtle rounding
        borderWidth: 1,
        borderColor: '#CBD5E1', // Softer border color
        overflow: 'hidden',
        marginBottom: 24,
    },
    taskItemContainer: {
        height: 60,
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    progressFill: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 0,
        borderRightWidth: 1,
        borderRightColor: 'rgba(14, 165, 233, 0.2)', // Edge definition for progress
    },
    taskContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, zIndex: 10 },
    taskTitle: { fontSize: 16, fontWeight: '600', color: THEME.textPrimary, marginBottom: 2 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { fontSize: 12, color: THEME.textSecondary },
    footer: { padding: 16, paddingBottom: 32, backgroundColor: THEME.bg },
    doneButton: {
        backgroundColor: '#0F172A',
        borderRadius: 16,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
    },
    doneButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    sliderOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 },

    // Timeline Styles
    timelineButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, marginTop: 16,
        backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: THEME.accent, gap: 8
    },
    timelineButtonText: { fontSize: 15, fontWeight: '500', color: THEME.accent },

    timelineModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    timelineModalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '70%', padding: 20 },
    timelineModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    timelineModalTitle: { fontSize: 18, fontWeight: 'bold', color: THEME.textPrimary },
    timelineCloseBtn: { padding: 4, backgroundColor: '#F1F5F9', borderRadius: 20 },
    timelineScroll: { flex: 1 },
    timelineRow: { flexDirection: 'row', minHeight: 50 },
    timelineVisuals: { width: 30, alignItems: 'center' },
    timelineDot: { width: 10, height: 10, borderRadius: 5, zIndex: 2, marginTop: 4 },
    timelineLine: { width: 2, flex: 1, backgroundColor: '#E2E8F0', marginTop: 4, marginBottom: -4, zIndex: 1 },
    timelineInfo: { flex: 1, paddingLeft: 12, paddingBottom: 20 },
    timelineTitle: { fontSize: 15, fontWeight: '500', color: THEME.textPrimary, marginBottom: 2 },
    timelineDuration: { fontSize: 13, color: THEME.textSecondary }
});
