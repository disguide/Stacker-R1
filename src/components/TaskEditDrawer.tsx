import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TextInput,
    TouchableOpacity,
    Animated,
    PanResponder,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ScrollView,
    Pressable
} from 'react-native';
import RecurrencePickerModal from './RecurrencePickerModal';
import { StorageService, Task, ColorDefinition, RecurrenceRule } from '../services/storage';
import TaskFeatureCarousel, { FeatureKey } from './TaskFeatureCarousel';
import TaskEditFeatureGrid from '../features/tasks/components/TaskEditFeatureGrid';
import TaskEditCarousel from '../features/tasks/components/TaskEditCarousel';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Switch } from 'react-native';

import { SCREEN_HEIGHT, SCREEN_WIDTH, THEME, styles } from '../features/tasks/styles/taskEditDrawerStyles';

import useTaskReminders from '../features/tasks/hooks/useTaskReminders';

const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`;
};


interface TaskEditDrawerProps {
    visible: boolean;
    task: Task | null;
    onSave: (updatedTask: Task) => void;
    onClose: () => void;
    onRequestCalendar: (currentDeadline: string | null) => void;
    onRequestDuration: () => void;
    onRequestTime: (currentDeadline: string | null) => void;

    // Color Props
    userColors?: ColorDefinition[];
    onRequestColorSettings?: () => void;
    initialActiveFeature?: FeatureKey | null;
    isSubtask?: boolean;
}

export default function TaskEditDrawer({
    visible,
    task,
    onSave,
    onClose,
    onRequestCalendar,
    onRequestDuration,
    onRequestTime,
    userColors,
    onRequestColorSettings,
    initialActiveFeature,
    isSubtask
}: TaskEditDrawerProps) {
    // Debug Log
    // console.log('[TaskEditDrawer] Rendered', { visible, onRequestColorSettings: !!onRequestColorSettings });
    const [title, setTitle] = useState('');
    const [deadline, setDeadline] = useState<string | null>(null);
    const [estimatedTime, setEstimatedTime] = useState<string | null>(null);
    const [recurrence, setRecurrence] = useState<RecurrenceRule | null>(null);
    const [completed, setCompleted] = useState(false);
    const [color, setColor] = useState<string | undefined>(undefined);
    const [taskType, setTaskType] = useState<'task' | 'event' | 'work' | 'chore' | 'habit' | undefined>(undefined);
    const [importance, setImportance] = useState<number>(0);
    const [isPropertiesModalVisible, setIsPropertiesModalVisible] = useState(false);

    const [isRecurrencePickerVisible, setIsRecurrencePickerVisible] = useState(false);
    const [activeFeature, setActiveFeature] = useState<FeatureKey | null>(null);
    const activeFeatureRef = useRef(activeFeature);
    activeFeatureRef.current = activeFeature;
    const [isRendered, setIsRendered] = useState(visible);

    // Use Custom Hook for Reminders
    const {
        reminderOffset,
        reminderTime,
        reminderEnabled,
        toggleReminder,
        updateReminder,
        clearReminder
    } = useTaskReminders(task);

    const [use24h, setUse24h] = useState(false);

    useEffect(() => {
        const loadPref = async () => {
            const settings = await StorageService.loadSprintSettings();
            if (settings.use24HourFormat !== undefined) {
                setUse24h(settings.use24HourFormat);
            }
        };
        loadPref();
    }, [visible]);

    // Helper to format time based on preference
    const formatTime = (time: string) => {
        const [hours, mins] = time.split(':').map(Number);
        if (use24h) {
            return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        }
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
    };

    // Animation value for translateY
    const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    
    // Animation value for full-screen carousel overlay swipe-up
    const carouselPanY = useRef(new Animated.Value(0)).current;

    // Track previous task to handle updates intelligently
    const prevTaskRef = useRef<Task | null>(null);

    useEffect(() => {
        if (visible && task) {
            setIsRendered(true);
            const prevTask = prevTaskRef.current;
            const isNewTask = !prevTask || prevTask.id !== task.id;

            if (isNewTask) {
                // New task opened: Reset all state
                setTitle(task.title);
                setDeadline(task.deadline || null);
                setEstimatedTime(task.estimatedTime || null);
                setRecurrence(task.recurrence || null);
                setCompleted(task.isCompleted || false);
                // Subtasks state removed
                setColor(task.color);
                setTaskType(task.type);
                setImportance(task.importance || 0); // Initialize importance

                // Note: Reminder state is handled by useTaskReminders hook

                setActiveFeature(initialActiveFeature || null);
                
                // Immediately reset carousel swipe animation for any new task opening
                carouselPanY.setValue(0);

                if (initialActiveFeature) {
                    // Bypass drawer animation completely when opening straight directly to Carousel
                    panY.setValue(0);
                } else {
                    // Slide up normally for standard Edit mode
                    panY.setValue(SCREEN_HEIGHT);
                    Animated.spring(panY, {
                        toValue: 0,
                        useNativeDriver: true,
                        speed: 30,
                        bounciness: 0,
                        restSpeedThreshold: 100,
                        restDisplacementThreshold: 40,
                    }).start();
                }
            } else {
                // Same task updated (e.g. from calendar/timer callback)
                // Only update fields if they changed externally
                if (task.deadline !== prevTask.deadline) {
                    setDeadline(task.deadline || null);
                }
                if (task.estimatedTime !== prevTask.estimatedTime) {
                    setEstimatedTime(task.estimatedTime || null);
                }
                if (JSON.stringify(task.recurrence) !== JSON.stringify(prevTask.recurrence)) {
                    setRecurrence(task.recurrence || null);
                }
                // Subtasks update check removed
                if (task.color !== prevTask.color) setColor(task.color);
                if (task.type !== prevTask.type) setTaskType(task.type);
                if (task.importance !== prevTask.importance) setImportance(task.importance || 0); // Update importance
                // Do NOT overwrite title or subtasks to preserve unsaved edits
            }
            prevTaskRef.current = task;
        } else {
            // Closing
            if (!visible && prevTaskRef.current) {
                Animated.timing(panY, {
                    toValue: SCREEN_HEIGHT,
                    duration: 250,
                    useNativeDriver: true,
                }).start(() => {
                    setIsRendered(false);
                    // Ensure parent knows we're done if needed, 
                    // but typically parent controls 'visible'
                    if (!visible) onClose();
                });
                prevTaskRef.current = null;
            } else if (!visible && !prevTaskRef.current) {
                setIsRendered(false);
            }
        }
    }, [visible, task]);

    const handleSave = (skipAnimation = false) => {
        if (!task) return;

        let finalTitle = title.trim();
        if (!finalTitle) {
            finalTitle = "Untitled Task"; // Auto-generate default title
        }

        // Determine seriesId logic for edits:
        // - If task already has seriesId, keep it.
        // - If task gets NEW recurrence (and didn't have seriesId), generate one.
        // - If recurrence is removed, maybe remove seriesId? (Optional, but keeps data clean)

        let finalSeriesId = task.seriesId;
        if (recurrence && !finalSeriesId) {
            finalSeriesId = `series_${task.id}`;
        }

        onSave({
            ...task,
            title: finalTitle,
            deadline: deadline || undefined,
            estimatedTime: estimatedTime || undefined,
            recurrence: recurrence || undefined,
            isCompleted: completed,

            subtasks: task.subtasks, // Preserve existing subtasks
            color: color,
            type: taskType || 'task',
            importance: importance, // Include importance


            // Persist Reminder State
            reminderOffset: reminderOffset !== null ? reminderOffset : undefined,
            reminderTime: reminderTime || undefined,
            reminderEnabled: reminderEnabled,

            seriesId: finalSeriesId,
        });

        if (skipAnimation) {
            setIsRendered(false);
            onClose();
            return;
        }

        // 2. Animate Out (ALWAYS)
        Animated.timing(panY, {
            toValue: SCREEN_HEIGHT,
            duration: 250,
            useNativeDriver: true,
        }).start(() => {
            setIsRendered(false);
            // 3. Close Parent State
            onClose();
        });
    };



    // Fix Stale Closure in PanResponder
    const handleSaveRef = useRef(handleSave);
    useEffect(() => { handleSaveRef.current = handleSave; });

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false, // Allow clicks to pass through
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Only capture if dragging noticeably DOWNWARD. 
                // This prevents tapping (which naturally has slight movement) from being swallowed 
                // and prevents UPWARD swipes from capturing the responder.
                return gestureState.dy > 15 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.5;
            },
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) {
                    panY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 100) {
                    // Dragged down far enough - Auto Save & Close
                    // Use ref to call latest function
                    handleSaveRef.current();
                } else {
                    // Snap back up
                    Animated.spring(panY, {
                        toValue: 0,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    // Reset carousel position when opened
    useEffect(() => {
        if (activeFeature) {
            carouselPanY.setValue(0);
        }
    }, [activeFeature]);

    const handleRequestColorSettings = useCallback(() => {
        if (__DEV__) console.log('[TaskEditDrawer] onRequestColorSettings called');
        if (onRequestColorSettings) onRequestColorSettings();
    }, [onRequestColorSettings]);

    // Render as absolute view instead of Modal to avoid stacking issues
    if (!visible && !isRendered) return null;

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.absoluteContainer}
            pointerEvents={visible ? "auto" : "none"}
            keyboardVerticalOffset={Platform.OS === 'ios' ? -34 : 0}
        >
            <Animated.View
                style={[styles.backdrop, {
                    opacity: panY.interpolate({
                        inputRange: [0, SCREEN_HEIGHT],
                        outputRange: [1, 0],
                    })
                }]}
                pointerEvents={visible ? 'auto' : 'none'}
            >
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => handleSave()} />
            </Animated.View>

            <Animated.View
                style={[styles.drawer, { transform: [{ translateY: panY }] }, activeFeature ? { backgroundColor: 'transparent', borderTopWidth: 0, minHeight: 0 } : {}]}
                {...panResponder.panHandlers}
            >
                {!activeFeature && (
                    <>
                        {/* Handle Bar */}
                        <View style={styles.handleContainer}>
                            <View style={styles.handle} />
                        </View>
                        <View style={[styles.content, { paddingBottom: 60 }]}>
                            <View style={styles.header}>
                                {/* Complete Toggle */}
                                <TouchableOpacity
                                    style={[styles.headerCheckbox, completed && styles.headerCheckboxChecked]}
                                    onPress={() => setCompleted(!completed)}
                                >
                                    {completed && <View style={styles.headerCheckboxInner} />}
                                </TouchableOpacity>

                                <Text style={styles.title}>{task?.id.startsWith('new_temp_') ? 'New Task' : 'Edit Task'}</Text>

                                <TouchableOpacity onPress={() => handleSave()}>
                                    <Text style={styles.saveButton}>Done</Text>
                                </TouchableOpacity>
                            </View>

                            <TextInput
                                style={styles.input}
                                value={title}
                                onChangeText={setTitle}
                                placeholder="Task Name"
                                placeholderTextColor={THEME.textSecondary}
                            />

                            <TaskEditFeatureGrid
                                deadline={deadline}
                                estimatedTime={estimatedTime}
                                color={color}
                                taskType={taskType}
                                importance={importance}
                                recurrence={recurrence}
                                reminderOffset={reminderOffset}
                                reminderEnabled={reminderEnabled}
                                reminderTime={reminderTime}
                                isSubtask={isSubtask}
                                formatTime={formatTime}
                                formatDateShort={formatDateShort}
                                setActiveFeature={setActiveFeature}
                                setDeadline={setDeadline}
                                setEstimatedTime={setEstimatedTime}
                                setRecurrence={setRecurrence}
                                clearReminder={clearReminder}
                                toggleReminder={toggleReminder}
                            />
                        </View>
                    </>
                )}
            </Animated.View>

            {/* Feature Carousel (replaces individual modals) */}
            <TaskEditCarousel
                activeFeature={activeFeature}
                carouselPanY={carouselPanY}
                panY={panY}
                deadline={deadline}
                estimatedTime={estimatedTime}
                recurrence={recurrence}
                color={color}
                taskType={taskType}
                importance={importance}
                reminderOffset={reminderOffset}
                reminderTime={reminderTime}
                reminderEnabled={reminderEnabled}
                userColors={userColors}
                handleSaveRef={handleSaveRef}
                activeFeatureRef={activeFeatureRef}
                setActiveFeature={setActiveFeature}
                setDeadline={setDeadline}
                setEstimatedTime={setEstimatedTime}
                setRecurrence={setRecurrence}
                setColor={setColor}
                setTaskType={setTaskType}
                setImportance={setImportance}
                updateReminder={updateReminder}
                onRequestColorSettings={handleRequestColorSettings}
            />

            {/* Legacy RecurrencePickerModal (kept for subtask compact mode) */}
            <RecurrencePickerModal
                visible={isRecurrencePickerVisible}
                onClose={() => setIsRecurrencePickerVisible(false)}
                onSave={setRecurrence}
                initialRule={recurrence}
            />

        </KeyboardAvoidingView >
    );
}

