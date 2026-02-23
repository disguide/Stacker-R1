import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform, Modal, Dimensions, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useTaskController } from '../src/features/tasks/hooks/useTaskController';
import { useTaskUI } from '../src/features/tasks/hooks/useTaskUI';
import { Task } from '../src/features/tasks/types';
import SwipeableTaskRow from '../src/components/SwipeableTaskRow';
import TaskEditDrawer from '../src/components/TaskEditDrawer';
import { FeatureKey } from '../src/components/TaskFeatureCarousel';
import { toISODateString, formatDeadline } from '../src/utils/dateHelpers';
import { parseRRuleString } from '../src/utils/recurrence';
import { RRule } from 'rrule';
import { RecurrenceEngine } from '../src/features/tasks/logic/recurrenceEngine';
import { RecurrenceRule, RecurrenceFrequency } from '../src/services/storage';
import CalendarModal from '../src/components/CalendarModal';
import DurationPickerModal from '../src/components/DurationPickerModal';
import RecurrencePickerModal from '../src/components/RecurrencePickerModal';
import TimePickerModal from '../src/components/TimePickerModal';
import TaskMenu from '../src/components/TaskMenu';
import { TaskQuickAdd } from '../src/components/TaskQuickAdd';
import { Subtask } from '../src/features/tasks/types';
import { getDayName, getDaysDifference } from '../src/utils/dateHelpers';

type ListItem = Task | string;

