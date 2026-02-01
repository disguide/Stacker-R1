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
import { RecurrenceRule } from '../services/storage';

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

interface Task {
    id: string;
    title: string;
    date: string;
    originalDate?: string;
    deadline?: string;
    estimatedTime?: string;
    completed?: boolean;
    subtasks?: { id: string; title: string; completed: boolean; }[];
    recurrence?: RecurrenceRule;
    originalTaskId?: string;
    seriesId?: string;
}

interface TaskEditDrawerProps {
    visible: boolean;
    task: Task | null;
    onSave: (updatedTask: Task) => void;
    onClose: () => void;
    onRequestCalendar: (currentDeadline: string | null) => void;
    onRequestDuration: () => void;
    onRequestTime: (currentDeadline: string | null) => void;
}

export default function TaskEditDrawer({ visible, task, onSave, onClose, onRequestCalendar, onRequestDuration, onRequestTime }: TaskEditDrawerProps) {
    const [title, setTitle] = useState('');
    const [deadline, setDeadline] = useState<string | null>(null);
    const [estimatedTime, setEstimatedTime] = useState<string | null>(null);
    const [recurrence, setRecurrence] = useState<RecurrenceRule | null>(null);
    const [completed, setCompleted] = useState(false);
    const [subtasks, setSubtasks] = useState<{ id: string; title: string; completed: boolean; }[]>([]); // New State
    const [newSubtaskTitle, setNewSubtaskTitle] = useState(''); // New State for Input

    const [isRecurrencePickerVisible, setIsRecurrencePickerVisible] = useState(false);
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
    const handleAddSubtask = () => {
        if (!newSubtaskTitle.trim()) return;
        const newSubtask = {
            id: `st_${Date.now()}`,
            title: newSubtaskTitle.trim(),
            completed: false,
        };
        setSubtasks([...subtasks, newSubtask]);
        setNewSubtaskTitle('');
    };

    const handleToggleSubtask = (subtaskId: string) => {
        setSubtasks(prev => prev.map(st =>
            st.id === subtaskId ? { ...st, completed: !st.completed } : st
        ));
    };

    const handleDeleteSubtask = (subtaskId: string) => {
        setSubtasks(prev => prev.filter(st => st.id !== subtaskId));
    };

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
                setSubtasks(task.subtasks || []); // Initialize subtasks
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
                if (JSON.stringify(task.subtasks) !== JSON.stringify(prevTask.subtasks)) {
                    setSubtasks(task.subtasks || []);
                }
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
                subtasks: subtasks, // Save updated subtasks
                seriesId: finalSeriesId,
                originalTaskId: finalSeriesId // Keep consistent
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
                    {/* Compact Header for New Tasks */}
                    {task?.id.startsWith('new_temp_') ? (
                        <View style={styles.compactHeader}>
                            <Text style={styles.compactTitle}>New Subtask</Text>
                        </View>
                    ) : (
                        <View style={styles.header}>
                            {/* Complete Toggle */}
                            <TouchableOpacity
                                style={[styles.headerCheckbox, completed && styles.headerCheckboxChecked]}
                                onPress={() => setCompleted(!completed)}
                            >
                                {completed && <View style={styles.headerCheckboxInner} />}
                            </TouchableOpacity>
                            <Text style={styles.title}>Edit Task</Text>
                            <TouchableOpacity onPress={handleSave}>
                                <Text style={styles.saveButton}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <TextInput
                        style={styles.input}
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Task Name"
                        placeholderTextColor={THEME.textSecondary}
                    />

                    {/* Compact Mode: Buttons under input */}
                    {task?.id.startsWith('new_temp_') ? (
                        <View style={styles.compactRow}>
                            <TouchableOpacity style={styles.compactChip} onPress={() => onRequestCalendar(deadline)}>
                                <Text style={styles.compactChipText}>{deadline ? formatDateShort(deadline) : '📅 Deadline'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.compactChip} onPress={onRequestDuration}>
                                <Text style={styles.compactChipText}>{estimatedTime ? `⏱ ${estimatedTime}` : '⏱ Estimate'}</Text>
                            </TouchableOpacity>
                            <View style={{ flex: 1 }} />
                            <TouchableOpacity style={styles.compactAddBtn} onPress={handleSave}>
                                <Text style={styles.compactAddBtnText}>Add</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            {/* Deadline Section - Side by Side Date & Time */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>📅 Deadline</Text>
                                <View style={styles.deadlineRow}>
                                    {/* Date Button */}
                                    <TouchableOpacity
                                        style={[styles.calendarButton, { flex: 1, marginRight: 6 }]}
                                        onPress={() => onRequestCalendar(deadline)}
                                    >
                                        <Text style={[styles.calendarButtonText, { fontSize: 13 }]} numberOfLines={1}>
                                            {deadline && !deadline.match(/^\d{2}:\d{2}$/)
                                                ? deadline.split('T')[0]
                                                : 'Date'}
                                        </Text>
                                    </TouchableOpacity>

                                    {/* Time Button */}
                                    <TouchableOpacity
                                        style={[styles.calendarButton, { flex: 1 }]}
                                        onPress={() => onRequestTime(deadline)}
                                    >
                                        <Text style={[styles.calendarButtonText, { fontSize: 13 }]} numberOfLines={1}>
                                            {deadline
                                                ? deadline.match(/^\d{2}:\d{2}$/)
                                                    ? formatTime(deadline)
                                                    : deadline.includes('T')
                                                        ? formatTime(deadline.split('T')[1])
                                                        : 'Time'
                                                : 'Time'}
                                        </Text>
                                    </TouchableOpacity>

                                    {deadline && (
                                        <TouchableOpacity
                                            style={styles.clearButton}
                                            onPress={() => setDeadline(null)}
                                        >
                                            <Text style={styles.clearButtonText}>✕</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            {/* Estimated Time Section (New) */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>⏱ Estimated Time</Text>
                                <View style={styles.deadlineRow}>
                                    <TouchableOpacity
                                        style={styles.calendarButton}
                                        onPress={onRequestDuration}
                                    >
                                        <Text style={styles.calendarButtonText}>
                                            {estimatedTime ? `Duration: ${estimatedTime}` : 'Set Duration...'}
                                        </Text>
                                        <Text style={styles.calendarIcon}>→</Text>
                                    </TouchableOpacity>

                                    {estimatedTime && (
                                        <TouchableOpacity
                                            style={styles.clearButton}
                                            onPress={() => setEstimatedTime(null)}
                                        >
                                            <Text style={styles.clearButtonText}>✕</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            {/* Recurrence Section */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>🔁 Recurrence</Text>
                                <View style={styles.deadlineRow}>
                                    <TouchableOpacity
                                        style={styles.calendarButton}
                                        onPress={() => setIsRecurrencePickerVisible(true)}
                                    >
                                        <Text style={styles.calendarButtonText}>
                                            {recurrence ? (
                                                recurrence.frequency === 'weekly' && recurrence.daysOfWeek
                                                    ? 'Custom Weekly'
                                                    : recurrence.frequency.charAt(0).toUpperCase() + recurrence.frequency.slice(1)
                                            ) : 'Does not repeat'}
                                        </Text>
                                        <Text style={styles.calendarIcon}>→</Text>
                                    </TouchableOpacity>

                                    {recurrence && (
                                        <TouchableOpacity
                                            style={styles.clearButton}
                                            onPress={() => setRecurrence(null)}
                                        >
                                            <Text style={styles.clearButtonText}>✕</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>


                            {/* Subtasks Section */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Checklist</Text>

                                {subtasks.map((st) => (
                                    <View key={st.id} style={styles.subtaskItem}>
                                        <TouchableOpacity
                                            style={[styles.subtaskCheckbox, st.completed && styles.subtaskCheckboxChecked]}
                                            onPress={() => handleToggleSubtask(st.id)}
                                        >
                                            {st.completed && <View style={{ width: 10, height: 10, backgroundColor: '#FFF', borderRadius: 2 }} />}
                                        </TouchableOpacity>
                                        <TextInput
                                            style={[styles.subtaskText, st.completed && styles.subtaskTextDone]}
                                            value={st.title}
                                            onChangeText={(text) => {
                                                setSubtasks(prev => prev.map(s => s.id === st.id ? { ...s, title: text } : s));
                                            }}
                                        />
                                        <TouchableOpacity onPress={() => handleDeleteSubtask(st.id)}>
                                            <Text style={styles.deleteSubtaskText}>×</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}

                                <View style={styles.addSubtaskRow}>
                                    <TextInput
                                        style={styles.addSubtaskInput}
                                        value={newSubtaskTitle}
                                        onChangeText={setNewSubtaskTitle}
                                        placeholder="Add a subtask..."
                                        placeholderTextColor={THEME.textSecondary}
                                        onSubmitEditing={handleAddSubtask}
                                    />
                                    <TouchableOpacity style={styles.tactileAddBtn} onPress={handleAddSubtask}>
                                        <Text style={styles.tactileAddBtnText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </>
                    )}




                </ScrollView>
            </Animated.View>

            <RecurrencePickerModal
                visible={isRecurrencePickerVisible}
                onClose={() => setIsRecurrencePickerVisible(false)}
                onSave={setRecurrence}
                initialRule={recurrence}
            />

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
    title: {
        flex: 1,
        fontSize: 22,
        fontWeight: 'bold',
        color: THEME.textPrimary,
        fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
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
        fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    },
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
});
