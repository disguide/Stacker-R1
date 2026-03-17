import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, Vibration, BackHandler, AppState, AppStateStatus, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';
import * as Notifications from 'expo-notifications';

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
    
    // Sync Refs to avoid stale closures in the timer loop
    const tasksRef = useRef<Task[]>([]);
    const completedTasksRef = useRef<Task[]>([]);
    useEffect(() => { tasksRef.current = tasks; }, [tasks]);
    useEffect(() => { completedTasksRef.current = completedTasks; }, [completedTasks]);

    // Settings & Timer State
    const [settings, setSettings] = useState<SprintSettings>({ showTimer: true, allowPause: true });
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const isPausedRef = useRef(false);
    const [breakPhase, setBreakPhase] = useState<'none' | 'claiming' | 'active'>('none');
    const breakPhaseRef = useRef<'none' | 'claiming' | 'active'>('none');
    const [intervalsCompleted, setIntervalsCompleted] = useState(0);
    const [timerVisible, setTimerVisible] = useState(false);

    const [breakDuration, setBreakDuration] = useState(0); // 0 = indefinite/count up
    const breakDurationRef = useRef(0);
    const [pauseElapsed, setPauseElapsed] = useState(0);
    const pauseElapsedRef = useRef(0);

    // Sync Refs
    useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
    useEffect(() => { breakPhaseRef.current = breakPhase; }, [breakPhase]);
    useEffect(() => { breakDurationRef.current = breakDuration; }, [breakDuration]);
    useEffect(() => { pauseElapsedRef.current = pauseElapsed; }, [pauseElapsed]);

    // Timing Refs (Buckets)
    const workSecondsRef = useRef<number>(0);
    const breakSecondsRef = useRef<number>(0);
    const totalSecondsRef = useRef<number>(0);
    const intervalWorkSecondsRef = useRef<number>(0); // For Auto-Break tracking

    const startTimeRef = useRef<number>(Date.now());
    const intervalsCompletedRef = useRef<number>(0);

    // Timeline Tracking
    const timelineRef = useRef<TimelineEvent[]>([]);
    const currentSegmentStartTimeRef = useRef<number>(Date.now());
    
    // Background Sync
    const backgroundTimeRef = useRef<number | null>(null);
    const appStateRef = useRef(AppState.currentState);

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

    // Initial Load & Permissions
    useEffect(() => {
        const now = Date.now();
        startTimeRef.current = now;
        currentSegmentStartTimeRef.current = now;
        timelineRef.current = []; // RESET timeline for new sprint
        
        loadSettings();
        loadSprintTasks();
        requestNotificationPermissions();

        return () => {
            cancelTimerNotifications();
        };
    }, [taskIds]);

    const requestNotificationPermissions = async () => {
        if (Platform.OS === 'web') return;
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
            console.warn('Notification permissions not granted');
        }
    };

    // Prevent hardware back button & AppState Listener
    useEffect(() => {
        const onBackPress = () => {
            return true; // Stop default back navigation
        };
        const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        
        const stateSub = AppState.addEventListener('change', handleAppStateChange);
        
        return () => {
            backSub.remove();
            stateSub.remove();
        };
    }, [settings, isPaused, breakPhase]); // Re-bind when state affecting notifications changes

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
        if (appStateRef.current.match(/active/) && nextAppState === 'background') {
            // App going to background
            const now = Date.now();
            recordCurrentSegment(now); // Close active segment before "hibernating"
            backgroundTimeRef.current = now;
            scheduleTimerNotifications();
        } else if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
            // App coming to foreground
            syncFromBackground();
            cancelTimerNotifications();
        }
        appStateRef.current = nextAppState;
    };

    const scheduleTimerNotifications = async () => {
        if (Platform.OS === 'web') return;
        await cancelTimerNotifications();

        // 1. Schedule Goal End Notification
        if (settings.maxDurationEnabled && settings.maxDurationMinutes > 0) {
            const limitSec = settings.maxDurationMinutes * 60;
            const remainingSec = limitSec - totalSecondsRef.current;
            if (remainingSec > 0) {
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: "Sprint Complete",
                        body: `You've reached your ${settings.maxDurationMinutes} minute goal!`,
                        sound: true,
                    },
                    trigger: { 
                        seconds: remainingSec,
                        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL 
                    },
                    identifier: 'sprint-end',
                });
            }
        }

        // 2. Schedule Auto-Break Notification
        if (!isPaused && settings.autoBreakMode && settings.autoBreakWorkTime > 0) {
            const limitSec = settings.autoBreakWorkTime * 60;
            const remainingSec = limitSec - (intervalWorkSecondsRef.current % limitSec);
            if (remainingSec > 0) {
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: "Break Time!",
                        body: "Time for a short break.",
                        sound: true,
                    },
                    trigger: { 
                        seconds: remainingSec,
                        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL 
                    },
                    identifier: 'auto-break',
                });
            }
        }

        // 3. Schedule Break Over Notification (if currently in a break)
        if (isPausedRef.current && breakPhaseRef.current === 'active' && breakDurationRef.current > 0) {
            const remainingSec = (breakDurationRef.current * 60) - pauseElapsedRef.current;
            if (remainingSec > 0) {
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: "Break Over",
                        body: "Time to get back to work!",
                        sound: true,
                    },
                    trigger: { 
                        seconds: Math.max(1, Math.floor(remainingSec)),
                        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL 
                    },
                    identifier: 'break-end',
                });
            }
        }
    };

    const cancelTimerNotifications = async () => {
        if (Platform.OS === 'web') return;
        await Notifications.cancelAllScheduledNotificationsAsync();
    };

    const syncFromBackground = () => {
        if (!backgroundTimeRef.current) return;
        const now = Date.now();
        const gapSeconds = Math.floor((now - backgroundTimeRef.current) / 1000);
        backgroundTimeRef.current = null;

        if (gapSeconds <= 0) return;

        // 1. Catch up Total Time (Absolute)
        totalSecondsRef.current += gapSeconds;

        // 2. Check if Goal End was reached while away
        if (settings.maxDurationEnabled && settings.maxDurationMinutes > 0) {
            const limitSec = settings.maxDurationMinutes * 60;
            if (totalSecondsRef.current >= limitSec) {
                // Record the "away" segment before ending
                recordCurrentSegment(now, isPaused ? "Break (Background)" : "Work (Background)");
                
                // Goal reached! Show the alert immediately on return
                Alert.alert(
                    "Sprint Complete", 
                    `You've reached your ${settings.maxDurationMinutes} minute goal while you were away!`,
                    [{ 
                        text: "View Summary", 
                        onPress: () => {
                            const finalTasks = [...completedTasksRef.current, ...tasksRef.current];
                            finishSprint(finalTasks);
                        } 
                    }]
                );
                return; // Stop sync here, user needs to pick summary
            }
        }

        // 3. Sync Work/Break Buckets
        if (!isPausedRef.current) {
            // WORK SYNC
            const workLimitSec = (settings.autoBreakWorkTime || 25) * 60;
            const remainingToBreak = workLimitSec - (intervalWorkSecondsRef.current % workLimitSec);

            if (settings.autoBreakMode && gapSeconds >= remainingToBreak) {
                // We passed a break point while in background
                const transitionTime = (backgroundTimeRef.current || now) + (remainingToBreak * 1000);
                
                // 1. Record the Work part of background time
                recordCurrentSegment(transitionTime, "Work (Away)");
                
                workSecondsRef.current += remainingToBreak;
                intervalWorkSecondsRef.current = 0;
                
                const leftover = gapSeconds - remainingToBreak;
                breakSecondsRef.current += leftover;
                
                // Set app state to paused
                setIsPaused(true);
                setBreakPhase('active');
                setBreakDuration(settings.autoBreakDuration || 5);
                setPauseElapsed(leftover);

                // Note: The next segment (Break Away) will be recorded on next action or finish
            } else {
                // Still in work phase
                workSecondsRef.current += gapSeconds;
                intervalWorkSecondsRef.current += gapSeconds;
            }
            setElapsedSeconds(workSecondsRef.current);
        } else {
            // BREAK SYNC
            const totalBreakElapsed = pauseElapsedRef.current + gapSeconds;
            const breakLimitSec = (breakDurationRef.current || 0) * 60;

            if (breakLimitSec > 0 && totalBreakElapsed >= breakLimitSec) {
                // Break ended while away!
                const transitionTime = (backgroundTimeRef.current || now) + ((breakLimitSec - pauseElapsedRef.current) * 1000);
                
                // 1. Record the Break part
                recordCurrentSegment(transitionTime, "Break (Away)");

                breakSecondsRef.current += (breakLimitSec - pauseElapsedRef.current);
                setPauseElapsed(breakLimitSec);
                
                // Add the leftover time back to work
                const leftover = totalBreakElapsed - breakLimitSec;
                workSecondsRef.current += leftover;
                intervalWorkSecondsRef.current += leftover;
                
                setIsPaused(false);
                setBreakPhase('none');
                setElapsedSeconds(workSecondsRef.current);

                Alert.alert("Break Over", "You're all caught up! Back to work.");
            } else {
                // Still in break
                breakSecondsRef.current += gapSeconds;
                setPauseElapsed(totalBreakElapsed);
            }
        }
        
        // Final catch-up: If we didn't end the sprint, the current segment start time needs to be updated to NOW
        currentSegmentStartTimeRef.current = now;
    };

    // Timer Effect (The Single Heartbeat)
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (settings.showTimer) {
            interval = setInterval(() => {
                totalSecondsRef.current += 1;

                if (!isPaused) {
                    // WORK TICK
                    workSecondsRef.current += 1;
                    intervalWorkSecondsRef.current += 1;
                    setElapsedSeconds(workSecondsRef.current);

                    // Auto-Break Check (Work-Only)
                    // GUARD: only if mode is on AND setting > 0
                    if (settings.autoBreakMode && settings.autoBreakWorkTime && settings.autoBreakWorkTime > 0) {
                        const workSecondsLimit = settings.autoBreakWorkTime * 60;
                        if (intervalWorkSecondsRef.current >= workSecondsLimit) {
                            intervalWorkSecondsRef.current = 0; // Reset for next interval
                            triggerAutoBreak();
                        }
                    }
                } else {
                    // BREAK TICK
                    breakSecondsRef.current += 1;
                    const nextPauseElapsed = pauseElapsedRef.current + 1;
                    setPauseElapsed(nextPauseElapsed);
                    pauseElapsedRef.current = nextPauseElapsed;

                    // Break Countdown Check
                    if (breakPhaseRef.current === 'active' && breakDurationRef.current > 0) {
                        if (nextPauseElapsed >= breakDurationRef.current * 60) {
                            handleResume();
                            Vibration.vibrate([0, 500, 200, 500]);
                            Alert.alert('Break Over', 'Your break time is up! Back to work.');
                        }
                    }
                }

                // Sprint End Check (Absolute / Wall-Clock)
                // GUARD: only if enabled AND minutes > 0
                if (settings.maxDurationEnabled && settings.maxDurationMinutes && settings.maxDurationMinutes > 0) {
                    const limitSeconds = settings.maxDurationMinutes * 60;
                    if (totalSecondsRef.current >= limitSeconds) {
                        clearInterval(interval);
                        Alert.alert(
                            "Sprint Complete", 
                            `You've reached your ${settings.maxDurationMinutes} minute goal! Great work.`,
                            [{ 
                                text: "View Summary", 
                                onPress: () => {
                                    // Include ALL tasks (using REFS to avoid stale closures)
                                    const finalTasks = [...completedTasksRef.current, ...tasksRef.current];
                                    finishSprint(finalTasks);
                                } 
                            }]
                        );
                    }
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [settings.showTimer, isPaused, breakPhase, breakDuration, settings.autoBreakMode, settings.autoBreakWorkTime, settings.maxDurationEnabled, settings.maxDurationMinutes]);
    // NOTE: Removed 'pauseElapsed' from dependency to prevent timer restarts

    const recordCurrentSegment = (endTime: number, explicitTitle?: string) => {
        const duration = Math.floor((endTime - currentSegmentStartTimeRef.current) / 1000);
        if (duration > 0) { // Only log meaningful segments
            let type: 'task' | 'break' | 'pause' = 'task';
            let title = explicitTitle || (tasksRef.current.length > 0 ? tasksRef.current[0].title : 'Unknown Task');

            if (isPausedRef.current) {
                type = breakPhaseRef.current === 'active' ? 'break' : 'pause';
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
        setBreakDuration(0); // Default to indefinite
        setPauseElapsed(0);
    };

    const handleStartBreak = () => {
        const now = Date.now();
        recordCurrentSegment(now); // Close 'claiming/paused' segment
        setBreakPhase('active');
        setPauseElapsed(0);
    };

    const handleResume = () => {
        const now = Date.now();
        recordCurrentSegment(now); // Close 'pause' or 'break' segment
        setIsPaused(false);
        setBreakPhase('none');
    };

    const addBreakTime = (minutes: number) => {
        setBreakDuration(prev => {
            const newDuration = prev + minutes;
            // Guard: if elapsed already exceeds the new duration, auto-resume
            if (newDuration > 0 && pauseElapsedRef.current >= newDuration * 60) {
                // Schedule resume on next tick to avoid setState-in-setState
                setTimeout(() => {
                    handleResume();
                    Vibration.vibrate([0, 500, 200, 500]);
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

        const taskToComplete = { ...tasks[0], completed: true }; // Explicitly mark as completed
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

    const finishSprint = (finalTasks: Task[] = [...completedTasks, ...tasks]) => {
        const now = Date.now();
        if (currentSegmentStartTimeRef.current < now) {
            recordCurrentSegment(now);
        }

        router.replace({
            pathname: '/sprint-summary',
            params: {
                duration: workSecondsRef.current.toString(), // Total Work Time
                totalDuration: totalSecondsRef.current.toString(), // Wall-Clock Time
                breakDuration: breakSecondsRef.current.toString(), // Total Break Time
                tasks: JSON.stringify(finalTasks),
                timeline: JSON.stringify(timelineRef.current)
            }
        });
    };

    const currentTask = tasks[0];

    // Safe Dashboard Calculations
    const autoBreakWorkLimit = (Number(settings.autoBreakWorkTime) || 0) * 60;
    const nextBreakSeconds = autoBreakWorkLimit > 0 
        ? Math.max(0, autoBreakWorkLimit - ((Number(intervalWorkSecondsRef.current) || 0) % autoBreakWorkLimit)) 
        : 0;
    
    const goalMaxLimit = (Number(settings.maxDurationMinutes) || 0) * 60;
    const goalRemainingSeconds = goalMaxLimit > 0 
        ? Math.max(0, goalMaxLimit - (Number(totalSecondsRef.current) || 0)) 
        : 0;

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ width: 40 }} />
                <TouchableOpacity onPress={() => setTimerVisible(!timerVisible)} style={styles.headerCenter}>
                    {timerVisible && settings.showTimer ? (
                        <View style={styles.dashboardContainer}>
                            <View style={styles.dashboardItem}>
                                <Text style={styles.dashboardLabel}>ELAPSED</Text>
                                <Text style={styles.dashboardValue}>{formatMinutesOnly(elapsedSeconds)}</Text>
                            </View>

                            {settings.autoBreakMode && autoBreakWorkLimit > 0 && (
                                <>
                                    <View style={styles.dashboardDivider} />
                                    <View style={styles.dashboardItem}>
                                        <Text style={styles.dashboardLabel}>NEXT BREAK</Text>
                                        <Text style={styles.dashboardValue}>{formatCountdown(nextBreakSeconds)}</Text>
                                    </View>
                                </>
                            )}

                            {settings.maxDurationEnabled && goalMaxLimit > 0 && (
                                <>
                                    <View style={styles.dashboardDivider} />
                                    <View style={styles.dashboardItem}>
                                        <Text style={styles.dashboardLabel}>GOAL END</Text>
                                        <Text style={styles.dashboardValue}>{formatCountdown(goalRemainingSeconds)}</Text>
                                    </View>
                                </>
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
            <Modal visible={isPaused} transparent={false} animationType="fade">
                <SafeAreaView style={styles.pauseOverlay}>
                    {/* Top Left Exit Button */}
                    <TouchableOpacity style={styles.modalExitButton} onPress={handleResume}>
                        <Ionicons name="close" size={32} color="#94A3B8" />
                    </TouchableOpacity>

                    {breakPhase === 'claiming' ? (
                        <View style={styles.pauseContentCenter}>
                            <View style={styles.timerPreview}>
                                <Text style={styles.timerPreviewText}>
                                    {formatCountdown(breakDuration * 60)}
                                </Text>
                            </View>

                            {/* Accumulation Buttons */}
                            <View style={styles.limitButtonsRow}>
                                <TouchableOpacity style={styles.limitBtn} onPress={() => addBreakTime(1)}>
                                    <Text style={styles.limitBtnText}>+1</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.limitBtn} onPress={() => addBreakTime(5)}>
                                    <Text style={styles.limitBtnText}>+5</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.limitBtn} onPress={() => addBreakTime(15)}>
                                    <Text style={styles.limitBtnText}>+15</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity onPress={() => setBreakDuration(0)} style={{ marginBottom: 40, padding: 10 }}>
                                <Text style={styles.cancelLimitText}>Reset</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.resumeButton} onPress={handleStartBreak}>
                                <Text style={styles.resumeButtonText}>Start</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.pauseContentCenter}>
                            <View style={styles.timerPreview}>
                                <Text style={styles.timerPreviewText}>
                                    {breakDuration > 0
                                        ? formatCountdown(Math.max(0, (breakDuration * 60) - pauseElapsed))
                                        : formatCountdown(pauseElapsed)
                                    }
                                </Text>
                            </View>

                            <TouchableOpacity style={styles.resumeButton} onPress={handleResume}>
                                <Text style={styles.resumeButtonText}>End break</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </SafeAreaView>
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
    dashboardContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    dashboardItem: {
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    dashboardLabel: {
        fontSize: 8,
        fontWeight: '800',
        color: THEME.textSecondary,
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    dashboardValue: {
        fontSize: 14,
        fontWeight: '700',
        color: THEME.textPrimary,
        fontVariant: ['tabular-nums'],
    },
    dashboardDivider: {
        width: 1,
        height: 20,
        backgroundColor: '#E2E8F0',
    },
    closeButton: {
        padding: 8,
    },
    pauseButton: {
        padding: 8,
        backgroundColor: '#E2E8F0',
        borderRadius: 12,
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
        borderRadius: 12, // Fully rounded pill -> rounded rectangle
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
        backgroundColor: '#F8FAFC', // Relaxed, full screen cover
    },
    modalExitButton: {
        position: 'absolute',
        top: 20,
        left: 20,
        zIndex: 10,
        padding: 12, // Larger touch target
    },
    pauseContentCenter: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 30,
        width: '100%',
    },
    timerPreview: {
        marginBottom: 50,
        alignItems: 'center',
    },
    timerPreviewText: {
        fontSize: 80, // Even bigger
        fontWeight: '300', // Relaxed, thin font
        color: '#334155', // Softer
        fontVariant: ['tabular-nums'],
    },
    limitButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 20,
    },
    limitBtn: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#CBD5E0',
        minWidth: 70,
        alignItems: 'center'
    },
    limitBtnText: {
        fontSize: 18,
        fontWeight: '400',
        color: '#64748B'
    },
    cancelLimitText: {
        fontSize: 16,
        color: '#94A3B8',
        fontWeight: '400',
    },
    resumeButton: {
        width: '100%',
        maxWidth: 240, // Keeps it comfortably sized
        backgroundColor: 'transparent', 
        borderWidth: 1,
        borderColor: '#94A3B8',
        paddingVertical: 18,
        borderRadius: 12, // Rounded rectangle
        alignItems: 'center',
    },
    resumeButtonText: {
        fontSize: 18,
        fontWeight: '400',
        color: '#475569',
    },
});