export default function LongTermScreen() {
    const router = useRouter();
    const { tasks, toggleTask, updateTask, deleteTask, addTask, toggleSubtask, updateSubtask } = useTaskController();

    // UI State
    const {
        isDrawerVisible, setIsDrawerVisible,
        editingTask, setEditingTask,
    } = useTaskUI();

    const [drawerInitialFeature, setDrawerInitialFeature] = useState<FeatureKey | null>(null);
    const [isCalendarVisible, setIsCalendarVisible] = useState(false);
    const [isMenuVisible, setIsMenuVisible] = useState(false);
    const [activeMenuTask, setActiveMenuTask] = useState<Task | null>(null);
    const [addingSubtaskToParentId, setAddingSubtaskToParentId] = useState<string | null>(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [isListScrollEnabled, setIsListScrollEnabled] = useState(true);
    const [userColors, setUserColors] = useState<any[]>([]);

    useEffect(() => {
        // Load colors for the horizon view as well
        const { StorageService } = require('../src/services/storage');
        StorageService.loadUserColors().then((colors: any) => setUserColors(colors));
    }, []);

    // Modal Visibility State
    const [isDurationPickerVisible, setIsDurationPickerVisible] = useState(false);
    const [isRecurrencePickerVisible, setIsRecurrencePickerVisible] = useState(false);
    const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);

    // Calendar State
    const [calendarMode, setCalendarMode] = useState<'add' | 'edit'>('add');
    const [calendarInitialPage, setCalendarInitialPage] = useState(0);

    // Soft Completion State
    const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(new Set());
    const completionTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({});

    // --- HORIZON GROUPING LOGIC ---
    const horizonData = useMemo(() => {
        // Fix: Use LOCAL date string, not UTC, to prevent tasks from disappearing late in the day
        const todayStr = toISODateString(new Date());

        // Use Recurrence Engine to project tasks for the next year
        // This ensures we get the NEXT occurrence of recurring tasks, and handling of completions
        const projectedItems = RecurrenceEngine.generateCalendarItems(
            tasks,
            todayStr,
            365, // Look ahead 1 year
            60   // Look back 60 days
        );

        // Filter out items that are explicitly completed
        const activeItems = projectedItems.filter(t => !t.isCompleted);

        // 1. Recurring Actions (Next Occurrence Only)
        // We want to show the NEXT instance of ANY recurring task (Daily/Weekly/Monthly/Yearly)
        // To avoid clutter (e.g. 365 daily tasks), we only take the FIRST valid occurrence.
        const recurringNext: Task[] = [];
        const seenRecurringIds = new Set<string>();

        // 2. Single Actions (Non-Recurring)
        const singleActions: Task[] = [];

        activeItems.forEach(t => {
            const isRecurring = (t.rrule || t.recurrence);

            if (isRecurring) {
                // Only add if we haven't seen this master task yet
                // RecurrenceEngine returns sorted so this is invariably the NEXT one
                if (!seenRecurringIds.has(t.originalTaskId)) {
                    recurringNext.push(t as unknown as Task);
                    seenRecurringIds.add(t.originalTaskId);
                }
            } else {
                // Must be future or today
                if (t.date >= todayStr) {
                    singleActions.push(t as unknown as Task);
                }
            }
        });

        // Sort just in case mixing polluted older RecurrenceEngine logic, but usually safe
        recurringNext.sort((a, b) => a.date.localeCompare(b.date));
        singleActions.sort((a, b) => a.date.localeCompare(b.date)); // Already sorted by engine usually

        const data: ListItem[] = [];

        if (singleActions.length > 0) {
            data.push('SECTION_SINGLE');

            // Group by Date
            let lastDate = '';
            singleActions.forEach(task => {
                if (task.date !== lastDate) {
                    data.push(`DATE_HEADER:${task.date}`);
                    lastDate = task.date;
                }
                data.push(task);
            });
        }

        if (recurringNext.length > 0) {
            data.push('SECTION_RECURRING'); // Changed from SECTION_YEARLY
            // Group by Date for Recurring too
            let lastDate = '';
            recurringNext.forEach(task => {
                if (task.date !== lastDate) {
                    data.push(`DATE_HEADER:${task.date}`);
                    lastDate = task.date;
                }
                data.push(task);
            });
        }

        return data;
    }, [tasks]);

    const stickyHeaderIndices = useMemo(() => {
        return horizonData
            .map((item, index) => (typeof item === 'string' ? index : null))
            .filter((item) => item !== null) as number[];
    }, [horizonData]);

    // --- HANDLERS ---

    const handleBack = () => router.back();

    const handleAddPress = () => {
        setCalendarMode('add');
        setIsCalendarVisible(true);
    };



    const openAddDrawer = (type: 'single' | 'yearly', preSelectedDate?: Date) => {
        let dateStr = toISODateString(preSelectedDate || new Date());
        let recurrence: RecurrenceRule | undefined = undefined;
        let initialFeature: FeatureKey | null = null;
        let rruleString: string | undefined = undefined;

        if (type === 'yearly') {
            recurrence = { frequency: 'yearly', interval: 1 };
            // Auto-generate RRULE for display consistency if needed
            try {
                const r = new RRule({ freq: RRule.YEARLY, dtstart: new Date() });
                rruleString = r.toString();
            } catch (e) { console.warn('[LongTerm] Failed to generate rrule', e); }
            initialFeature = 'recurrence';
        }

        // For Single, we don't force a feature, let it default to Title/Main
        // The date is already set by preSelectedDate

        const newTask: Task = {
            id: `new_longterm_${Date.now()}`,
            title: '',
            date: dateStr,
            originalDate: dateStr,
            completed: false,
            recurrence,
            rrule: rruleString,
            subtasks: [],
            progress: 0
        };

        setEditingTask(newTask);
        setDrawerInitialFeature(initialFeature);
        setIsDrawerVisible(true);
    };

    const handleEditTask = (task: Task) => {
        let drawerTask = { ...task };
        if (task.rrule && !task.recurrence) {
            const recurrenceObj = parseRRuleString(task.rrule);
            if (recurrenceObj) {
                drawerTask.recurrence = recurrenceObj;
            }
        }
        setEditingTask(drawerTask);
        setDrawerInitialFeature(null);
        setIsDrawerVisible(true);
    };

    const handleSaveTask = (updatedTask: Task) => {
        if (updatedTask.id.startsWith('new_')) {
            const finalTask = { ...updatedTask, id: Date.now().toString() };
            if (finalTask.recurrence) {
                try {
                    const freqMap: Record<string, any> = { 'yearly': RRule.YEARLY, 'monthly': RRule.MONTHLY, 'weekly': RRule.WEEKLY, 'daily': RRule.DAILY };
                    const freq = freqMap[finalTask.recurrence.frequency] || RRule.YEARLY;
                    const options: any = {
                        freq,
                        interval: finalTask.recurrence.interval || 1,
                        dtstart: new Date(finalTask.date + 'T00:00:00')
                    };
                    const rule = new RRule(options);
                    finalTask.rrule = rule.toString();
                } catch (e) { console.error(e); }
            }
            addTask(finalTask);
        } else {
            if (updatedTask.recurrence) {
                try {
                    const freqMap: Record<string, any> = { 'yearly': RRule.YEARLY, 'monthly': RRule.MONTHLY, 'weekly': RRule.WEEKLY, 'daily': RRule.DAILY };
                    const freq = freqMap[updatedTask.recurrence.frequency] || RRule.YEARLY;

                    const rule = new RRule({
                        freq,
                        interval: updatedTask.recurrence.interval || 1,
                        dtstart: new Date(updatedTask.date + 'T00:00:00')
                    });
                    updatedTask.rrule = rule.toString();
                } catch (e) { console.warn('[LongTerm] Failed to generate rrule', e); }
            }
            updateTask(updatedTask.id, updatedTask);
        }
        setIsDrawerVisible(false);
        setEditingTask(null);
    };

    const handleDeleteTask = (id: string, date: string, mode: 'single' | 'future' | 'all') => {
        deleteTask(id, date, mode);
        setIsDrawerVisible(false);
        setIsMenuVisible(false);
        setActiveMenuTask(null);
    };

    const confirmDelete = (task: Task) => {
        if (task.rrule || task.recurrence) {
            Alert.alert(
                "Delete Repeating Task",
                "Do you want to delete just this instance or all future tasks?",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "This One Only", onPress: () => handleDeleteTask(task.id, task.date, 'single') },
                    { text: "All Future Tasks", onPress: () => handleDeleteTask(task.id, task.date, 'future'), style: "destructive" }
                ]
            );
        } else {
            handleDeleteTask(task.id, task.date, 'all');
        }
    };

    // Subtask Handlers
    const handleSaveSubtask = () => {
        if (!addingSubtaskToParentId || !newTaskTitle.trim()) return;

        const parentTask = tasks.find(t => t.id === addingSubtaskToParentId);
        if (!parentTask) return;

        const newSubtask: Subtask = {
            id: Date.now().toString(),
            title: newTaskTitle.trim(),
            completed: false,
            progress: 0
        };

        const updatedSubtasks = [...(parentTask.subtasks || []), newSubtask];

        // Use updateTask to save the new subtask list
        // Note: For recurring tasks, this adds to the MASTER task definition usually, 
        // unless we built a specific "add instance subtask" which is complex.
        // For now, adding a subtask to a recurring task adds it to the template.
        updateTask(parentTask.id, { subtasks: updatedSubtasks });

        setAddingSubtaskToParentId(null);
        setNewTaskTitle('');
    };

    const handleSubtaskToggle = (parentTask: Task, subtask: Subtask) => {
        // Toggle Subtask
        toggleSubtask(parentTask.id, subtask.id, parentTask.date);
    };

    const handleOpenMenu = (task: Task) => {
        setActiveMenuTask(task);
        setIsMenuVisible(true);
    };

    const handleSwipeStart = () => setIsListScrollEnabled(false);
    const handleSwipeEnd = () => setIsListScrollEnabled(true);

    const cancelAddingSubtask = () => {
        setAddingSubtaskToParentId(null);
        setNewTaskTitle('');
    };



    const handleListTaskToggle = (item: Task) => {
        if (item.completed) {
            toggleTask(item.id, item.date);
            return;
        }

        const itemId = item.id;

        if (completingTaskIds.has(itemId)) {
            if (completionTimeouts.current[itemId]) {
                clearTimeout(completionTimeouts.current[itemId]);
                delete completionTimeouts.current[itemId];
            }
            setCompletingTaskIds(prev => {
                const next = new Set(prev);
                next.delete(itemId);
                return next;
            });
        } else {
            setCompletingTaskIds(prev => {
                const next = new Set(prev);
                next.add(itemId);
                return next;
            });

            completionTimeouts.current[itemId] = setTimeout(() => {
                toggleTask(item.id, item.date);
                delete completionTimeouts.current[itemId];
                setCompletingTaskIds(prev => {
                    const next = new Set(prev);
                    next.delete(itemId);
                    return next;
                });
            }, 2000);
        }
    };

    // Picker Handlers
    const handleSelectDate = (date: Date | null, includeTime: boolean = false) => {
        if (calendarMode === 'add') {
            setIsCalendarVisible(false);
            if (date) {
                // If adding, open drawer with date
                openAddDrawer('single', date);
            }
        } else {
            // Editing
            // Note: We don't close immediately here because CalendarModal handles its own close usually, 
            // but here we might want to update the editing task and keep drawer open
            if (editingTask) {
                let newDeadline = date ? toISODateString(date) : undefined;
                if (date && includeTime) {
                    const hours = date.getHours().toString().padStart(2, '0');
                    const minutes = date.getMinutes().toString().padStart(2, '0');
                    newDeadline = `${toISODateString(date)}T${hours}:${minutes}`;
                }
                setEditingTask({ ...editingTask, deadline: newDeadline });
            }
            setIsCalendarVisible(false);
        }
    };

    const handleSelectDuration = (duration: string) => {
        if (editingTask) {
            setEditingTask({ ...editingTask, estimatedTime: duration });
        }
    };

    const handleSelectRecurrence = (rule: RecurrenceRule | null) => {
        if (editingTask) {
            let rruleString: string | undefined = undefined;
            // Basic RRULE generation for display/storage parity if needed immediately, 
            // but usually `TaskEditDrawer`'s `onSave` handles the final RRULE generation. 
            // Here we just update the object for the UI.
            setEditingTask({ ...editingTask, recurrence: rule || undefined });
        }
    };

    const handleSelectTime = (time: string) => {
        if (editingTask) {
            setEditingTask({ ...editingTask, reminderTime: time || undefined });
        }
    };

    return (
        <View style={s.container}>
            <SafeAreaView edges={['top']} style={s.header}>
                <View style={s.headerTop}>
                    <TouchableOpacity onPress={handleBack} style={s.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Long Shot 🔭</Text>
                    <View style={{ width: 40 }} />
                </View>
                <Text style={s.headerSubtitle}>Horizon View</Text>
            </SafeAreaView>

            <View style={s.content}>
                {horizonData.length === 0 ? (
                    <View style={s.emptyState}>
                        <MaterialCommunityIcons name="telescope" size={64} color="#CBD5E1" />
                        <Text style={s.emptyText}>The horizon is clear.</Text>
                        <Text style={s.emptySubText}>Add a yearly engine or a future goal!</Text>
                    </View>
                ) : (
                    <FlashList<ListItem>
                        data={horizonData}
                        // @ts-ignore - types conflict with React 19
                        estimatedItemSize={70}
                        getItemType={(item) => typeof item === 'string' ? 'header' : 'row'}
                        keyExtractor={item => typeof item === 'string' ? item : item.id}
                        stickyHeaderIndices={stickyHeaderIndices}
                        scrollEnabled={isListScrollEnabled}
                        renderItem={({ item }) => {
                            if (typeof item === 'string') {
                                if (item.startsWith('DATE_HEADER:')) {
                                    const dateStr = item.split(':')[1];
                                    const [y, m, d] = dateStr.split('-').map(Number);
                                    const dateObj = new Date(y, m - 1, d); // Construct in local time
                                    const today = new Date();

                                    const isTodayDate = dateStr === toISODateString(today);

                                    return (
                                        <View style={[
                                            s.dateHeader,
                                            isTodayDate && s.todayHeader
                                        ]}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Text style={[
                                                    s.dayName,
                                                    isTodayDate && s.todayDayName
                                                ]}>
                                                    {dateObj.getDate()} {dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                                </Text>
                                                <Text style={[s.dateSubtext, { marginLeft: 8 }]}>
                                                    • {getDaysDifference(dateObj)} - {getDayName(dateObj)}
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                }

                                // Section Header
                                const title = item === 'SECTION_SINGLE' ? 'Single Action Items' : 'Recurring Actions';
                                const icon = item === 'SECTION_SINGLE' ? 'checkbox-blank-circle-outline' : 'sync';
                                return (
                                    <View style={s.sectionHeader}>
                                        <View style={s.sectionHeaderBadge}>
                                            <MaterialCommunityIcons name={icon as any} size={14} color="#FFF" />
                                        </View>
                                        <Text style={s.sectionHeaderText}>{title}</Text>
                                    </View>
                                );
                            }
                            return (
                                <View style={{ borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                                    <SwipeableTaskRow
                                        id={(item as Task).id}
                                        title={(item as Task).title}
                                        completed={(item as Task).completed || false}
                                        deadline={(item as Task).deadline}
                                        estimatedTime={(item as Task).estimatedTime}
                                        progress={(item as Task).progress || 0}
                                        onComplete={() => handleListTaskToggle(item as Task)}
                                        // wrapper usually handles swipe, but here we might need explicit actions if SwipeableTaskRow doesn't self-manage everything
                                        isCompleting={completingTaskIds.has((item as Task).id)}
                                        recurrence={(item as Task).rrule || (item as Task).recurrence}
                                        color={(item as Task).color}
                                        taskType={(item as Task).type}
                                        importance={(item as Task).importance}
                                        onEdit={() => handleEditTask(item as Task)}
                                        onMenu={() => handleOpenMenu(item as Task)}
                                        formatDeadline={formatDeadline}
                                        onProgressUpdate={(id, p) => updateTask(id, { progress: p })}
                                        onSwipeStart={handleSwipeStart}
                                        onSwipeEnd={handleSwipeEnd}
                                    />

                                    {/* Subtasks Rendering */}
                                    {(item as Task).subtasks && (item as Task).subtasks!.map((subtask: Subtask) => (
                                        <SwipeableTaskRow
                                            key={subtask.id}
                                            id={subtask.id}
                                            title={subtask.title}
                                            completed={subtask.completed}
                                            isSubtask={true}
                                            progress={subtask.progress || 0}
                                            onComplete={() => handleSubtaskToggle(item as Task, subtask)}
                                            onProgressUpdate={(sid, p) => updateSubtask((item as Task).id, sid, p, (item as Task).date)}
                                            onEdit={() => {
                                                // Optional: Edit subtask details (not fully implemented in Telescope yet)
                                            }}
                                            onMenu={() => {
                                                // Handle subtask specific menu if needed
                                            }}
                                            formatDeadline={() => ''} // Subtasks usually don't show deadline in list or have simplified view
                                            // Lock scroll for subtasks too
                                            onSwipeStart={handleSwipeStart}
                                            onSwipeEnd={handleSwipeEnd}
                                        />
                                    ))}
                                </View>
                            );
                        }}
                        contentContainerStyle={{ paddingBottom: 100 }}
                    />
                )}
            </View >

            <TouchableOpacity style={s.fab} onPress={handleAddPress}>
                <Ionicons name="add" size={30} color="#FFF" />
            </TouchableOpacity>

            <TaskEditDrawer
                visible={isDrawerVisible}
                task={editingTask}
                onClose={() => setIsDrawerVisible(false)}
                onSave={handleSaveTask}
                onRequestCalendar={(currentDeadline) => {
                    setCalendarMode('edit');
                    setCalendarInitialPage(0);
                    setIsCalendarVisible(true);
                }}
                onRequestDuration={() => setIsDurationPickerVisible(true)}
                onRequestTime={() => setIsTimePickerVisible(true)}
                initialActiveFeature={drawerInitialFeature}
                userColors={userColors}
            />

            <CalendarModal
                visible={isCalendarVisible}
                onClose={() => setIsCalendarVisible(false)}
                onSelectDate={handleSelectDate}
                selectedDate={calendarMode === 'edit' ? editingTask?.deadline : null}
                showTimePicker={true} // Allow time picking now for full parity
                initialPage={calendarInitialPage}
            />

            <DurationPickerModal
                visible={isDurationPickerVisible}
                onClose={() => setIsDurationPickerVisible(false)}
                onSelectDuration={handleSelectDuration}
                initialDuration={editingTask?.estimatedTime}
            />

            <RecurrencePickerModal
                visible={isRecurrencePickerVisible}
                onClose={() => setIsRecurrencePickerVisible(false)}
                onSave={handleSelectRecurrence}
                initialRule={editingTask?.recurrence || null} // Need to parse rrule if strictly using props, but editingTask should have object if opened via drawer logic
            />

            <TimePickerModal
                visible={isTimePickerVisible}
                onClose={() => setIsTimePickerVisible(false)}
                onSelectTime={handleSelectTime}
                initialTime={editingTask?.reminderTime}
            />

            <TaskMenu
                visible={isMenuVisible}
                onClose={() => setIsMenuVisible(false)}
                onEdit={() => {
                    setIsMenuVisible(false);
                    if (activeMenuTask) handleEditTask(activeMenuTask);
                }}
                onDelete={() => {
                    setIsMenuVisible(false);
                    if (activeMenuTask) confirmDelete(activeMenuTask);
                }}
                onAddSubtask={() => {
                    if (activeMenuTask) {
                        setAddingSubtaskToParentId(activeMenuTask.id);
                        setNewTaskTitle('');
                        setIsMenuVisible(false);
                        setActiveMenuTask(null);
                    }
                }}
                enableSubtasks={true}
            />

            <TaskQuickAdd
                visible={!!addingSubtaskToParentId}
                isSubtask={true}
                title={newTaskTitle}
                onChangeTitle={setNewTaskTitle}
                onSave={handleSaveSubtask}
                onCancel={cancelAddingSubtask}
                onOpenCalendar={() => { }}
                onOpenDuration={() => { }}
                onOpenRecurrence={() => { }}
                onOpenReminder={() => { }}
                onOpenProperties={() => { }}
                deadline={null}
                onClearDeadline={() => { }}
                estimatedTime={null}
                onClearEstimatedTime={() => { }}
                recurrence={null}
                onClearRecurrence={() => { }}
            />
        </View >
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        backgroundColor: '#0F172A',
        paddingBottom: 16,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginBottom: 4,
        paddingTop: 8,
    },
    backBtn: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFF',
        letterSpacing: 0.5,
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#94A3B8',
        textAlign: 'center',
        fontWeight: '600',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    content: {
        flex: 1,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#64748B',
        marginTop: 16,
    },
    emptySubText: {
        fontSize: 14,
        color: '#94A3B8',
        marginTop: 8,
    },
    fab: {
        position: 'absolute',
        bottom: 32,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#0F172A',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    sectionHeader: {
        backgroundColor: '#F1F5F9',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionHeaderBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#64748B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionHeaderText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#475569',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    dateHeader: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    todayHeader: {
        backgroundColor: '#F0F9FF', // Light blue tint for today
    },
    dayName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 0,
    },
    todayDayName: {
        color: '#0284C7',
    },
    dateSubtext: {
        fontSize: 14,
        color: '#475569',
        fontWeight: '600',
        // textTransform: 'uppercase', // Removed for single line cohesion
        letterSpacing: 0.5,
    },
    dateHeaderText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});
