import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Keyboard, Platform, KeyboardAvoidingView, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import ProfileButton from '../src/components/ProfileButton';
import SettingsButton from '../src/components/SettingsButton';
import TaskEditDrawer from '../src/components/TaskEditDrawer';
import TaskMenu from '../src/components/TaskMenu';
import CalendarModal from '../src/components/CalendarModal';
import DurationPickerModal from '../src/components/DurationPickerModal';
import CompletedTasksModal from '../src/components/CompletedTasksModal';
import SwipeableTaskRow from '../src/components/SwipeableTaskRow';
import RecurrencePickerModal from '../src/components/RecurrencePickerModal';
import TimePickerModal from '../src/components/TimePickerModal';
import TagSettingsModal from '../src/components/TagSettingsModal'; // Import TagSettingsModal
import { StorageService, RecurrenceRule, RecurrenceFrequency, WeekDay, TagDefinition } from '../src/services/storage';
import { RecurrenceEngine } from '../src/features/tasks/logic/recurrenceEngine';
import { useTaskController } from '../src/features/tasks/hooks/useTaskController';
import { Task, Subtask } from '../src/features/tasks/types';
import { FlashList } from '@shopify/flash-list';
import { RRule } from 'rrule';

// Import extracted modules
import { THEME, ViewMode, VIEW_CONFIG } from '../src/constants/theme';
import { toISODateString, isToday, getDayName, generateDates, formatDeadline, parseEstimatedTime, formatMinutesAsTime } from '../src/utils/dateHelpers';
import { resolveId } from '../src/utils/taskHelpers';
import { styles } from '../src/styles/taskListStyles';

// ============================================================================
// === MAIN COMPONENT ===
// ============================================================================

