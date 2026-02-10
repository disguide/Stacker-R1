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
import ColorSettingsModal from '../src/components/ColorSettingsModal'; // Import ColorSettingsModal
import { TaskQuickAdd } from '../src/components/TaskQuickAdd';
import { TaskListHeader } from '../src/components/TaskListHeader';
import { StorageService, RecurrenceRule, RecurrenceFrequency, WeekDay, ColorDefinition } from '../src/services/storage';
import { RecurrenceEngine } from '../src/features/tasks/logic/recurrenceEngine';
import { useTaskController } from '../src/features/tasks/hooks/useTaskController';
import { useTaskForm } from '../src/features/tasks/hooks/useTaskForm';
import { useTaskNavigation } from '../src/features/tasks/hooks/useTaskNavigation';
import { useSprintMode } from '../src/features/tasks/hooks/useSprintMode';
import { useTaskUI } from '../src/features/tasks/hooks/useTaskUI';
import { Task, Subtask } from '../src/features/tasks/types';
import { FlashList } from '@shopify/flash-list';
import { RRule } from 'rrule';

// Import extracted modules
import { THEME, ViewMode, VIEW_CONFIG } from '../src/constants/theme';
import { toISODateString, isToday, getDayName, generateDates, formatDeadline, parseEstimatedTime, formatMinutesAsTime, getDaysDifference } from '../src/utils/dateHelpers';
import { resolveId } from '../src/utils/taskHelpers';
import { styles } from '../src/styles/taskListStyles';

// ============================================================================
// === MAIN COMPONENT ===
// ============================================================================

