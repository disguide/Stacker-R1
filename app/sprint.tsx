import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, Vibration, BackHandler } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';

import { StorageService, Task, SprintSettings } from '../src/services/storage';

export interface TimelineEvent {
    type: 'task' | 'break' | 'pause';
    title: string;
    startTime: number;
    endTime: number;
    durationSeconds: number;
}

// Theme - consistent with index.tsx
const THEME = {
    bg: '#F8FAFC',
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
    accent: '#3B82F6', // Blue like the sprint button
    success: '#10B981',
    border: '#E2E8F0',
    timerBg: '#FFFFFF',
    cardBg: '#FFFFFF',
};

export default function SprintScreen() {
    useKeepAwake(); // Keep screen on during sprint
    const router = useRouter();
    const params = useLocalSearchParams();
    const { taskIds } = params;

    const [tasks, setTasks] = useState<Task[]>([]);
    const [completedTasks, setCompletedTasks] = useState<Task[]>([]);

    // Settings & Timer State
    const [settings, setSettings] = useState<SprintSettings>({ showTimer: true, allowPause: true });
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [breakPhase, setBreakPhase] = useState<'none' | 'claiming' | 'active'>('none');
    const [intervalsCompleted, setIntervalsCompleted] = useState(0);
    const [timerVisible, setTimerVisible] = useState(false);

    // Timing Refs
    const startTimeRef = useRef<number>(0);
    const claimingStartTimeRef = useRef<number>(0); // When user first hit pause (includes claiming phase)
    const pauseStartTimeRef = useRef<number>(0); // When active break starts (for break timer display)
    const totalPausedTimeRef = useRef<number>(0);
    const intervalsCompletedRef = useRef<number>(0);

    // Timeline Tracking
    const timelineRef = useRef<TimelineEvent[]>([]);
    const currentSegmentStartTimeRef = useRef<number>(Date.now());

    const loadSprintTasks = async () => {
        try {
            const sprintTasks = await StorageService.loadSprintTasks();
            if (sprintTasks && sprintTasks.length > 0) {
                setTasks(sprintTasks);
            } else {
                if (__DEV__) console.warn("No sprint tasks found in storage");
            }
        } catch (e) {
            if (__DEV__) console.error("Failed to load sprint tasks", e);
        }
    };

    const loadSettings = async () => {
        const s = await StorageService.loadSprintSettings();
        setSettings(s);
    };

    const handleSwitchTask = () => {
        setTasks(prevTasks => {
            if (prevTasks.length <= 1) return prevTasks;

            // Re-order tasks
            const [first, ...rest] = prevTasks;
            const newTasks = [...rest, first];

            // Record segment
            const now = Date.now();
            recordCurrentSegment(now, first.title); // Explicitly use the old title
            return newTasks;
        });
    };

    // Initial Load
    useEffect(() => {
        const now = Date.now();
        startTimeRef.current = now;
        currentSegmentStartTimeRef.current = now;
        loadSettings();
        loadSprintTasks();
    }, [taskIds]);

    // Prevent hardware back button
    useEffect(() => {
        const onBackPress = () => {
            return true; // Stop default back navigation
        };
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, []);

    // Timer Effect
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (settings.showTimer && !isPaused) {
            interval = setInterval(() => {
                const now = Date.now();
                // Calculate total elapsed excluding paused time
                const currentElapsed = Math.floor((now - startTimeRef.current - totalPausedTimeRef.current) / 1000);
                setElapsedSeconds(currentElapsed);

                if (settings.autoBreakMode && settings.autoBreakWorkTime) {
                    const workSeconds = settings.autoBreakWorkTime * 60;
                    const completed = Math.floor(currentElapsed / workSeconds);
                    if (completed > intervalsCompletedRef.current && currentElapsed > 0) {
                        intervalsCompletedRef.current = completed;
                        setIntervalsCompleted(completed);
                        triggerAutoBreak();
                    }
                }
            }, 1000); // Check every second, though UI updates less frequently
        }
        return () => clearInterval(interval);
    }, [settings.showTimer, isPaused, settings.autoBreakMode, settings.autoBreakWorkTime]);

    // Pause Timeout Effect
    const [breakDuration, setBreakDuration] = useState(0); // 0 = indefinite/count up
    const [pauseElapsed, setPauseElapsed] = useState(0);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isPaused && breakPhase === 'active') {
            interval = setInterval(() => {
                const now = Date.now();
                const elapsed = Math.floor((now - pauseStartTimeRef.current) / 1000);
                setPauseElapsed(elapsed);

                if (breakDuration > 0) {
                    // Count down mode
                    const remaining = (breakDuration * 60) - elapsed;
                    if (remaining <= 0) {
                        handleResume();
                        Alert.alert("Break Over", "Your break time is up! Back to work.");
                    }
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isPaused, breakPhase, breakDuration]);

    const recordCurrentSegment = (endTime: number, explicitTitle?: string) => {
        const duration = Math.floor((endTime - currentSegmentStartTimeRef.current) / 1000);
        if (duration > 0) { // Only log meaningful segments
            let type: 'task' | 'break' | 'pause' = 'task';
            let title = explicitTitle || (tasks.length > 0 ? tasks[0].title : 'Unknown Task');

            if (isPaused) {
                type = breakPhase === 'active' ? 'break' : 'pause';
                title = type === 'break' ? 'Break' : 'Paused';
            }

            timelineRef.current.push({
                type,
                title,
                startTime: currentSegmentStartTimeRef.current,
                endTime,
                durationSeconds: duration
            });
        }
        currentSegmentStartTimeRef.current = endTime; // Start next segment
    };

    const handlePause = () => {
        const now = Date.now();
        recordCurrentSegment(now);
        setIsPaused(true);
        setBreakPhase('claiming');
        claimingStartTimeRef.current = now; // Track when pause actually started
        pauseStartTimeRef.current = now;
        setBreakDuration(0); // Default to indefinite
        setPauseElapsed(0);
    };

    const handleStartBreak = () => {
        const now = Date.now();
        recordCurrentSegment(now); // Close 'claiming/paused' segment
        setBreakPhase('active');
        pauseStartTimeRef.current = now; // Reset for break timer display
        setPauseElapsed(0);
        // Note: claimingStartTimeRef stays as-is — it tracks total pause time
    };

    const handleResume = () => {
        const now = Date.now();
        recordCurrentSegment(now); // Close 'pause' or 'break' segment
        // Use claimingStartTimeRef to include claiming phase in total paused time
        const pausedDuration = now - claimingStartTimeRef.current;
        totalPausedTimeRef.current += pausedDuration;
        setIsPaused(false);
        setBreakPhase('none');
    };

    const addBreakTime = (minutes: number) => {
        setBreakDuration(prev => {
            const newDuration = prev + minutes;
            // Guard: if elapsed already exceeds the new duration, auto-resume
            const currentElapsed = Math.floor((Date.now() - pauseStartTimeRef.current) / 1000);
            if (newDuration > 0 && currentElapsed >= newDuration * 60) {
                // Schedule resume on next tick to avoid setState-in-setState
                setTimeout(() => {
                    handleResume();
                    Alert.alert('Break Over', 'Your break time is up! Back to work.');
                }, 0);
            }
            return newDuration;
        });
    };

    const formatMinutesOnly = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        return `${mins}m`;
    };

    const formatCountdown = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const triggerAutoBreak = () => {
        const now = Date.now();
        recordCurrentSegment(now); // Close working segment
        setIsPaused(true);
        setBreakPhase('active');
        pauseStartTimeRef.current = now;
        setBreakDuration(settings.autoBreakDuration || 5);
        setPauseElapsed(0);
        Vibration.vibrate();
        Alert.alert("Break Time!", "Great job! Time for a short break.");
    };

    const formatTimerDisplay = () => {
        if (settings.autoBreakMode && settings.autoBreakWorkTime) {
            const workSeconds = settings.autoBreakWorkTime * 60;
            const remaining = Math.max(0, workSeconds - (elapsedSeconds % workSeconds));
            const actualRemaining = (elapsedSeconds > 0 && elapsedSeconds % workSeconds === 0) ? 0 : remaining;
            return formatCountdown(actualRemaining);
        }
        return formatMinutesOnly(elapsedSeconds);
    };

    const handleCompleteTask = async () => {
        if (!tasks[0]) return;

        const taskToComplete = tasks[0];
        setCompletedTasks(prev => [...prev, taskToComplete]);

        const now = Date.now();
        recordCurrentSegment(now); // Close this task segment before slicing

        // NOTE: Persistence happens in sprint-summary's handleFinish()
        // which handles completions, partial progress, subtasks, and archival.

        if (tasks.length <= 1) {
            finishSprint([...completedTasks, taskToComplete]);
        } else {
            // Remove first task
            setTasks(prev => prev.slice(1));
        }
    };

    const finishSprint = (finalCompletedTasks: Task[] = completedTasks) => {
        // Final duration calculation
        const now = Date.now();
        // Record very last segment if we haven't already
        if (currentSegmentStartTimeRef.current < now) {
            recordCurrentSegment(now);
        }

        // If we finish WHILE paused, we should not count the current pause duration?
        // Actually, if paused, we resume implicitly to finish.
        if (isPaused) {
            const pausedDuration = now - claimingStartTimeRef.current;
            totalPausedTimeRef.current += pausedDuration;
        }

        const duration = Math.round((now - startTimeRef.current - totalPausedTimeRef.current) / 1000);

        router.replace({
            pathname: '/sprint-summary',
            params: {
                duration: duration.toString(),
                tasks: JSON.stringify(finalCompletedTasks),
                timeline: JSON.stringify(timelineRef.current)
            }
        });
    };

    const currentTask = tasks[0];

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ width: 40 }} />
                <TouchableOpacity onPress={() => setTimerVisible(!timerVisible)} style={styles.headerCenter}>
                    {timerVisible && settings.showTimer ? (
                        <View style={{ alignItems: 'center' }}>
                            <Text style={styles.headerTimerText}>
                                {settings.autoBreakMode && settings.autoBreakWorkTime
                                    ? formatCountdown(Math.max(0, (settings.autoBreakWorkTime * 60) - (elapsedSeconds % (settings.autoBreakWorkTime * 60))))
                                    : formatMinutesOnly(elapsedSeconds)}
                            </Text>
                            {settings.autoBreakMode && (
                                <Text style={styles.headerElapsedText}>
                                    {formatMinutesOnly(elapsedSeconds)} ELAPSED
                                </Text>
                            )}
                        </View>
                    ) : (
                        <MaterialCommunityIcons name="clock-outline" size={24} color={THEME.textSecondary} />
                    )}
                </TouchableOpacity>

                {/* PAUSE BUTTON */}
                {settings.allowPause ? (
                    <TouchableOpacity onPress={handlePause} style={styles.pauseButton}>
                        <Ionicons name="pause" size={20} color="#333" />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 24 }} />
                )}
            </View>

            {/* Main Content Area */}
            <View style={styles.contentContainer}>

                {/* Current Task Card */}
                <View style={styles.cardContainer}>
                    {currentTask ? (
                        <>
                            <View style={styles.taskInfo}>
                                <Text style={styles.taskTitle}>{currentTask.title}</Text>
                            </View>

                            {/* Split Pill Control */}
                            <View style={styles.splitPillContainer}>
                                <TouchableOpacity
                                    style={styles.pillLeft}
                                    onPress={handleSwitchTask}
                                    activeOpacity={0.7}
                                    disabled={isPaused}
                                >
                                    <MaterialCommunityIcons name="swap-horizontal" size={24} color="#64748B" />
                                    <Text style={styles.pillTextLeft}>Switch</Text>
                                </TouchableOpacity>

                                <View style={styles.pillDivider} />

                                <TouchableOpacity
                                    style={styles.pillRight}
                                    onPress={handleCompleteTask}
                                    activeOpacity={0.7}
                                    disabled={isPaused}
                                >
                                    <Ionicons name="checkmark" size={24} color="#FFFFFF" />
                                    <Text style={styles.pillTextRight}>Complete</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <Text style={styles.emptyText}>Loading tasks...</Text>
                    )}
                </View>

                {/* Next Up List */}
                <View style={styles.nextUpContainer}>
                    <Text style={styles.nextUpLabel}>NEXT UP</Text>
                    <ScrollView style={styles.nextScroll} showsVerticalScrollIndicator={false}>
                        {tasks.slice(1).map((t, i) => (
                            <View key={t.id} style={styles.nextItem}>
                                <Text style={styles.nextTitle} numberOfLines={1}>{t.title}</Text>
                            </View>
                        ))}
                        {tasks.length <= 1 && (
                            <Text style={styles.noNextText}>Last task!</Text>
                        )}
                    </ScrollView>
                </View>

            </View>

            {/* PAUSE MODAL OVERLAY */}
            <Modal visible={isPaused} transparent animationType="fade">
                <View style={styles.pauseOverlay}>
                    <View style={styles.pauseCard}>
                        <View style={styles.pauseIconContainer}>
                            <Ionicons name="pause" size={32} color={THEME.accent} />
                        </View>
                        <Text style={styles.pauseTitle}>Sprint Paused</Text>

                        {breakPhase === 'claiming' ? (
                            <>
                                <Text style={styles.pauseSubtitle}>Configure your break time</Text>
                                <View style={styles.timerPreview}>
                                    <Text style={styles.timerPreviewText}>
                                        {formatCountdown(breakDuration * 60)}
                                    </Text>
                                </View>

                                {/* Accumulation Buttons */}
                                <View style={styles.limitButtonsRow}>
                                    {[1, 5, 15].map(m => (
                                        <TouchableOpacity
                                            key={m}
                                            style={styles.limitBtn}
                                            onPress={() => addBreakTime(m)}
                                        >
                                            <Text style={styles.limitBtnText}>+{m}m</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <TouchableOpacity onPress={() => setBreakDuration(0)}>
                                    <Text style={styles.cancelLimitText}>Reset to 0m</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.resumeButton} onPress={handleStartBreak}>
                                    <Text style={styles.resumeButtonText}>Start Break</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={[styles.resumeButton, { backgroundColor: '#F1F5F9', marginTop: 12 }]} onPress={handleResume}>
                                    <Text style={[styles.resumeButtonText, { color: '#64748B' }]}>Cancel (Resume Sprint)</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <Text style={styles.pauseSubtitle}>
                                    {breakDuration > 0 ? "Time Remaining" : "Time Paused"}
                                </Text>

                                <View style={styles.timerPreview}>
                                    <Text style={styles.timerPreviewText}>
                                        {breakDuration > 0
                                            ? formatCountdown(Math.max(0, (breakDuration * 60) - pauseElapsed))
                                            : formatCountdown(pauseElapsed)
                                        }
                                    </Text>
                                </View>

                                <TouchableOpacity style={styles.resumeButton} onPress={handleResume}>
                                    <Text style={styles.resumeButtonText}>End Break Early</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.bg,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: THEME.textPrimary,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
    },
    headerTimerText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: THEME.textPrimary,
        fontVariant: ['tabular-nums'],
    },
    headerElapsedText: {
        fontSize: 11,
        color: THEME.textSecondary,
        fontWeight: '600',
        marginTop: -2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    closeButton: {
        padding: 8,
    },
    pauseButton: {
        padding: 8,
        backgroundColor: '#E2E8F0',
        borderRadius: 20,
    },
    timerPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    timerText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: THEME.textPrimary,
        fontVariant: ['tabular-nums'],
    },
    contentContainer: {
        flex: 1,
        paddingTop: 20,
    },
    cardContainer: {
        marginHorizontal: 20,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 320, // Taller card
        marginBottom: 30,
    },
    taskInfo: {
        alignItems: 'center',
        width: '100%',
        flex: 1,
        justifyContent: 'center',
    },
    currentLabel: {
        fontSize: 12,
        color: THEME.accent,
        fontWeight: 'bold',
        marginBottom: 16,
        letterSpacing: 1,
    },
    taskTitle: {
        fontSize: 28, // Bigger title
        fontWeight: 'bold',
        color: THEME.textPrimary,
        textAlign: 'center',
        marginBottom: 12,
        lineHeight: 34,
    },
    taskEstimate: {
        fontSize: 18,
        color: THEME.textSecondary,
        fontWeight: '500',
    },
    emptyText: {
        textAlign: 'center',
        color: THEME.textSecondary,
        fontSize: 16,
    },

    // Pomodoro Styles
    hugeTimer: {
        fontSize: 48,
        fontWeight: '900',
        color: '#EF4444',
        fontVariant: ['tabular-nums'],
        marginBottom: -4,
    },
    pomodoroPhaseLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#EF4444',
        letterSpacing: 2,
        marginBottom: 24,
    },
    standardHugeTimer: {
        fontSize: 48,
        fontWeight: '900',
        color: THEME.textPrimary,
        fontVariant: ['tabular-nums'],
        marginBottom: -4,
    },
    standardPhaseLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: THEME.textSecondary,
        letterSpacing: 2,
        marginBottom: 24,
    },

    // Split Pill Styles
    splitPillContainer: {
        flexDirection: 'row',
        width: '100%',
        height: 72, // Big touch target
        backgroundColor: '#F1F5F9', // Light Slate for the Switch side
        borderRadius: 36, // Fully rounded pill
        overflow: 'hidden',
        marginTop: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    pillLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#F8FAFC', // Slightly lighter than container
    },
    pillRight: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: THEME.success, // Green
    },
    pillDivider: {
        width: 1,
        backgroundColor: '#E2E8F0',
    },
    pillTextLeft: {
        fontSize: 18,
        fontWeight: '600',
        color: '#64748B', // Slate text
    },
    pillTextRight: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF', // White text
    },

    nextUpContainer: {
        flex: 1,
        paddingHorizontal: 30,
        backgroundColor: 'rgba(255,255,255,0.5)', // Subtle backdrop?
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingTop: 30,
    },
    nextUpLabel: {
        fontSize: 12,
        color: THEME.textSecondary,
        fontWeight: 'bold',
        marginBottom: 16,
        letterSpacing: 1,
    },
    nextScroll: {
        flex: 1,
    },
    nextItem: {
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    nextTitle: {
        fontSize: 16,
        color: '#64748B',
    },
    noNextText: {
        fontStyle: 'italic',
        color: '#94A3B8',
        marginTop: 10,
    },

    // Pause Modal
    pauseOverlay: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    pauseCard: {
        width: '100%',
        maxWidth: 320,
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 30,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    pauseIconContainer: {
        width: 60, height: 60,
        borderRadius: 30,
        backgroundColor: '#EFF6FF',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
    },
    pauseTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 8,
    },
    pauseSubtitle: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 24,
    },
    timerPreview: {
        marginBottom: 30,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
    },
    timerPreviewText: {
        fontSize: 32,
        fontWeight: '700',
        color: THEME.accent,
        fontVariant: ['tabular-nums'],
    },
    resumeButton: {
        width: '100%',
        backgroundColor: THEME.accent,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 12,
    },
    resumeButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFF',
    },
    limitLabel: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '600',
        marginBottom: 8,
        textTransform: 'uppercase'
    },
    limitButtonsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 24,
    },
    limitBtn: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        minWidth: 50,
        alignItems: 'center'
    },
    limitBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569'
    },
    cancelLimitText: {
        fontSize: 14,
        color: THEME.accent,
        marginBottom: 24,
        fontWeight: '500'
    }
});