export default function TaskListScreen() {
    // --- STATE MANAGEMENT ---
    const flashListRef = useRef<any>(null);
    const router = useRouter();

    // Task Controller Hook
    const { tasks, loading, addTask, toggleTask, deleteTask, updateTask, refresh } = useTaskController();

    // UI State
    const [viewMode, setViewMode] = useState<ViewMode>('3days');
    const completionTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({});

    const [offset, setOffset] = useState(0);
    const [showViewPicker, setShowViewPicker] = useState(false);
    const [addingTaskForDate, setAddingTaskForDate] = useState<string | null>(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDeadline, setNewTaskDeadline] = useState<string | null>(null);
    const [newTaskEstimatedTime, setNewTaskEstimatedTime] = useState<string | null>(null);
    const [newTaskRecurrence, setNewTaskRecurrence] = useState<RecurrenceRule | null>(null);
    const [newTaskReminderTime, setNewTaskReminderTime] = useState<string | null>(null);
    const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
    const [calendarMode, setCalendarMode] = useState<'new' | 'edit'>('new');
    const [durationMode, setDurationMode] = useState<'new' | 'edit'>('new');
    const [isRecurrencePickerVisible, setIsRecurrencePickerVisible] = useState(false);
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);
    const [historyTasks, setHistoryTasks] = useState<Task[]>([]);

    // Edit State (uses extended task object with UI-specific recurrence field)
    const [editingTask, setEditingTask] = useState<any>(null);
    const [isDrawerVisible, setIsDrawerVisible] = useState(false);

    // Sprint Mode State
    const [isSprintSelectionMode, setIsSprintSelectionMode] = useState(false);
    const [selectedSprintTaskIds, setSelectedSprintTaskIds] = useState<Set<string>>(new Set());

    // Task Completion Cooldown State
    const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(new Set());

    const toggleSprintTaskSelection = (taskId: string) => {
        setSelectedSprintTaskIds(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) {
                next.delete(taskId);
            } else {
                next.add(taskId);
            }
            return next;
        });
    };

    const [editingSubtask, setEditingSubtask] = useState<{ parentId: string, subtask: Subtask } | null>(null);
    const [addingSubtaskToParentId, setAddingSubtaskToParentId] = useState<string | null>(null);

    // Tags State
    const [tags, setTags] = useState<TagDefinition[]>([]);

    // Profile State
    const [userAvatar, setUserAvatar] = useState<string | undefined>(undefined);

    // Reload tags/profile whenever screen focuses
    useFocusEffect(
        useCallback(() => {
            StorageService.loadTags().then(setTags);
            StorageService.loadProfile().then(p => {
                if (p?.avatar) setUserAvatar(p.avatar);
            });
            refresh(); // Reload tasks
        }, [refresh])
    );

    const handleSaveTags = (updatedTags: TagDefinition[]) => {
        setTags(updatedTags);
        StorageService.saveTags(updatedTags);
    };

    // Scroll Locking
    const [isListScrollEnabled, setIsListScrollEnabled] = useState(true);
    const handleSwipeStart = () => setIsListScrollEnabled(false);
    const handleSwipeEnd = () => setIsListScrollEnabled(true);

    // Menu State
    const [activeMenuTask, setActiveMenuTask] = useState<Task | null>(null);
    const [activeMenuSubtask, setActiveMenuSubtask] = useState<{ parentId: string, subtaskId: string } | null>(null);
    const [isMenuVisible, setIsMenuVisible] = useState(false);

    // Advanced Add State
    const [isCalendarVisible, setIsCalendarVisible] = useState(false);
    const [calendarInitialPage, setCalendarInitialPage] = useState(0);
    const [calendarTempDate, setCalendarTempDate] = useState<string | null>(null); // Draft deadline from drawer
    const [isDurationPickerVisible, setIsDurationPickerVisible] = useState(false);

    // Generate dates based on view mode and offset
    const dates = useMemo(() => generateDates(viewMode, offset), [viewMode, offset]);

    const todayString = toISODateString(new Date());

    // View start date for recurrence
    const viewStartDate = dates.length > 0 ? toISODateString(dates[0]) : toISODateString(new Date());

    // Project tasks for the current view
    const calendarItems = useMemo(() => {
        return RecurrenceEngine.generateCalendarItems(tasks, viewStartDate, VIEW_CONFIG[viewMode].days);
    }, [tasks, viewStartDate, viewMode]);

    // Helper to get items for specific date from projected list
    const getItemsForDate = (dateString: string) => {
        return calendarItems.filter(item => item.date === dateString);
    };

    // ============================================================================
    // === HANDLER FUNCTIONS ===
    // ============================================================================

    const updateTaskProgress = (taskId: string, value: number) => {
        // Just update progress, don't auto-complete.
        // Let onComplete (release) handle the toggle to ensure consistent "Undo" behavior.

        const { masterId, date, isInstance } = resolveId(taskId);

        if (isInstance && date) {
            // Update instance-specific progress on Master Task
            const masterTask = tasks.find(t => t.id === masterId);
            if (masterTask) {
                const newInstanceProgress = { ...(masterTask.instanceProgress || {}) };
                newInstanceProgress[date] = value;
                updateTask(masterId, { instanceProgress: newInstanceProgress });
            }
        } else {
            // Standard update for single tasks
            updateTask(taskId, { progress: value });
        }
    };

    const updateSubtaskProgress = (taskId: string, subtaskId: string, progress: number, dateContext?: string) => {
        let targetId = taskId;
        let dateString = dateContext || todayString;
        let isRecurrenceInstance = false;

        const { masterId, date: resolvedDate, isInstance } = resolveId(taskId);
        if (isInstance && resolvedDate) {
            dateString = resolvedDate;
            targetId = masterId;
            isRecurrenceInstance = true;
        } else {
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                if (!dateContext) dateString = task.date;
                if (task.rrule) isRecurrenceInstance = true;
            }
        }

        if (isRecurrenceInstance) {
            const masterTask = tasks.find(t => t.id === targetId);
            if (!masterTask) return;

            const newSubtasks = masterTask.subtasks?.map(st => {
                if (st.id === subtaskId) {
                    return { ...st, progress, completed: progress === 100 };
                }
                return st;
            }) || [];

            updateTask(targetId, { subtasks: newSubtasks });
        } else {
            const task = tasks.find(t => t.id === targetId);
            if (task) {
                const updatedSubtasks = task.subtasks?.map(st => {
                    if (st.id === subtaskId) {
                        return { ...st, progress, completed: progress === 100 };
                    }
                    return st;
                });
                updateTask(targetId, { subtasks: updatedSubtasks });
            }
        }
    };

    const handleListTaskToggle = (item: any) => {
        if (item.isCompleted) {
            toggleTask(item.originalTaskId, item.date);
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

            completionTimeouts.current[itemId] = setTimeout(async () => {
                // Add to history before toggling
                const taskToSave = {
                    id: item.id,
                    title: item.title,
                    date: item.date,
                    completed: true
                };
                await StorageService.addToHistory(taskToSave);

                toggleTask(item.originalTaskId, item.date);

                delete completionTimeouts.current[itemId];
                setCompletingTaskIds(prev => {
                    const next = new Set(prev);
                    next.delete(itemId);
                    return next;
                });
            }, 2000);
        }
    };

    // Handle restoring task from history
    const handleRestoreTask = async (taskId: string) => {
        const restoredTask = await StorageService.removeFromHistory(taskId);
        if (restoredTask) {
            // Re-add the task with a new date (today)
            const newTask: Task = {
                id: `${Date.now()}_restored`,
                title: restoredTask.title,
                date: todayString,
                completedDates: [],
                exceptionDates: [],
                subtasks: [],
                progress: 0
            };
            addTask(newTask);
            setHistoryTasks(prev => prev.filter(t => t.id !== taskId));
        }
    };

    const goToPrevious = () => {
        if (offset > 0) setOffset(prev => prev - 1);
    };

    const goToNext = () => {
        setOffset(prev => prev + 1);
    };

    const switchViewMode = (mode: ViewMode) => {
        setViewMode(mode);
        setOffset(0);
        setShowViewPicker(false);
    };

    const startAddingTask = (dateString: string) => {
        setAddingTaskForDate(dateString);
        setNewTaskTitle('');
        setNewTaskDeadline(null);
        setNewTaskEstimatedTime(null);
        setNewTaskRecurrence(null);
    };

    const handleSelectDate = (date: Date, includeTime: boolean = false) => {
        const dateStr = toISODateString(date);

        if (calendarMode === 'new') {
            if (includeTime) {
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                setNewTaskDeadline(`${dateStr}T${hours}:${minutes}`);
            } else {
                setNewTaskDeadline(dateStr);
            }
        } else if (editingSubtask) {
            let newDeadline = dateStr;
            if (includeTime) {
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                newDeadline = (`${dateStr}T${hours}:${minutes}`);
            }
            setEditingSubtask({
                ...editingSubtask,
                subtask: { ...editingSubtask.subtask, deadline: newDeadline }
            });
        } else if (editingTask) {
            let newDeadline = dateStr;
            if (includeTime) {
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                newDeadline = `${dateStr}T${hours}:${minutes}`;
            }
            setEditingTask({ ...editingTask, deadline: newDeadline });
        }
    };

    const handleSelectDuration = (duration: string) => {
        if (durationMode === 'new') {
            setNewTaskEstimatedTime(duration);
        } else if (editingSubtask) {
            setEditingSubtask({
                ...editingSubtask,
                subtask: { ...editingSubtask.subtask, estimatedTime: duration }
            });
        } else if (editingTask) {
            setEditingTask({ ...editingTask, estimatedTime: duration });
        }
    };

    const cancelAddingTask = () => {
        setAddingTaskForDate(null);
        setAddingSubtaskToParentId(null);
        setNewTaskTitle('');
        setNewTaskDeadline(null);
        setNewTaskEstimatedTime(null);
        setNewTaskRecurrence(null);
        setNewTaskReminderTime(null);
        Keyboard.dismiss();
    };

    const handleAddTask = (date: string | null) => {
        if (!newTaskTitle.trim()) return;

        // Subtask Creation Mode
        if (addingSubtaskToParentId) {
            const newSubtask: Subtask = {
                id: Date.now().toString(),
                title: newTaskTitle.trim(),
                completed: false,
                deadline: newTaskDeadline || undefined,
                estimatedTime: newTaskEstimatedTime || undefined,
            };

            const { masterId } = resolveId(addingSubtaskToParentId);
            const targetMasterId = masterId;

            const parentTask = tasks.find(t => t.id === targetMasterId);
            if (parentTask) {
                const updatedSubtasks = [...(parentTask.subtasks || []), newSubtask];
                updateTask(targetMasterId, { subtasks: updatedSubtasks });
            }

            setNewTaskTitle('');
            setNewTaskDeadline(null);
            setNewTaskEstimatedTime(null);
            setAddingSubtaskToParentId(null);
            return;
        }

        // Main Task Creation Mode
        if (!date) return;

        const taskId = Date.now().toString();

        let rruleString: string | undefined = undefined;

        if (newTaskRecurrence) {
            const freqMap: { [key: string]: any } = {
                'daily': RRule.DAILY,
                'weekly': RRule.WEEKLY,
                'monthly': RRule.MONTHLY,
                'yearly': RRule.YEARLY
            };

            const options: any = {
                freq: freqMap[newTaskRecurrence.frequency],
                interval: newTaskRecurrence.interval || 1,
                dtstart: new Date(date + 'T00:00:00')
            };

            if (newTaskRecurrence.endDate) {
                options.until = new Date(newTaskRecurrence.endDate);
            }
            if (newTaskRecurrence.occurrenceCount) {
                options.count = newTaskRecurrence.occurrenceCount;
            }
            if (newTaskRecurrence.daysOfWeek && newTaskRecurrence.daysOfWeek.length > 0) {
                const dayMap = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA];
                options.byweekday = newTaskRecurrence.daysOfWeek.map(d => dayMap[d]);
            }

            try {
                const rule = new RRule(options);
                rruleString = rule.toString();
            } catch (e) {
                console.error("Failed to generate rrule", e);
            }
        }

        const newTask: Task = {
            id: taskId,
            title: newTaskTitle.trim(),
            date: date,
            completedDates: [],
            exceptionDates: [],
            deadline: newTaskDeadline || undefined,
            estimatedTime: newTaskEstimatedTime || undefined,
            reminderTime: newTaskReminderTime || undefined,
            rrule: rruleString,
            subtasks: [],
            progress: 0
        };

        addTask(newTask);

        setNewTaskTitle('');
        setNewTaskDeadline(null);
        setNewTaskEstimatedTime(null);
        setNewTaskRecurrence(null);
        setNewTaskReminderTime(null);
        setAddingTaskForDate(null);
    };

    const handleConfirmDelete = (taskId: string) => {
        let dateString = todayString;
        let realTaskId = taskId;
        let isRecurrenceInstance = false;

        const { masterId, date, isInstance } = resolveId(taskId);

        if (isInstance && date) {
            dateString = date;
            realTaskId = masterId;
            isRecurrenceInstance = true;
        } else {
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                dateString = task.date;
                if (task.rrule) isRecurrenceInstance = true;
            }
        }

        const performDelete = (mode: 'single' | 'future') => {
            deleteTask(realTaskId, dateString, mode);
            setIsDrawerVisible(false);
            setEditingTask(null);
        };

        if (isRecurrenceInstance) {
            Alert.alert(
                "Delete Repeating Task",
                "Do you want to delete just this instance or all future tasks?",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "This One Only", onPress: () => performDelete('single') },
                    { text: "All Future Tasks", onPress: () => performDelete('future'), style: "destructive" }
                ]
            );
        } else {
            deleteTask(realTaskId, dateString, 'all');
            setIsDrawerVisible(false);
            setEditingTask(null);
        }
    };

    const completeTask = (itemId: string) => {
        let taskId = itemId;
        let dateString = todayString;

        const { masterId, date } = resolveId(itemId);

        if (date) {
            dateString = date;
            taskId = masterId;
        } else {
            const task = tasks.find(t => t.id === itemId);
            if (task) {
                dateString = task.date;
            }
        }

        toggleTask(taskId, dateString);
    };

    const openEditDrawer = (item: any) => {
        let drawerTask = {
            ...item,
            completed: item.isCompleted !== undefined ? item.isCompleted : (item.completed || false),
        };

        if (item.isGhost && item.originalTaskId) {
            const masterTask = tasks.find(t => t.id === item.originalTaskId);
            if (masterTask && masterTask.rrule) {
                try {
                    const rule = RRule.fromString(masterTask.rrule);
                    const opts = rule.options;

                    const freqMap: { [key: number]: 'daily' | 'weekly' | 'monthly' | 'yearly' } = {
                        [RRule.DAILY]: 'daily',
                        [RRule.WEEKLY]: 'weekly',
                        [RRule.MONTHLY]: 'monthly',
                        [RRule.YEARLY]: 'yearly'
                    };

                    const recurrenceObj: RecurrenceRule = {
                        frequency: freqMap[opts.freq] || 'daily',
                        interval: opts.interval || 1,
                    };

                    if (opts.until) {
                        recurrenceObj.endDate = opts.until.toISOString().split('T')[0];
                    }
                    if (opts.count) {
                        recurrenceObj.occurrenceCount = opts.count;
                    }
                    if (opts.byweekday && opts.byweekday.length > 0) {
                        const weekdayCodeMap: { [key: number]: string } = {
                            0: 'MO', 1: 'TU', 2: 'WE', 3: 'TH', 4: 'FR', 5: 'SA', 6: 'SU'
                        };
                        recurrenceObj.daysOfWeek = opts.byweekday.map((w: any) => {
                            const weekdayNum = typeof w === 'number' ? w : w.weekday;
                            return weekdayCodeMap[weekdayNum];
                        }).filter(Boolean) as any;
                    }

                    drawerTask.recurrence = recurrenceObj;
                    drawerTask.rrule = masterTask.rrule;
                } catch (e) {
                    console.warn('Failed to parse rrule for edit drawer', e);
                }
            }
        } else if (item.rrule) {
            try {
                const rule = RRule.fromString(item.rrule);
                const opts = rule.options;

                const freqMap: { [key: number]: 'daily' | 'weekly' | 'monthly' | 'yearly' } = {
                    [RRule.DAILY]: 'daily',
                    [RRule.WEEKLY]: 'weekly',
                    [RRule.MONTHLY]: 'monthly',
                    [RRule.YEARLY]: 'yearly'
                };

                const recurrenceObj: RecurrenceRule = {
                    frequency: freqMap[opts.freq] || 'daily',
                    interval: opts.interval || 1,
                };

                if (opts.until) {
                    recurrenceObj.endDate = opts.until.toISOString().split('T')[0];
                }
                if (opts.count) {
                    recurrenceObj.occurrenceCount = opts.count;
                }
                if (opts.byweekday && opts.byweekday.length > 0) {
                    const weekdayCodeMap: { [key: number]: string } = {
                        0: 'MO', 1: 'TU', 2: 'WE', 3: 'TH', 4: 'FR', 5: 'SA', 6: 'SU'
                    };
                    recurrenceObj.daysOfWeek = opts.byweekday.map((w: any) => {
                        const weekdayNum = typeof w === 'number' ? w : w.weekday;
                        return weekdayCodeMap[weekdayNum];
                    }).filter(Boolean) as any;
                }

                drawerTask.recurrence = recurrenceObj;
            } catch (e) {
                console.warn('Failed to parse rrule for edit drawer', e);
            }
        }

        setEditingTask(drawerTask);
        setIsDrawerVisible(true);
    };

    const openMenu = (task: any) => {
        setActiveMenuSubtask(null);
        setActiveMenuTask(task);
        setIsMenuVisible(true);
    };



    const handleMenuDelete = () => {
        if (activeMenuTask) {
            handleConfirmDelete(activeMenuTask.id);
            setIsMenuVisible(false);
            setActiveMenuTask(null);
        } else if (activeMenuSubtask) {
            deleteSubtask(activeMenuSubtask.parentId, activeMenuSubtask.subtaskId);
            setIsMenuVisible(false);
            setActiveMenuSubtask(null);
        }
    };

    const openSubtaskMenu = (parentId: string, subtaskId: string) => {
        setActiveMenuSubtask({ parentId, subtaskId });
        setIsMenuVisible(true);
    };

    const handleMenuAddSubtask = () => {
        if (activeMenuTask) {
            setAddingSubtaskToParentId(activeMenuTask.id);
            setNewTaskTitle('');
            setNewTaskDeadline(null);
            setNewTaskEstimatedTime(null);
            setActiveMenuTask(null);
            setIsMenuVisible(false);
        }
    };

    const saveEditedTask = (updatedTask: Task) => {
        // Handle "New Task" creation
        if (updatedTask.id.startsWith('new_temp_')) {
            const finalTask = { ...updatedTask, id: Date.now().toString() };
            addTask(finalTask);
            setEditingTask(null);
            setIsDrawerVisible(false);
            return;
        }

        // Handle Editing Existing Task
        let masterTaskId = updatedTask.id;
        let dateString = updatedTask.date;
        let isRecurrenceInstance = false;

        // Check if we are editing a "Ghost" or "Instance"
        if (editingTask?.id.includes('_')) {
            // Ghost ID: masterId_date
            const parts = editingTask.id.split('_');
            masterTaskId = parts[0];
            dateString = parts[1];
            isRecurrenceInstance = true;
        } else if (editingTask?.rrule && editingTask.date) {
            // Real recurring task instance? (Usually ghosts carry the rrule)
            // But if we edited a real task that HAS rrule, it's the Master itself?
            // If user wants to edit "This Instance", we need `isRecurrenceInstance` flag passed from UI.
            // But our `editingTask` state comes from `openEditDrawer`.
        }

        if (isRecurrenceInstance) {
            // DETACH PATTERN (Exception)
            // 1. Create New Single Task for this date
            const detachedTask: Task = {
                ...updatedTask,
                id: Date.now().toString(), // New ID
                date: dateString,
                rrule: undefined, // Detached successfully
                completedDates: [], // Reset for single task
                exceptionDates: []
            };

            // 2. Add Exclusion to Master Task
            const masterTask = tasks.find(t => t.id === masterTaskId);
            if (masterTask) {
                const newExceptions = new Set(masterTask.exceptionDates || []);
                newExceptions.add(dateString);

                // Update Master (Exclusion)
                updateTask(masterTaskId, { exceptionDates: Array.from(newExceptions) });

                // Add Detached Task
                addTask(detachedTask);
            } else {
                console.warn("Master task not found for detach", masterTaskId);
                // Fallback: just add the new task? But then ghost duplicates?
                addTask(detachedTask);
            }
        } else {
            // Standard Update (Master or Single)
            updateTask(updatedTask.id, updatedTask);
        }

        setEditingTask(null);
        setIsDrawerVisible(false);
    };

    const saveSubtask = (subtaskData: any) => {
        const newSubtask = {
            id: (editingSubtask ? subtaskData.id : Date.now().toString()),
            title: subtaskData.title,
            completed: subtaskData.completed || false,
            deadline: subtaskData.deadline,
            estimatedTime: subtaskData.estimatedTime,
        };

        if (editingSubtask) {
            const parentTask = tasks.find(t => t.id === editingSubtask.parentId);
            if (parentTask) {
                const updatedSubtasks = parentTask.subtasks?.map(s => s.id === editingSubtask.subtask.id ? newSubtask : s) || [];
                updateTask(editingSubtask.parentId, { subtasks: updatedSubtasks });
            }
        } else if (addingSubtaskToParentId) {
            const { masterId } = resolveId(addingSubtaskToParentId);
            const targetMasterId = masterId;

            const parentTask = tasks.find(t => t.id === targetMasterId);
            if (parentTask) {
                const updatedSubtasks = [...(parentTask.subtasks || []), newSubtask];
                updateTask(targetMasterId, { subtasks: updatedSubtasks });
            }
        }

        setEditingSubtask(null);
        setAddingSubtaskToParentId(null);
        setIsDrawerVisible(false);
    };

    const toggleSubtask = (parentId: string, subtaskId: string, dateContext?: string) => {
        let targetId = parentId;
        let dateString = dateContext || todayString;
        let isRecurrenceInstance = false;

        const { masterId, date, isInstance } = resolveId(parentId);
        if (isInstance && date) {
            dateString = date;
            targetId = masterId;
            isRecurrenceInstance = true;
        } else {
            const task = tasks.find(t => t.id === parentId);
            if (task) {
                if (!dateContext) dateString = task.date;
                if (task.rrule) isRecurrenceInstance = true;
            }
        }

        if (isRecurrenceInstance && masterId && dateString) {
            const masterTask = tasks.find(t => t.id === masterId);
            if (!masterTask) return;

            // Get current subtasks for this instance (or fallback to template reset)
            const currentInstanceSubtasks = (masterTask.instanceSubtasks && masterTask.instanceSubtasks[dateString])
                ? masterTask.instanceSubtasks[dateString]
                : (masterTask.subtasks?.map(s => ({ ...s, completed: false })) || []);

            // Toggle the specific subtask
            const newSubtasks = currentInstanceSubtasks.map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s);

            // Save back to instanceSubtasks
            const newInstanceSubtasksMap = { ...(masterTask.instanceSubtasks || {}) };
            newInstanceSubtasksMap[dateString] = newSubtasks;

            updateTask(masterId, { instanceSubtasks: newInstanceSubtasksMap });
        } else {
            const task = tasks.find(t => t.id === parentId);
            if (task) {
                const subtasks = task.subtasks?.map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s);
                updateTask(parentId, { subtasks });
            }
        }
    };

    const deleteSubtask = (parentId: string, subtaskId: string) => {
        const { masterId } = resolveId(parentId);
        const targetMasterId = masterId;

        const parentTask = tasks.find(t => t.id === targetMasterId);
        if (parentTask) {
            const updatedSubtasks = parentTask.subtasks?.filter(s => s.id !== subtaskId);
            updateTask(targetMasterId, { subtasks: updatedSubtasks });
        }
    };

    const toggleSprintSelectionMode = () => {
        setIsSprintSelectionMode(prev => !prev);
        setSelectedSprintTaskIds(new Set());
    };

    const toggleTaskSelection = (id: string) => {
        setSelectedSprintTaskIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const startSprint = async () => {
        if (selectedSprintTaskIds.size === 0) return;

        const selectedTasks = tasks.filter(t => selectedSprintTaskIds.has(t.id));
        await StorageService.saveSprintTasks(selectedTasks);

        router.push({
            pathname: '/sprint',
            params: { taskIds: JSON.stringify(Array.from(selectedSprintTaskIds)) }
        });
    };

    const openEditSubtask = (parentId: string, subtask: any) => {
        setEditingSubtask({ parentId, subtask });
        setIsDrawerVisible(true);
    };

    // ============================================================================
    // === RENDER ===
    // ============================================================================

    return (
        <SafeAreaView style={[styles.container, isSprintSelectionMode && styles.sprintContainer]}>
            {/* Top Header Row */}
            <View style={[styles.header, isSprintSelectionMode && styles.sprintHeader]}>
                <ProfileButton avatarUri={userAvatar} />

                <View style={styles.toolbar}>
                    <TouchableOpacity
                        style={styles.todayButton}
                        onPress={() => setOffset(0)}
                    >
                        <Text style={styles.todayButtonText}>Today</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.toolbarButton}
                        onPress={() => {/* Friends Logic */ }}
                    >
                        <Ionicons name="people-outline" size={24} color="#333" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.toolbarButton}
                        onPress={() => router.push('/mail')}
                    >
                        <Ionicons name="mail-outline" size={24} color="#333" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.toolbarButton}
                        onPress={() => router.push('/long-term')}
                    >
                        <Ionicons name="telescope-outline" size={24} color="#333" />
                    </TouchableOpacity>
                </View>

                <View style={styles.spacer} />
                <SettingsButton />
            </View>

            {/* View Navigation Row */}
            <View style={styles.viewNavRow}>
                <TouchableOpacity
                    style={[styles.arrowButton, offset === 0 && styles.arrowButtonDisabled]}
                    onPress={goToPrevious}
                    disabled={offset === 0}
                >
                    <Ionicons name="chevron-back" size={24} color={offset === 0 ? '#CCC' : '#333'} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.viewLabelButton}
                    onPress={() => setShowViewPicker(true)}
                >
                    <Text style={styles.viewLabel}>{VIEW_CONFIG[viewMode].label}</Text>
                    <Ionicons name="chevron-down" size={16} color="#666" style={{ marginTop: 2 }} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.arrowButton}
                    onPress={goToNext}
                >
                    <Ionicons name="chevron-forward" size={24} color="#333" />
                </TouchableOpacity>
                <View style={{ flex: 1 }} />

                <TouchableOpacity
                    style={[
                        styles.sprintHeaderButton,
                        isSprintSelectionMode && styles.sprintHeaderButtonActive
                    ]}
                    onPress={toggleSprintSelectionMode}
                >
                    <Text style={[
                        styles.sprintHeaderButtonText,
                        isSprintSelectionMode && styles.sprintHeaderButtonTextActive
                    ]}>
                        {isSprintSelectionMode ? "Cancel" : "Sprint"}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.toolbarButton}
                    onPress={() => {/* Organize Logic */ }}
                >
                    <Feather name="list" size={24} color="#333" />
                </TouchableOpacity>
            </View>

            {/* View Picker Modal */}
            <Modal
                visible={showViewPicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowViewPicker(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowViewPicker(false)}
                >
                    <View style={styles.viewPickerContainer}>
                        {(Object.keys(VIEW_CONFIG) as ViewMode[]).map((mode) => (
                            <TouchableOpacity
                                key={mode}
                                style={[
                                    styles.viewPickerOption,
                                    viewMode === mode && styles.viewPickerOptionActive
                                ]}
                                onPress={() => switchViewMode(mode)}
                            >
                                <Text style={[
                                    styles.viewPickerText,
                                    viewMode === mode && styles.viewPickerTextActive
                                ]}>
                                    {VIEW_CONFIG[mode].label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Date List using FlashList */}
            {/* @ts-ignore */}
            <FlashList
                data={dates}
                extraData={calendarItems}
                estimatedItemSize={150}
                keyExtractor={(item) => toISODateString(item)}
                scrollEnabled={isListScrollEnabled}
                contentContainerStyle={styles.scrollContent}
                renderItem={({ item: date }) => {
                    const dateString = toISODateString(date);
                    const dailyItems = getItemsForDate(dateString);
                    const isAddingHere = addingTaskForDate === dateString;
                    const isTodayDate = isToday(date);

                    // Daily Time Calc & Task Count
                    let totalMinutes = 0;
                    let tasksWithoutTimeCount = 0;

                    dailyItems.forEach((item) => {
                        if (item.isCompleted) return;

                        let taskHasTime = false;

                        if (item.estimatedTime) {
                            const mins = parseEstimatedTime(item.estimatedTime);
                            if (mins > 0) {
                                totalMinutes += mins;
                                taskHasTime = true;
                            }
                        }

                        if (item.subtasks) {
                            item.subtasks.forEach(sub => {
                                if (!sub.completed && sub.estimatedTime) {
                                    const mins = parseEstimatedTime(sub.estimatedTime);
                                    if (mins > 0) {
                                        totalMinutes += mins;
                                        taskHasTime = true;
                                    }
                                }
                            });
                        }

                        if (!taskHasTime) {
                            tasksWithoutTimeCount++;
                        }
                    });

                    const timePart = totalMinutes > 0 ? formatMinutesAsTime(totalMinutes) : '';

                    let summaryString = '';
                    if (timePart && tasksWithoutTimeCount > 0) {
                        summaryString = `${timePart} + ${tasksWithoutTimeCount} tasks`;
                    } else if (timePart) {
                        summaryString = timePart;
                    } else {
                        summaryString = `${tasksWithoutTimeCount} tasks`;
                    }

                    return (
                        <View>
                            {/* Date Header with Daily Stats */}
                            <View style={[
                                styles.dateHeader,
                                isTodayDate && styles.todayHeader
                            ]}>
                                <View>
                                    <Text style={[
                                        styles.dayName,
                                        isTodayDate && styles.todayDayName
                                    ]}>
                                        {getDayName(date)}
                                    </Text>
                                    <Text style={styles.dateSubtext}>
                                        {date.getDate()} {date.toLocaleDateString('en-US', { month: 'long' })}
                                    </Text>
                                </View>

                                <View style={styles.dailyTimeContainer}>
                                    <Text style={styles.dailyTimeSum}>
                                        {summaryString}
                                    </Text>
                                </View>
                            </View>

                            {/* Task List */}
                            <View style={styles.taskList}>
                                {dailyItems.map((item) => (
                                    <View key={item.id} style={styles.taskCard}>
                                        <SwipeableTaskRow
                                            id={item.id}
                                            recurrence={item.rrule}
                                            title={item.title}
                                            completed={item.isCompleted}
                                            deadline={item.deadline}
                                            estimatedTime={item.estimatedTime}
                                            progress={item.progress}
                                            daysRolled={0}
                                            menuIcon="dots-horizontal"
                                            menuColor="#94A3B8"
                                            onProgressUpdate={updateTaskProgress}
                                            onComplete={() => handleListTaskToggle(item)}
                                            isCompleting={completingTaskIds.has(item.id)}
                                            onEdit={() => openEditDrawer(item as any)}
                                            onMenu={() => openMenu(item as any)}
                                            formatDeadline={formatDeadline}
                                            onSwipeStart={handleSwipeStart}
                                            onSwipeEnd={handleSwipeEnd}
                                            isSelectionMode={isSprintSelectionMode}
                                            isSelected={selectedSprintTaskIds.has(item.id)}
                                            onSelect={() => toggleTaskSelection(item.id)}
                                            activeTags={item.tagIds ? tags.filter(t => item.tagIds?.includes(t.id)) : []}
                                        />

                                        {/* Subtasks */}
                                        {item.subtasks && item.subtasks.map(subtask => (
                                            <SwipeableTaskRow
                                                key={subtask.id}
                                                id={subtask.id}
                                                title={subtask.title}
                                                completed={subtask.completed}
                                                estimatedTime={subtask.estimatedTime}
                                                deadline={subtask.deadline}
                                                menuIcon="dots-horizontal"
                                                isSubtask={true}
                                                onProgressUpdate={(id, val) => updateSubtaskProgress(item.originalTaskId, subtask.id, val, item.date)}
                                                onComplete={() => toggleSubtask(item.originalTaskId, subtask.id, item.date)}
                                                onEdit={() => openEditSubtask(item.originalTaskId, subtask)}
                                                onMenu={() => openSubtaskMenu(item.originalTaskId, subtask.id)}
                                                formatDeadline={formatDeadline}
                                                onSwipeStart={handleSwipeStart}
                                                onSwipeEnd={handleSwipeEnd}
                                                isSelectionMode={isSprintSelectionMode}
                                                // Subtasks don't usually have their own tags, but if they did:
                                                activeTags={[]}
                                            />
                                        ))}
                                    </View>
                                ))}
                            </View>

                            {/* Add Task Footer Button */}
                            {!isAddingHere && (
                                <TouchableOpacity
                                    style={styles.addTaskSpace}
                                    onPress={() => startAddingTask(dateString)}
                                >
                                    <Ionicons name="add" style={styles.addTaskIcon} />
                                    <View style={styles.addTaskTextContainer}>
                                        <Text style={styles.addTaskText}>Add Task</Text>
                                        <View style={styles.addTaskUnderline} />
                                    </View>
                                </TouchableOpacity>
                            )}

                            {/* Add Task Input */}
                            {isAddingHere && (
                                <View style={styles.addTaskContainer}>
                                    <View style={styles.addTaskRow}>
                                        <View style={styles.checkboxPlaceholder} />
                                        <TextInput
                                            ref={inputRef}
                                            style={styles.addTaskInput}
                                            placeholder="What needs to be done?"
                                            placeholderTextColor="#999"
                                            value={newTaskTitle}
                                            onChangeText={setNewTaskTitle}
                                            onSubmitEditing={() => handleAddTask(dateString)}
                                            blurOnSubmit={false}
                                        />
                                        <TouchableOpacity onPress={cancelAddingTask}>
                                            <Ionicons name="close-circle" size={24} color="#CCC" />
                                        </TouchableOpacity>
                                    </View>

                                    <View style={styles.addTaskActions}>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                            <TouchableOpacity
                                                style={[styles.addOptionChip, newTaskDeadline && styles.addOptionChipActive]}
                                                onPress={() => {
                                                    setCalendarMode('new');
                                                    setIsCalendarVisible(true);
                                                }}
                                            >
                                                <Ionicons name="calendar-outline" size={16} color={newTaskDeadline ? "#FFF" : "#666"} />
                                                <Text style={[styles.addOptionText, newTaskDeadline && { color: "#FFF" }]}>
                                                    {newTaskDeadline ? formatDeadline(newTaskDeadline) : "Date"}
                                                </Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[styles.addOptionChip, newTaskEstimatedTime && styles.addOptionChipActive]}
                                                onPress={() => {
                                                    setDurationMode('new');
                                                    setIsDurationPickerVisible(true);
                                                }}
                                            >
                                                <Feather name="clock" size={16} color={newTaskEstimatedTime ? "#FFF" : "#666"} />
                                                <Text style={[styles.addOptionText, newTaskEstimatedTime && { color: "#FFF" }]}>
                                                    {newTaskEstimatedTime || "Duration"}
                                                </Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[styles.addOptionChip, newTaskReminderTime && styles.addOptionChipActive]}
                                                onPress={() => setIsTimePickerVisible(true)}
                                            >
                                                <Ionicons name="notifications-outline" size={16} color={newTaskReminderTime ? "#FFF" : "#666"} />
                                                <Text style={[styles.addOptionText, newTaskReminderTime && { color: "#FFF" }]}>
                                                    {newTaskReminderTime ? `🔔 ${(() => {
                                                        const [h, m] = newTaskReminderTime.split(':').map(Number);
                                                        const period = h >= 12 ? 'PM' : 'AM';
                                                        const displayH = h % 12 || 12;
                                                        return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
                                                    })()}` : "Remind"}
                                                </Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={styles.addSaveButton}
                                                onPress={() => handleAddTask(dateString)}
                                            >
                                                <Text style={styles.addSaveText}>Add</Text>
                                            </TouchableOpacity>
                                        </ScrollView>
                                    </View>
                                </View>
                            )}
                        </View>
                    );
                }}
            />

            {/* Fixed Quick Add Bar */}
            {(addingTaskForDate || addingSubtaskToParentId) && (
                <>
                    <TouchableOpacity
                        style={styles.backdropLayer}
                        activeOpacity={1}
                        onPress={cancelAddingTask}
                    />

                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.fixedInputContainer}
                        pointerEvents="box-none"
                    >
                        <View style={styles.addTaskContainer}>
                            <View style={styles.addTaskInputWrapper}>
                                <TextInput
                                    ref={inputRef}
                                    style={styles.addTaskInput}
                                    placeholder={addingSubtaskToParentId ? "Add a subtask..." : "Write something..."}
                                    placeholderTextColor="#999"
                                    value={newTaskTitle}
                                    onChangeText={setNewTaskTitle}
                                    autoFocus
                                    onSubmitEditing={() => handleAddTask(addingTaskForDate)}
                                />
                                <TouchableOpacity onPress={() => handleAddTask(addingTaskForDate)} style={styles.tactileButton}>
                                    <Text style={styles.tactileButtonText}>Save</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.addToolbar}>
                                <TouchableOpacity
                                    onPress={() => {
                                        setCalendarMode('new');
                                        setIsCalendarVisible(true);
                                    }}
                                    style={styles.toolbarIconBtn}
                                >
                                    <Text style={styles.toolbarEmoji}>📅</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => {
                                        setDurationMode('new');
                                        setIsDurationPickerVisible(true);
                                    }}
                                    style={styles.toolbarIconBtn}
                                >
                                    <Text style={styles.toolbarEmoji}>⏱</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.toolbarIconBtn} activeOpacity={1}>
                                    <Text style={styles.toolbarEmoji}>⏰</Text>
                                </TouchableOpacity>

                                {!addingSubtaskToParentId && (
                                    <TouchableOpacity
                                        style={styles.toolbarIconBtn}
                                        onPress={() => setIsRecurrencePickerVisible(true)}
                                    >
                                        <Text style={styles.toolbarEmoji}>🔁</Text>
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity style={styles.toolbarIconBtn} activeOpacity={1}>
                                    <Text style={styles.toolbarEmoji}>🏷️</Text>
                                </TouchableOpacity>

                                {newTaskDeadline && (
                                    <TouchableOpacity onPress={() => setNewTaskDeadline(null)} style={styles.miniChip}>
                                        <Text style={styles.miniChipText}>{newTaskDeadline}</Text>
                                    </TouchableOpacity>
                                )}
                                {newTaskEstimatedTime && (
                                    <TouchableOpacity onPress={() => setNewTaskEstimatedTime(null)} style={styles.miniChip}>
                                        <Text style={styles.miniChipText}>{newTaskEstimatedTime}</Text>
                                    </TouchableOpacity>
                                )}
                                {newTaskRecurrence && (
                                    <TouchableOpacity onPress={() => setNewTaskRecurrence(null)} style={styles.miniChip}>
                                        <Text style={styles.miniChipText}>
                                            {newTaskRecurrence.frequency === 'weekly' && newTaskRecurrence.daysOfWeek
                                                ? 'Custom W'
                                                : newTaskRecurrence.frequency.charAt(0).toUpperCase() + newTaskRecurrence.frequency.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                <View style={{ flex: 1 }} />

                                <TouchableOpacity onPress={cancelAddingTask} style={styles.cancelBtn}>
                                    <Text style={styles.cancelAddText}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </>
            )}

            {/* Sprint Start Button Overlay */}
            {isSprintSelectionMode && (
                <View style={styles.startSprintContainer}>
                    <TouchableOpacity
                        style={[styles.startSprintButton, selectedSprintTaskIds.size === 0 && styles.startSprintButtonDisabled]}
                        onPress={startSprint}
                        disabled={selectedSprintTaskIds.size === 0}
                    >
                        <MaterialCommunityIcons name="play" size={32} color="#FFF" />
                        <Text style={styles.startSprintText}>
                            {selectedSprintTaskIds.size > 0 ? `Start Sprint (${selectedSprintTaskIds.size})` : "Select Tasks to Start"}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Edit Task / Subtask Drawer */}
            <TaskEditDrawer
                visible={isDrawerVisible}
                task={editingSubtask ? (editingSubtask.subtask as any) : editingTask}
                onSave={editingSubtask || addingSubtaskToParentId ? saveSubtask : saveEditedTask}
                onClose={() => {
                    setIsDrawerVisible(false);
                    setEditingTask(null);
                }}
                onRequestCalendar={(currentDeadline) => {
                    setCalendarInitialPage(0);
                    setCalendarMode('edit');
                    setCalendarTempDate(currentDeadline);
                    setIsCalendarVisible(true);
                }}
                onRequestDuration={() => {
                    setDurationMode('edit');
                    setIsDurationPickerVisible(true);
                }}
                onRequestTime={(currentDeadline) => {
                    setCalendarInitialPage(1); // Open Time Picker directly
                    setCalendarMode('edit');
                    setCalendarTempDate(currentDeadline);
                    setIsCalendarVisible(true);
                }}
                availableTags={tags}
            // No onManageTags prop (removes the button capability)
            />

            {/* Task Menu */}
            <TaskMenu
                visible={isMenuVisible}
                onClose={() => setIsMenuVisible(false)}
                onAddSubtask={handleMenuAddSubtask}
                onDelete={handleMenuDelete}
                isSubtask={!!activeMenuSubtask}
            />

            {/* Pickers */}
            <CalendarModal
                visible={isCalendarVisible}
                onClose={() => setIsCalendarVisible(false)}
                onSelectDate={handleSelectDate}
                selectedDate={
                    calendarMode === 'new'
                        ? newTaskDeadline
                        : (calendarTempDate !== null ? calendarTempDate : editingTask?.deadline)
                }
                initialPage={calendarInitialPage}
            />

            <DurationPickerModal
                visible={isDurationPickerVisible}
                onClose={() => setIsDurationPickerVisible(false)}
                onSelectDuration={handleSelectDuration}
                initialDuration={durationMode === 'new' ? newTaskEstimatedTime : editingTask?.estimatedTime}
            />

            <RecurrencePickerModal
                visible={isRecurrencePickerVisible}
                onClose={() => setIsRecurrencePickerVisible(false)}
                onSave={setNewTaskRecurrence}
                initialRule={newTaskRecurrence}
            />

            {/* Removed TagSettingsModal from here */}



            <TimePickerModal
                visible={isTimePickerVisible}
                onClose={() => setIsTimePickerVisible(false)}
                onSelectTime={(time) => {
                    setNewTaskReminderTime(time || null);
                }}
                initialTime={newTaskReminderTime || undefined}
            />
        </SafeAreaView>
    );
}
