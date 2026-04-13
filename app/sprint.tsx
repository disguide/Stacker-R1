import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, Vibration, BackHandler, AppState, AppStateStatus, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
    bg: '#F0F9FF', // Clean pale blue background
    textPrimary: '#0F172A', // Navy/Slate
    textSecondary: '#64748B',
    accent: '#0EA5E9', // Sky Blue
    success: '#0EA5E9',
    border: 'rgba(255, 255, 255, 0.5)', 
    cardBg: 'rgba(255, 255, 255, 0.98)',
};

export default function SprintScreen() {
    const insets = useSafeAreaInsets();
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

    const MODAL_THEME = {
        bg: '#F0F9FF', // Very light blue
        accent: '#0EA5E9', // Sky blue
        itemBg: '#FFFFFF',
        circleBorder: 'rgba(14, 165, 233, 0.08)',
        smallCircleBg: '#FFFFFF',
        highlight: '#E0F2FE', // Light blue tint for +5
    };

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
        
        // Reset timing refs
        workSecondsRef.current = 0;
        breakSecondsRef.current = 0;
        totalSecondsRef.current = 0;
        intervalWorkSecondsRef.current = 0;
        setElapsedSeconds(0);
        
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
        if (settings.maxDurationEnabled && settings.maxDurationMinutes && settings.maxDurationMinutes > 0) {
            const limitSec = (settings.maxDurationMinutes || 0) * 60;
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
        if (!isPaused && settings.autoBreakMode && settings.autoBreakWorkTime && settings.autoBreakWorkTime > 0) {
            const limitSec = (settings.autoBreakWorkTime || 0) * 60;
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
        if (settings.maxDurationEnabled && settings.maxDurationMinutes && settings.maxDurationMinutes > 0) {
            const limitSec = (settings.maxDurationMinutes || 0) * 60;
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
            setElapsedSeconds(totalSecondsRef.current);
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
                setElapsedSeconds(totalSecondsRef.current);

                Alert.alert("Break Over", "You're all caught up! Back to work.");
            } else {
                // Still in break
                breakSecondsRef.current += gapSeconds;
                setPauseElapsed(totalBreakElapsed);
                setElapsedSeconds(totalSecondsRef.current);
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
                    setElapsedSeconds(totalSecondsRef.current);

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
                    setElapsedSeconds(totalSecondsRef.current);

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
            const currentWork = intervalWorkSecondsRef.current;
            const remaining = Math.max(0, workSeconds - (currentWork % workSeconds));
            const actualRemaining = (currentWork > 0 && currentWork % workSeconds === 0) ? 0 : remaining;
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

    const toggleSubtask = (subtaskId: string) => {
        if (!tasks[0]) return;
        
        const now = Date.now();
        const subtask = tasks[0].subtasks?.find(st => st.id === subtaskId);
        const subtaskTitle = subtask ? subtask.title : 'Subtask';
        
        // Record the switch to this subtask focus
        recordCurrentSegment(now, `Subtask: ${subtaskTitle}`);

        setTasks(prev => {
            if (!prev[0]) return prev;
            const updatedTask = { ...prev[0] };
            updatedTask.subtasks = updatedTask.subtasks?.map(st => 
                st.id === subtaskId ? { ...st, completed: !st.completed } : st
            );
            return [updatedTask, ...prev.slice(1)];
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
                        <Ionicons name="pause" size={20} color={MODAL_THEME.accent} />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 44 }} />
                )}
            </View>

            {/* Main Content Area */}
            <View style={styles.contentContainer}>

                {/* Current Task Card */}
                <View style={styles.frostedCard}>
                    {currentTask ? (
                        <>
                            <View style={styles.taskInfo}>
                                <Text style={styles.taskTitle}>{currentTask.title}</Text>
                                
                                {currentTask.subtasks && currentTask.subtasks.length > 0 && (
                                    <View style={styles.subtaskContainer}>
                                        {currentTask.subtasks.map((st) => (
                                            <TouchableOpacity 
                                                key={st.id} 
                                                style={styles.subtaskRow}
                                                onPress={() => toggleSubtask(st.id)}
                                            >
                                                <Ionicons 
                                                    name={st.completed ? "checkmark-circle" : "ellipse-outline"} 
                                                    size={20} 
                                                    color={st.completed ? "#4ADE80" : "#94A3B8"} 
                                                />
                                                <Text style={[
                                                    styles.subtaskTitle, 
                                                    st.completed && styles.subtaskCompletedText
                                                ]}>
                                                    {st.title}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
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
                        {tasks.slice(1).map((t, i) => {
                            const opacity = Math.max(0, 1 - (i * 0.35));
                            return (
                                <View key={t.id} style={[styles.nextItem, { opacity }]}>
                                    <Text style={styles.nextTitle} numberOfLines={1}>{t.title}</Text>
                                </View>
                            );
                        })}
                        {tasks.length <= 1 && (
                            <Text style={styles.noNextText}>Last task!</Text>
                        )}
                    </ScrollView>
                </View>

            </View>

            {/* PAUSE MODAL OVERLAY (BLUE CIRCLES) */}
            <Modal visible={isPaused} transparent={true} animationType="fade">
                <View style={[styles.pauseBackdrop, { backgroundColor: MODAL_THEME.bg }]}>
                    <SafeAreaView style={styles.pauseOverlay}>
                        {/* Top Left Exit Button */}
                        <TouchableOpacity style={styles.modalExitButton} onPress={handleResume}>
                            <Ionicons name="close-outline" size={28} color={MODAL_THEME.accent} />
                        </TouchableOpacity>

                        <View style={styles.forestContent}>
                            {/* Big Timer Circle */}
                            <View style={styles.bigCircle}>
                                {breakPhase === 'claiming' && breakDuration === 0 ? (
                                    <Ionicons name="flash-outline" size={60} color="rgba(14, 165, 233, 0.15)" />
                                ) : (
                                    <>
                                        <Text style={styles.forestTimerText}>
                                            {breakPhase === 'claiming' ? (
                                                formatCountdown(breakDuration * 60)
                                            ) : (
                                                breakDuration > 0
                                                    ? formatCountdown(Math.max(0, (breakDuration * 60) - pauseElapsed))
                                                    : formatCountdown(pauseElapsed)
                                            )}
                                        </Text>
                                        <Text style={styles.forestTimerLabel}>REMAINING</Text>
                                    </>
                                )}
                            </View>

                            {breakPhase === 'claiming' && (
                                <View style={styles.forestSmallCirclesRow}>
                                    <View style={styles.forestSmallCircleContainer}>
                                        <TouchableOpacity style={styles.smallCircle} onPress={() => addBreakTime(1)}>
                                            <Text style={styles.smallCircleText}>+1</Text>
                                        </TouchableOpacity>
                                        <Text style={styles.smallCircleLabel}>MIN</Text>
                                    </View>

                                    <View style={styles.forestSmallCircleContainer}>
                                        <TouchableOpacity style={styles.smallCircle} onPress={() => addBreakTime(5)}>
                                            <Text style={styles.smallCircleText}>+5</Text>
                                        </TouchableOpacity>
                                        <Text style={styles.smallCircleLabel}>MIN</Text>
                                    </View>

                                    <View style={styles.forestSmallCircleContainer}>
                                        <TouchableOpacity style={styles.smallCircle} onPress={() => addBreakTime(15)}>
                                            <Text style={styles.smallCircleText}>+15</Text>
                                        </TouchableOpacity>
                                        <Text style={styles.smallCircleLabel}>MIN</Text>
                                    </View>
                                </View>
                            )}

                            {/* Consistently styled Forest Button */}
                            <TouchableOpacity 
                                style={styles.forestPillButton} 
                                onPress={breakPhase === 'claiming' ? handleStartBreak : handleResume}
                            >
                                <Text style={styles.forestPillText}>
                                    {breakPhase === 'claiming' ? 'Start' : 'Back to Work'}
                                </Text>
                                <Ionicons 
                                    name="arrow-forward" 
                                    size={20} 
                                    color="#FFF" 
                                    style={{ marginLeft: 10 }} 
                                />
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
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
        minHeight: 80, // Allow expansion for notch
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
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
        fontWeight: '900',
        color: THEME.textSecondary,
        letterSpacing: 1.5,
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
    pauseButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#E0F2FE', // Light blue highlight
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    contentContainer: {
        flex: 1,
        paddingTop: 20,
    },
    frostedCard: {
        backgroundColor: THEME.cardBg,
        marginHorizontal: 20,
        padding: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.6)', // Glass shine
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
        elevation: 12,
        alignItems: 'center',
    },
    taskInfo: {
        alignItems: 'flex-start',
        width: '100%',
        paddingVertical: 32,
        paddingHorizontal: 12,
    },
    taskTitle: {
        fontSize: 26,
        fontWeight: '700',
        color: THEME.textPrimary,
        textAlign: 'left',
        marginBottom: 8,
    },
    subtaskContainer: {
        marginTop: 16,
        width: '100%',
    },
    subtaskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        gap: 12,
    },
    subtaskTitle: {
        fontSize: 18,
        color: THEME.textPrimary,
        fontWeight: '500',
        flex: 1,
    },
    subtaskCompletedText: {
        color: '#94A3B8',
        textDecorationLine: 'line-through',
    },
    emptyText: {
        textAlign: 'center',
        color: THEME.textSecondary,
        fontSize: 16,
    },
    splitPillContainer: {
        flexDirection: 'row',
        width: '100%',
        height: 60,
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    pillLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#FFF',
    },
    pillRight: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: THEME.success,
    },
    pillDivider: {
        width: 1,
        backgroundColor: '#E2E8F0',
    },
    pillTextLeft: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748B',
    },
    pillTextRight: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    nextUpContainer: {
        flex: 1,
        paddingHorizontal: 32,
        paddingTop: 32,
    },
    nextUpLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: THEME.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: 16,
    },
    nextScroll: {
        flex: 1,
    },
    nextItem: {
        paddingVertical: 14,
    },
    nextTitle: {
        fontSize: 16,
        color: '#64748B',
        fontWeight: '500',
    },
    noNextText: {
        fontStyle: 'italic',
        color: '#94A3B8',
    },
    pauseBackdrop: { flex: 1 },
    pauseOverlay: { flex: 1 },
    modalExitButton: { position: 'absolute', top: 20, left: 20, zIndex: 10, padding: 12 },
    forestContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 60, paddingBottom: 40 },
    bigCircle: {
        width: 280,
        height: 280,
        borderRadius: 140,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 15,
        borderColor: 'rgba(26, 59, 26, 0.05)',
        shadowColor: "#1A3B1A",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 8,
    },
    forestTimerText: { fontSize: 80, fontWeight: '400', color: '#1A3B1A', fontVariant: ['tabular-nums'] },
    forestTimerLabel: { fontSize: 13, color: '#1A3B1A', letterSpacing: 3, fontWeight: '600', marginTop: -5 },
    
    forestSmallCirclesRow: { flexDirection: 'row', gap: 20, alignItems: 'center' },
    forestSmallCircleContainer: { alignItems: 'center', gap: 8 },
    smallCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.02)',
    },
    smallCircleText: { fontSize: 18, fontWeight: '700', color: '#1A3B1A' },
    smallCircleLabel: { fontSize: 10, color: '#1A3B1A', fontWeight: '800', opacity: 0.6, letterSpacing: 1 },
    
    forestPillButton: {
        flexDirection: 'row',
        backgroundColor: '#0EA5E9',
        paddingVertical: 20,
        paddingHorizontal: 40,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 10,
    },
    forestPillText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
});