export default function TaskListScreen() {
    // --- STATE MANAGEMENT ---
    const flashListRef = useRef<any>(null);
    const inputRef = useRef<TextInput>(null);
    const router = useRouter();

    // Task Controller Hook
    const { tasks, loading, addTask, toggleTask, deleteTask, updateTask, toggleSubtask, updateSubtask, refresh } = useTaskController();

    // Navigation Hook
    const {
        viewMode, setViewMode,
        offset, setOffset,
        showViewPicker, setShowViewPicker,
        dates
    } = useTaskNavigation();

    const completionTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({});
    const [userAvatar, setUserAvatar] = useState<string | undefined>(undefined);

    // Dynamic Colors State
    // Initialize with defaults to avoid empty state before storage loads


    // Dynamic Colors State
    // Initialize with defaults to avoid empty state before storage loads
    const [userColors, setUserColors] = useState<ColorDefinition[]>(StorageService.getDefaultUserColors());

    // Form Hook
    const form = useTaskForm();
    const {
        addingTaskForDate, setAddingTaskForDate,
        newTaskTitle, setNewTaskTitle,
        newTaskDeadline, setNewTaskDeadline,
        newTaskEstimatedTime, setNewTaskEstimatedTime,
        newTaskRecurrence, setNewTaskRecurrence,
        newTaskReminderTime, setNewTaskReminderTime,
        addingSubtaskToParentId, setAddingSubtaskToParentId,
        resetForm: cancelAddingTask,
        startAddingTask
    } = form;

    const parentTask = addingSubtaskToParentId ? tasks.find(t => t.id === addingSubtaskToParentId) : null;


    // UI Visibility & Transient State Hook
    const {
        isTimePickerVisible, setIsTimePickerVisible,
        isRecurrencePickerVisible, setIsRecurrencePickerVisible,
        isHistoryVisible, setIsHistoryVisible,
        isColorSettingsVisible, setIsColorSettingsVisible,
        isCalendarVisible, setIsCalendarVisible,
        calendarMode, setCalendarMode,
        calendarInitialPage, setCalendarInitialPage,
        calendarTempDate, setCalendarTempDate,
        isDurationPickerVisible, setIsDurationPickerVisible,
        durationMode, setDurationMode,
        isDrawerVisible, setIsDrawerVisible,
        editingTask, setEditingTask,
        editingSubtask, setEditingSubtask,
        isMenuVisible, setIsMenuVisible,
        activeMenuTask, setActiveMenuTask,
        activeMenuSubtask, setActiveMenuSubtask
    } = useTaskUI();

    const [historyTasks, setHistoryTasks] = useState<Task[]>([]);

    // Sprint Mode Hook
    const {
        isSprintSelectionMode,
        selectedSprintTaskIds,
        toggleSprintSelectionMode,
        toggleSprintTaskSelection,
        startSprint
    } = useSprintMode(tasks);

    // Task Completion Cooldown State
    const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(new Set());

    // Reload profile/colors whenever screen focuses
    useFocusEffect(
        useCallback(() => {
            StorageService.loadProfile().then(p => {
                if (p?.avatar) setUserAvatar(p.avatar);
            });
            StorageService.loadUserColors().then(setUserColors);
            refresh(); // Reload tasks
        }, [refresh])
    );

    const handleSaveUserColors = (colors: ColorDefinition[]) => {
        console.log('[TaskListScreen] handleSaveUserColors:', colors);
        setUserColors(colors);
        StorageService.saveUserColors(colors);
    };

    // Scroll Locking
    const [isListScrollEnabled, setIsListScrollEnabled] = useState(true);
    const handleSwipeStart = () => setIsListScrollEnabled(false);
    const handleSwipeEnd = () => setIsListScrollEnabled(true);




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

    const handleSubtaskProgress = (taskId: string, subtaskId: string, progress: number, dateContext?: string) => {
        // We pass the RAW taskId (which might be task_date) to the hook?
        // The hook expects taskId to handle Ghost IDs internally, OR we can resolve here.
        // My hook implementation does: const originalId = taskId.includes('_') ? ...
        // So it handles Ghost IDs safely.
        // What about 'dateContext'?
        // The hook expects 'dateString' to update instanceSubtasks map.
        // So we should pass the dateContext (originalDate or date).

        updateSubtask(taskId, subtaskId, progress, dateContext || todayString);
    };

    const handleListTaskToggle = (item: any) => {
        console.log('[handleListTaskToggle] Toggling:', { id: item.id, originalDate: item.originalDate, projectedDate: item.date });
        if (item.isCompleted) {
            toggleTask(item.originalTaskId, item.originalDate || item.date);
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

                toggleTask(item.originalTaskId, item.originalDate || item.date);

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



    const switchViewMode = (mode: ViewMode) => {
        setViewMode(mode);
        setOffset(0);
        setShowViewPicker(false);
    };

    const handleSelectDate = (date: Date | null, includeTime: boolean = false) => {
        if (!date) {
            if (calendarMode === 'new') {
                setNewTaskDeadline(null);
            } else if (editingSubtask) {
                setEditingSubtask({
                    ...editingSubtask,
                    subtask: { ...editingSubtask.subtask, deadline: undefined }
                });
            } else if (editingTask) {
                setEditingTask({ ...editingTask, deadline: undefined });
            }
            return;
        }

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

            if (parentTask) {
                const updatedSubtasks = [...(parentTask.subtasks || []), newSubtask];
                updateTask(targetMasterId, { subtasks: updatedSubtasks });
            }

            cancelAddingTask();
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

        cancelAddingTask();
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

        // Helper needs to find the item first to check for originalDate if it's a rollover
        // However, this helper is seemingly unused or used by menu. 
        // Best effort: resolveId usually works, but if we have the item object, use that.
        // For menu actions, we usually passed the object.
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

    const saveEditedTask = (updatedTask: Task, shouldClose: boolean = true) => {
        // 1. HANDLE NEW TASK CREATION
        if (updatedTask.id.startsWith('new_temp_')) {
            const finalTask = { ...updatedTask, id: Date.now().toString() };
            // Generate RRule if recurrence is set
            if (finalTask.recurrence) {
                const rrule = generateRRuleString(finalTask.recurrence, finalTask.date);
                if (rrule) finalTask.rrule = rrule;
            }
            addTask(finalTask);
            setEditingTask(null);
            setIsDrawerVisible(false);
            return;
        }

        // 2. DETECT CONTEXT (Series vs Single)
        // Check if we are editing a "Ghost" instance or the Master itself
        let originalMasterId = updatedTask.id;
        let isFutureInstance = false;
        let instanceDate = updatedTask.originalDate || updatedTask.date;

        if (editingTask?.isGhost && editingTask.originalTaskId) {
            originalMasterId = editingTask.originalTaskId;
            isFutureInstance = true; // By definition, ghosts are projections
            // However, if the ghost date == master start date, we treat it as "Edit Series" from start
        } else if (editingTask?.rrule) {
            // We are editing the master task directly (e.g. from key list)
            // Or the very first instance
            originalMasterId = editingTask.id;
        }

        const originalMaster = tasks.find(t => t.id === originalMasterId);

        if (!originalMaster) {
            // Fallback: Just update what we have
            updateTask(updatedTask.id, updatedTask);
            if (shouldClose) {
                setEditingTask(null);
                setIsDrawerVisible(false);
            }
            return;
        }

        // ---------------------------------------------------------
        // ZOMBIE PREVENTION: Handle Rollover Rescheduling
        // ---------------------------------------------------------
        // If we are editing a "Ghost" instance that comes from the PAST (Rollover),
        // we must perform a "Move" (Exception + New Task) instead of a simple update.
        // Simple updates to ghosts usually work, BUT for Rollovers, the "Original Date" 
        // is in the past, while the "Display Date" (instanceDate) might be Today.

        // Check if this is a Rollover: 
        // 1. It has an originalDate (it's an instance)
        // 2. The originalDate is strictly BEFORE today (or the target date we are moving TO?)
        // Actually, simpler: If editingTask.daysRolled > 0, strict "Reschedule" logic applies.

        if (editingTask.daysRolled > 0 && originalMaster.rrule) {
            console.log(`[Recurrence] Rescheduling Rollover Task ${editingTask.originalTaskId} from ${editingTask.originalDate} to ${updatedTask.date}`);

            // 1. Create Exception for the OLD date (Hides the Roll xN zombie)
            const oldDate = editingTask.originalDate;
            const exceptions = new Set(originalMaster.exceptionDates || []);
            exceptions.add(oldDate);

            updateTask(originalMaster.id, { exceptionDates: Array.from(exceptions) });

            // 2. Create NEW Single Task at the NEW date (Tomorrow, or wherever user moved it)
            // We strip the recurrence from this specific instance because it's an Exception.
            const newSingleTask: Task = {
                ...originalMaster,
                ...updatedTask,
                id: Date.now().toString(), // Fresh ID
                date: updatedTask.date,    // The new chosen date
                rrule: undefined,          // Detach from series
                seriesId: undefined,
                originalTaskId: undefined, // It's a new independent task
                completedDates: [],
                exceptionDates: [],
                daysRolled: 0 // Reset rollover count
            };

            addTask(newSingleTask);

            if (shouldClose) {
                setEditingTask(null);
                setIsDrawerVisible(false);
            }
            return;
        }

        // 3. RECURRENCE SPLIT ENGINE (Standard Logic)
        // If it's a recurring task, and we are editing a specific instance date
        if (originalMaster.rrule) {
            try {
                const oldRule = RRule.fromString(originalMaster.rrule);
                const seriesStart = oldRule.options.dtstart;
                const targetDate = new Date(instanceDate + 'T00:00:00');

                // Check if we are editing the very first instance
                const isFirstInstance = seriesStart.getTime() === targetDate.getTime();

                if (isFirstInstance) {
                    // SCENARIO A: UPDATE ENTIRE SERIES FROM START
                    // Just update the master in place
                    const finalUpdatedTask = { ...originalMaster, ...updatedTask, id: originalMaster.id };

                    // Re-generate RRule with potentially new Recurrence settings
                    // BUT keep the original start date (which is today/targetDate)
                    if (updatedTask.recurrence) {
                        const newRRule = generateRRuleString(updatedTask.recurrence, instanceDate);
                        if (newRRule) finalUpdatedTask.rrule = newRRule;
                    } else {
                        // Recurrence removed
                        finalUpdatedTask.rrule = undefined;
                        finalUpdatedTask.seriesId = undefined;
                    }

                    updateTask(originalMaster.id, finalUpdatedTask);

                } else {
                    // SCENARIO B: SPLIT SERIES (THIS AND FUTURE)
                    console.log(`[Recurrence] Splitting series ${originalMaster.id} at ${instanceDate}`);

                    // STEP 1: CLAMP OLD SERIES
                    // Set UNTIL to Yesterday
                    const cutoffDate = new Date(targetDate);
                    cutoffDate.setDate(cutoffDate.getDate() - 1);
                    cutoffDate.setHours(23, 59, 59, 999);

                    const oldOptions = { ...oldRule.options };
                    oldOptions.until = cutoffDate;
                    // Remove count if present, as we are strictly enforcing date cut-off
                    if ((oldOptions as any).count) delete (oldOptions as any).count;

                    const clampedRRule = new RRule(oldOptions).toString();

                    // Update the old master with the clamped rule
                    updateTask(originalMaster.id, { rrule: clampedRRule });


                    // STEP 2: CREATE NEW SERIES
                    // Iterate and Create New Master starting Today
                    const newSeriesId = Date.now().toString(); // New Unique ID

                    const newMasterTask: Task = {
                        ...originalMaster, // Inherit history/tags/etc
                        ...updatedTask,    // Apply edits (Title, Color, etc)
                        id: newSeriesId,
                        date: instanceDate, // New Start Date
                        originalTaskId: undefined, // It IS a master
                        completedDates: [], // Reset completion history for new series
                        exceptionDates: [], // Reset exceptions
                        seriesId: `series_${newSeriesId}`, // New lineage
                    };

                    // Generate New RRule
                    if (updatedTask.recurrence) {
                        // Use the rule from drawer
                        const newRRuleStr = generateRRuleString(updatedTask.recurrence, instanceDate);
                        if (newRRuleStr) newMasterTask.rrule = newRRuleStr;
                    } else {
                        // User removed recurrence in drawer -> Become Single Task
                        newMasterTask.rrule = undefined;
                        newMasterTask.seriesId = undefined;
                    }

                    addTask(newMasterTask);
                }

            } catch (e) {
                console.error("Failed to process recurrence split", e);
                Alert.alert("Error", "Failed to update recurring task. See logs.");
                return;
            }

        } else {
            // SCENARIO C: REGULAR SINGLE TASK UPDATE
            updateTask(updatedTask.id, updatedTask);
        }

        if (shouldClose) {
            setEditingTask(null);
            setIsDrawerVisible(false);
        }
    };

    // Helper to generate RRule string from UI Object
    const generateRRuleString = (recurrence: RecurrenceRule, startDateStr: string): string | undefined => {
        try {
            const freqMap: { [key: string]: any } = {
                'daily': RRule.DAILY,
                'weekly': RRule.WEEKLY,
                'monthly': RRule.MONTHLY,
                'yearly': RRule.YEARLY
            };

            const options: any = {
                freq: freqMap[recurrence.frequency],
                interval: recurrence.interval || 1,
                dtstart: new Date(startDateStr + 'T00:00:00')
            };

            if (recurrence.endDate) {
                options.until = new Date(recurrence.endDate);
            }
            if (recurrence.occurrenceCount) {
                options.count = recurrence.occurrenceCount;
            }
            // Handle Days of Week
            if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
                const dayMap: { [key: string]: any } = {
                    'MO': RRule.MO, 'TU': RRule.TU, 'WE': RRule.WE, 'TH': RRule.TH, 'FR': RRule.FR, 'SA': RRule.SA, 'SU': RRule.SU
                };
                options.byweekday = recurrence.daysOfWeek.map(d => dayMap[d]).filter(Boolean);
            }

            const rule = new RRule(options);
            return rule.toString();
        } catch (e) {
            console.error("RRule Generation Failed", e);
            return undefined;
        }
    };

    const saveSubtask = (subtaskData: any) => {
        const newSubtask = {
            id: (editingSubtask ? subtaskData.id : Date.now().toString()),
            title: subtaskData.title,
            completed: subtaskData.completed || false,
            deadline: subtaskData.deadline,
            estimatedTime: subtaskData.estimatedTime,
        };
        // Assuming 'form' destructuring happens at a higher scope,
        // and this is where the instruction intends the variable to be available.
        // The instruction's snippet was syntactically incorrect in its placement.
        // This change assumes 'startAddingTask' is added to an existing destructuring
        // that includes 'newTaskRecurrence', 'newTaskReminderTime', etc.
        // Since that destructuring is not in the provided content, I cannot place it there.
        // I will add a comment to reflect this assumption.
        // If the 'form' destructuring was meant to be *inside* this function,
        // the provided snippet was incomplete and syntactically invalid.

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

    const handleSubtaskToggle = (parentId: string, subtaskId: string, dateContext?: string) => {
        toggleSubtask(parentId, subtaskId, dateContext || todayString);
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



    const openEditSubtask = (parentId: string, subtask: any) => {
        setEditingSubtask({ parentId, subtask });
        setIsDrawerVisible(true);
    };

    // ============================================================================
    // === RENDER ===
    // ============================================================================

    return (
        <SafeAreaView style={[styles.container, isSprintSelectionMode && styles.sprintContainer]}>
            <TaskListHeader
                userAvatar={userAvatar}
                offset={offset}
                onOffsetChange={(val) => {
                    setOffset(val);
                    if (val === 0) flashListRef.current?.scrollToOffset({ offset: 0, animated: true });
                }}
                viewMode={viewMode}
                isSprintSelectionMode={isSprintSelectionMode}
                onToggleSprint={toggleSprintSelectionMode}
                showViewPicker={showViewPicker}
                setShowViewPicker={setShowViewPicker}
            />

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
            <FlashList<Date>
                ref={flashListRef}
                data={dates}
                extraData={calendarItems as any}
                // @ts-ignore
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
                                        {date.getDate()} {date.toLocaleDateString('en-US', { month: 'long' })} • {getDaysDifference(date)}
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
                                            daysRolled={item.daysRolled || 0}
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
                                            onSelect={() => toggleSprintTaskSelection(item.id)}
                                            // activeTags removed
                                            color={item.color}
                                            taskType={item.taskType}
                                            importance={item.importance}
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
                                                onProgressUpdate={(id, val) => handleSubtaskProgress(item.originalTaskId, subtask.id, val, item.originalDate || item.date)}
                                                onComplete={() => handleSubtaskToggle(item.originalTaskId, subtask.id, item.originalDate || item.date)}
                                                onEdit={() => openEditSubtask(item.originalTaskId, subtask)}
                                                onMenu={() => openSubtaskMenu(item.originalTaskId, subtask.id)}
                                                formatDeadline={formatDeadline}
                                                onSwipeStart={handleSwipeStart}
                                                onSwipeEnd={handleSwipeEnd}
                                                isSelectionMode={isSprintSelectionMode}
                                            // Subtasks don't usually have their own tags, but if they did:
                                            // activeTags={[]} // Removed
                                            />
                                        ))}
                                    </View>
                                ))}
                            </View>

                            {/* Add Task Footer Button */}
                            {
                                !isAddingHere && (
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
                                )
                            }

                            {/* Add Task Input */}
                            {
                                isAddingHere && (
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
                                )
                            }
                        </View>
                    );
                }}
            />

            {/* Fixed Quick Add Bar */}
            <TaskQuickAdd
                visible={!!addingTaskForDate || !!addingSubtaskToParentId}
                isSubtask={!!addingSubtaskToParentId}
                title={newTaskTitle}
                onChangeTitle={setNewTaskTitle}
                onSave={() => handleAddTask(addingTaskForDate)}
                onCancel={cancelAddingTask}
                onOpenCalendar={() => {
                    setCalendarMode('new');
                    setIsCalendarVisible(true);
                }}
                onOpenDuration={() => {
                    setDurationMode('new');
                    setIsDurationPickerVisible(true);
                }}
                onOpenRecurrence={() => setIsRecurrencePickerVisible(true)}
                deadline={newTaskDeadline}
                onClearDeadline={() => setNewTaskDeadline(null)}
                estimatedTime={newTaskEstimatedTime}
                onClearEstimatedTime={() => setNewTaskEstimatedTime(null)}
                recurrence={newTaskRecurrence}
                onClearRecurrence={() => setNewTaskRecurrence(null)}
            />

            {/* Sprint Start Button Overlay */}
            {
                isSprintSelectionMode && (
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
                )
            }

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
                onRequestColorSettings={() => setIsColorSettingsVisible(true)}
                userColors={userColors}
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

            <ColorSettingsModal
                visible={isColorSettingsVisible}
                onClose={() => setIsColorSettingsVisible(false)}
                userColors={userColors}
                onSave={handleSaveUserColors}
            />

            {/* TimePickerModal removed - logic handled by CalendarModal */}
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





            <TimePickerModal
                visible={isTimePickerVisible}
                onClose={() => setIsTimePickerVisible(false)}
                onSelectTime={(time) => {
                    setNewTaskReminderTime(time || null);
                }}
                initialTime={newTaskReminderTime || undefined}
            />
        </SafeAreaView >
    );
}
