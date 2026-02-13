import React, { useState, useEffect, useRef } from 'react';
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
    ScrollView, // Import ScrollView
} from 'react-native';
import RecurrencePickerModal from './RecurrencePickerModal';
import { RecurrenceRule, ColorDefinition } from '../services/storage';
import TaskFeatureCarousel, { FeatureKey } from './TaskFeatureCarousel';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Theme Constants
const THEME = {
    bg: '#FAFAF6',
    textPrimary: '#333333',
    textSecondary: '#64748B',
    accent: '#007AFF',
    border: '#333333',
    surface: '#FFFDF5',
    shadowColor: '#333333',
};

const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`;
};

import { Task } from '../features/tasks/types';
import { Switch } from 'react-native'; // Import Switch


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
    initialActiveFeature
}: TaskEditDrawerProps) {
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
    const [reminderOffset, setReminderOffset] = useState<number | null>(null);

    const [reminderTime, setReminderTime] = useState<string | null>(null);
    const [reminderEnabled, setReminderEnabled] = useState(true);
    // const [isTimePickerVisible, setIsTimePickerVisible] = useState(false); // Removed
    // const [selectedHour, setSelectedHour] = useState(9); // Removed
    // const [selectedMinute, setSelectedMinute] = useState(0); // Removed

    // Helper to format time as 12-hour
    const formatTime = (time: string) => {
        const [hours, mins] = time.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
    };

    // Subtask Handlers


    // Removed local subtask state management as it is now handled in parent

    // Animation value for translateY
    const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    // Track previous task to handle updates intelligently
    const prevTaskRef = useRef<Task | null>(null);

    useEffect(() => {
        if (visible && task) {
            const prevTask = prevTaskRef.current;
            const isNewTask = !prevTask || prevTask.id !== task.id;

            if (isNewTask) {
                // New task opened: Reset all state
                setTitle(task.title);
                setDeadline(task.deadline || null);
                setEstimatedTime(task.estimatedTime || null);
                setRecurrence(task.recurrence || null);
                setCompleted(task.completed || false);
                // Subtasks state removed
                setColor(task.color);
                setTaskType(task.type);
                setImportance(task.importance || 0); // Initialize importance
                setImportance(task.importance || 0); // Initialize importance

                // Initialize Reminder State
                setReminderOffset(task.reminderOffset !== undefined ? task.reminderOffset : null);
                setReminderTime(task.reminderTime || null);
                setReminderEnabled(task.reminderEnabled !== undefined ? task.reminderEnabled : true);

                setActiveFeature(initialActiveFeature || null);
                // Slide up
                panY.setValue(SCREEN_HEIGHT);
                Animated.spring(panY, {
                    toValue: 0,
                    useNativeDriver: true,
                    bounciness: 0,
                }).start();
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
                    // Ensure parent knows we're done if needed, 
                    // but typically parent controls 'visible'
                    if (!visible) onClose();
                });
                prevTaskRef.current = null;
            }
        }
    }, [visible, task]);

    const handleSave = () => {
        // 1. Save Data Immediately (if valid)
        if (task && title.trim()) {
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
                title: title.trim(),
                deadline: deadline || undefined,
                estimatedTime: estimatedTime || undefined,
                recurrence: recurrence || undefined,
                completed: completed,

                subtasks: task.subtasks, // Preserve existing subtasks
                color: color,
                type: taskType,
                importance: importance, // Include importance


                // Persist Reminder State
                reminderOffset: reminderOffset !== null ? reminderOffset : undefined,
                reminderTime: reminderTime || undefined,
                reminderEnabled: reminderEnabled,

                seriesId: finalSeriesId,
            });
        }
        // If title empty, we just close without saving (discard)

        // 2. Animate Out (ALWAYS)
        Animated.timing(panY, {
            toValue: SCREEN_HEIGHT,
            duration: 250,
            useNativeDriver: true,
        }).start(() => {
            // 3. Close Parent State
            onClose();
        });
    };



    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false, // Allow clicks to pass through
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Only capture if vertical drag is significant
                return Math.abs(gestureState.dy) > 10;
            },
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) {
                    panY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 100) {
                    // Dragged down far enough - Auto Save & Close
                    handleSave();
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

    if (!visible && !task) return null;

    // Render as absolute view instead of Modal to avoid stacking issues
    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.absoluteContainer}
            pointerEvents={visible ? "auto" : "none"}
        >
            <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleSave} />

            <Animated.View
                style={[styles.drawer, { transform: [{ translateY: panY }] }]}
                {...panResponder.panHandlers}
            >
                {/* Handle Bar */}
                <View style={styles.handleContainer}>
                    <View style={styles.handle} />
                </View>

                {/* Content */}
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.header}>
                        {/* Complete Toggle */}
                        <TouchableOpacity
                            style={[styles.headerCheckbox, completed && styles.headerCheckboxChecked]}
                            onPress={() => setCompleted(!completed)}
                        >
                            {completed && <View style={styles.headerCheckboxInner} />}
                        </TouchableOpacity>

                        <Text style={styles.title}>{task?.id.startsWith('new_temp_') ? 'New Task' : 'Edit Task'}</Text>

                        <TouchableOpacity onPress={handleSave}>
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

                    {/* Feature Grid (2x2) */}
                    <View style={styles.featureGrid}>
                        {/* Deadline Card */}
                        <TouchableOpacity
                            style={styles.featureCardGrid}
                            onPress={() => setActiveFeature('deadline')}
                        >
                            <View style={styles.featureIconContainer}>
                                <MaterialCommunityIcons name="calendar-clock" size={20} color={deadline ? THEME.textPrimary : THEME.textSecondary} />
                            </View>
                            <Text style={styles.featureLabel}>Deadline</Text>
                            <Text style={[styles.featureValue, deadline && styles.featureValueActive]} numberOfLines={1}>
                                {deadline
                                    ? deadline.match(/^\d{2}:\d{2}$/)
                                        ? formatTime(deadline)
                                        : formatDateShort(deadline)
                                    : 'None'}
                            </Text>
                            {deadline && (
                                <TouchableOpacity
                                    style={styles.featureClearHtml}
                                    onPress={() => setDeadline(null)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Ionicons name="close-circle" size={16} color={THEME.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </TouchableOpacity>

                        {/* Estimate Card */}
                        <TouchableOpacity
                            style={styles.featureCardGrid}
                            onPress={() => setActiveFeature('estimate')}
                        >
                            <View style={styles.featureIconContainer}>
                                <MaterialCommunityIcons name="timer-outline" size={20} color={estimatedTime ? THEME.textPrimary : THEME.textSecondary} />
                            </View>
                            <Text style={styles.featureLabel}>Estimate</Text>
                            <Text style={[styles.featureValue, estimatedTime && styles.featureValueActive]} numberOfLines={1}>
                                {estimatedTime || 'None'}
                            </Text>
                            {estimatedTime && (
                                <TouchableOpacity
                                    style={styles.featureClearHtml}
                                    onPress={() => setEstimatedTime(null)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Ionicons name="close-circle" size={16} color={THEME.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </TouchableOpacity>

                        {/* Tags / Properties Card */}
                        <TouchableOpacity
                            style={[styles.featureCardGrid, color ? { borderColor: color, backgroundColor: color + '10' } : {}]}
                            onPress={() => setActiveFeature('properties')}
                        >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                                <View style={styles.featureIconContainer}>
                                    <MaterialCommunityIcons
                                        name={
                                            taskType === 'event' ? 'calendar' :
                                                taskType === 'habit' ? 'refresh' :
                                                    taskType === 'chore' ? 'broom' :
                                                        taskType === 'work' ? 'briefcase' :
                                                            'checkbox-marked-outline'
                                        }
                                        size={20}
                                        color={color || THEME.textPrimary}
                                    />
                                </View>
                                {(importance || 0) > 0 && (
                                    <View style={{
                                        backgroundColor: importance === 3 ? '#FECACA' : importance === 2 ? '#FDE68A' : '#E9D5FF',
                                        paddingHorizontal: 6,
                                        paddingVertical: 2,
                                        borderRadius: 4,
                                        alignSelf: 'flex-start'
                                    }}>
                                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#333' }}>
                                            {importance === 1 ? '!' : importance === 2 ? '!!' : '!!!'}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.featureLabel}>Tags</Text>
                            <Text style={[styles.featureValue, { textTransform: 'capitalize' }]} numberOfLines={1}>
                                {taskType || 'Task'}
                            </Text>
                            {color && <View style={{ position: 'absolute', bottom: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />}
                        </TouchableOpacity>

                        {/* Recurrence Card */}
                        <TouchableOpacity
                            style={styles.featureCardGrid}
                            onPress={() => setActiveFeature('recurrence')}
                        >
                            <View style={styles.featureIconContainer}>
                                <MaterialCommunityIcons name="repeat" size={20} color={recurrence ? THEME.textPrimary : THEME.textSecondary} />
                            </View>
                            <Text style={styles.featureLabel}>Repeat</Text>
                            <Text style={[styles.featureValue, recurrence && styles.featureValueActive]} numberOfLines={1}>
                                {recurrence ? (recurrence.frequency.charAt(0).toUpperCase() + recurrence.frequency.slice(1)) : 'Never'}
                            </Text>
                            {recurrence && (
                                <TouchableOpacity
                                    style={styles.featureClearHtml}
                                    onPress={() => setRecurrence(null)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Ionicons name="close-circle" size={16} color={THEME.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </TouchableOpacity>

                        {/* Reminder Card */}
                        <TouchableOpacity
                            style={styles.featureCardGrid}
                            onPress={() => setActiveFeature('reminder')}
                        >
                            <View style={styles.featureIconContainer}>
                                <MaterialCommunityIcons name="bell-outline" size={20} color={reminderOffset !== null && reminderEnabled ? THEME.textPrimary : THEME.textSecondary} />
                            </View>
                            <Text style={styles.featureLabel}>Remind</Text>
                            <Text style={[
                                styles.featureValue,
                                reminderOffset !== null && reminderEnabled && styles.featureValueActive,
                                !reminderEnabled && { color: THEME.textSecondary, fontWeight: 'normal' }
                            ]} numberOfLines={1}>
                                {reminderOffset !== null
                                    ? reminderOffset === 0 ? 'Same day' : `${reminderOffset}d before`
                                    : 'None'}
                            </Text>
                            {reminderOffset !== null && (
                                <>
                                    <View style={{ position: 'absolute', bottom: 10, right: 10 }}>
                                        <Switch
                                            value={reminderEnabled}
                                            onValueChange={setReminderEnabled}
                                            trackColor={{ false: "#E2E8F0", true: "#BFDBFE" }}
                                            thumbColor={reminderEnabled ? "#2563EB" : "#F1F5F9"}
                                            style={{ transform: [{ scale: 0.7 }] }} // Data densification
                                        />
                                    </View>
                                    <TouchableOpacity
                                        style={{ position: 'absolute', top: 8, right: 8, padding: 4 }}
                                        onPress={(e) => {
                                            e.stopPropagation(); // Prevent card press
                                            setReminderOffset(null);
                                            setReminderTime(null);
                                        }}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        <Ionicons name="close" size={16} color={THEME.textSecondary} />
                                    </TouchableOpacity>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>


                    {/* Subtasks Section Removed as per user request */}




                </ScrollView>
            </Animated.View>

            {/* Feature Carousel (replaces individual modals) */}
            {
                activeFeature && (
                    <View style={styles.carouselOverlay}>
                        <View style={styles.carouselSheet}>
                            <View style={styles.carouselHeader}>
                                <TouchableOpacity onPress={() => setActiveFeature(null)}>
                                    <Ionicons name="chevron-back" size={24} color={THEME.textPrimary} />
                                </TouchableOpacity>
                                <Text style={{ fontSize: 16, fontWeight: '600', color: THEME.textPrimary }}>Edit Features</Text>
                                <TouchableOpacity onPress={() => setActiveFeature(null)}>
                                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: THEME.accent }}>Done</Text>
                                </TouchableOpacity>
                            </View>
                            <TaskFeatureCarousel
                                visible={!!activeFeature}
                                initialFeature={activeFeature}
                                deadline={deadline}
                                estimatedTime={estimatedTime}
                                recurrence={recurrence}
                                color={color}
                                taskType={taskType}
                                importance={importance}
                                onDeadlineChange={setDeadline}
                                onEstimateChange={setEstimatedTime}
                                onRecurrenceChange={setRecurrence}
                                onColorChange={setColor}
                                onTypeChange={setTaskType}
                                onImportanceChange={setImportance}
                                onReminderChange={(offset, time) => { setReminderOffset(offset); setReminderTime(time); }}
                                reminderOffset={reminderOffset}
                                reminderTime={reminderTime}
                                reminderEnabled={reminderEnabled}
                                onClose={() => setActiveFeature(null)}
                                userColors={userColors}
                            />
                        </View>
                    </View>
                )
            }

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

const styles = StyleSheet.create({
    absoluteContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100, // Ensure it sits above other content but below Modal
        justifyContent: 'flex-end',
    },
    overlay: {
        // confusing name legacy, replaced by absoluteContainer basically
        flex: 1,
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(51, 51, 51, 0.4)',
        zIndex: 1,
    },
    drawer: {
        backgroundColor: '#FFFFFF', // Explict white
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderTopWidth: 2,
        borderTopColor: THEME.border,
        paddingBottom: 40,
        maxHeight: '85%',
        minHeight: 500,
        // Removed elevation/shadow/opacity issues
        elevation: 0,
        zIndex: 10,
    },
    handleContainer: {
        alignItems: 'center',
        paddingVertical: 12, // Reduced padding
    },
    // ... (keep existing)
    compactHeader: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 10,
    },
    compactTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: THEME.textSecondary,
    },
    compactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
        paddingHorizontal: 4, // Align with input
    },
    compactChip: {
        backgroundColor: THEME.surface,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: THEME.border,
    },
    compactChipText: {
        fontSize: 13,
        color: THEME.textPrimary,
        fontWeight: '500',
    },
    compactAddBtn: {
        backgroundColor: THEME.textPrimary,
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
    },
    compactAddBtnText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: THEME.textSecondary,
        borderRadius: 2,
        opacity: 0.3,
    },
    content: {
        paddingHorizontal: 24,
        flex: 1, // Ensure ScrollView takes space
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        gap: 12,
    },
    headerCheckbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: THEME.textPrimary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 4,
    },
    headerCheckboxChecked: {
        backgroundColor: THEME.accent,
        borderColor: THEME.accent,
    },
    headerCheckboxInner: {
        width: 12,
        height: 12,
        backgroundColor: '#FFF',
        borderRadius: 2,
    },
    headerTagBanner: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 2,
    },
    headerTagSymbol: {
        fontSize: 16,
    },
    title: {
        flex: 1,
        fontSize: 22,
        fontWeight: 'bold',
        color: THEME.textPrimary,
        // fontFamily removed for system default
    },
    saveButton: {
        fontSize: 16,
        fontWeight: 'bold',
        color: THEME.accent,
    },
    input: {
        fontSize: 18,
        borderBottomWidth: 2,
        borderBottomColor: '#E2E8F0',
        paddingVertical: 12,
        marginBottom: 24,
        color: THEME.textPrimary,
        // fontFamily removed for system default
    },
    // Carousel Styles
    carouselContainer: {
        marginBottom: 24,
    },
    carouselContent: {
        paddingHorizontal: 0,
        gap: 12,
    },
    featureCard: {
        width: 120,
        height: 80,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 10,
        justifyContent: 'space-between',
        // Minimal shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    featureGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    featureCardGrid: {
        width: '48%',
        height: 80,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 10,
        justifyContent: 'space-between',
        // Minimal shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    featureIconContainer: {
        alignSelf: 'flex-start',
        marginBottom: 4,
    },
    featureLabel: {
        fontSize: 11,
        color: THEME.textSecondary,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    featureValue: {
        fontSize: 13,
        fontWeight: '600',
        color: THEME.textSecondary,
    },
    featureValueActive: {
        color: THEME.textPrimary,
        fontWeight: 'bold',
    },
    featureClearHtml: {
        position: 'absolute',
        top: 6,
        right: 6,
    },

    // Legacy / Shared
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: THEME.textSecondary,
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    tagScroll: {
        flexDirection: 'row',
    },


    // Tag Styles
    tagChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        marginRight: 8,
    },
    tagEmoji: { fontSize: 14, marginRight: 4 },
    tagLabel: { fontSize: 13, fontWeight: '600' },

    // Color Picker Styles (This section is now redundant due to the new colorCircle/colorSelected above, but keeping for context if other styles were here)
    // The original colorCircle and colorSelected were replaced.

    // Type Chip Styles
    typeChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: 'transparent',
        gap: 6
    },
    typeChipSelected: {
        backgroundColor: '#333333',
        borderColor: '#333333',
    },
    typeChipText: {
        fontSize: 14,
        color: '#64748B',
        fontWeight: '500',
    },
    typeChipTextSelected: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    deadlineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    calendarButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: THEME.surface,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: THEME.border,
        flex: 1,
        justifyContent: 'space-between',
        // Shadow
        shadowColor: THEME.shadowColor,
        shadowOffset: { width: 3, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 0,
    },
    calendarButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: THEME.textPrimary,
        fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    },
    calendarIcon: {
        fontSize: 18,
        color: THEME.textSecondary,
        fontWeight: 'bold',
    },
    clearButton: {
        padding: 12,
    },
    clearButtonText: {
        fontSize: 18,
        color: THEME.textSecondary,
        fontWeight: 'bold',
    },
    deleteButton: {
        marginTop: 10,
        alignItems: 'center',
        paddingVertical: 16,
        backgroundColor: '#FFF5F5',
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#FC8181',
        marginBottom: 20,
    },
    deleteText: {
        color: '#C53030',
        fontWeight: 'bold',
        fontSize: 16,
        fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    },
    subtaskItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingVertical: 4,
    },
    subtaskCheckbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: '#444',
        marginRight: 12,
    },
    subtaskCheckboxChecked: {
        backgroundColor: THEME.accent,
        borderColor: THEME.accent,
    },
    subtaskText: {
        flex: 1,
        fontSize: 16,
        color: THEME.textPrimary,
    },
    subtaskTextDone: {
        textDecorationLine: 'line-through',
        color: THEME.textSecondary,
        opacity: 0.6,
    },
    deleteSubtaskText: {
        fontSize: 20,
        color: THEME.textSecondary,
        paddingHorizontal: 8,
    },
    addSubtaskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    addSubtaskInput: {
        flex: 1,
        backgroundColor: THEME.surface,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 4,
        marginRight: 10,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        color: THEME.textPrimary,
    },
    tactileAddBtn: {
        width: 44,
        height: 44,
        backgroundColor: THEME.surface,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: THEME.border,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: THEME.shadowColor,
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 0,
    },
    tactileAddBtnText: {
        fontSize: 24,
        color: THEME.textPrimary,
        fontWeight: '400',
    },

    // New Action Buttons (Tags)
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#F3F4F6',
        borderRadius: 10,
        marginBottom: 12
    },
    actionIconContainer: { marginRight: 10 },
    actionText: { flex: 1, fontSize: 16, fontWeight: '500', color: '#333' },

    // Properties Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    modalDone: {
        fontSize: 16,
        fontWeight: '600',
        color: THEME.accent,
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748B',
        marginBottom: 12,
        marginTop: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    typeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    typeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
        gap: 6
    },
    typeButtonActive: {
        backgroundColor: '#F0F9FF',
        borderColor: THEME.accent,
    },
    typeButtonText: {
        fontSize: 14,
        color: '#64748B',
    },
    importanceRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    importanceButton: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
    },
    importanceButtonActive: {
        backgroundColor: '#333',
        borderColor: '#333',
    },
    importanceText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#64748B',
    },
    importanceTextActive: {
        color: '#FFF',
    },
    colorRow: {
        paddingVertical: 4,
        gap: 12
    },
    colorCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    colorSelected: {
        borderWidth: 3,
        borderColor: '#333',
        transform: [{ scale: 1.1 }],
    },

    // Carousel Overlay — centred floating window
    carouselOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.45)',
        zIndex: 200,
        justifyContent: 'center',
        alignItems: 'center',
    },
    carouselSheet: {
        width: '92%',
        height: '80%',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
    },
    carouselHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },

});
