import { useState, useCallback, useEffect, useRef } from 'react';
import { Task } from '../types';
import { TaskRepository } from '../../../services/storage/TaskRepository';
import { RecurrenceEngine } from '../logic/recurrenceEngine';
import { RRule } from 'rrule';
import { RolloverSystem } from '../logic/rolloverSystem';
import { createRRuleString } from '../../../utils/recurrence';
import { NotificationService } from '../../../services/notifications';
import { HistoryRepository } from '../../../services/storage/HistoryRepository';

/**
 * Robust ID resolver: tries exact match, then strips trailing _YYYY-MM-DD ghost suffix,
 * then tries progressive segment popping. Returns the index or -1.
 */
const resolveTaskIndex = (list: Task[], id: string): number => {
    // 1. Exact match
    let idx = list.findIndex(t => t.id === id);
    if (idx !== -1) return idx;

    // 2. Strip trailing _YYYY-MM-DD ghost date suffix
    const ghostDateMatch = id.match(/^(.+)_\d{4}-\d{2}-\d{2}$/);
    if (ghostDateMatch) {
        idx = list.findIndex(t => t.id === ghostDateMatch[1]);
        if (idx !== -1) return idx;
    }

    // 3. Progressive segment popping (handles _restored, _detach_xxx, etc.)
    if (id.includes('_')) {
        const parts = id.split('_');
        for (let i = parts.length - 1; i >= 1; i--) {
            const candidate = parts.slice(0, i).join('_');
            idx = list.findIndex(t => t.id === candidate);
            if (idx !== -1) return idx;
        }
    }

    return -1;
};

export const useTaskController = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    const isFirstRun = useRef(true);
    const isSaving = useRef(false);

    /**
     * LOAD TASKS
     */
    const loadTasks = useCallback(async () => {
        if (isSaving.current) {
            if (__DEV__) console.warn('[useTaskController] Skipping loadTasks - Save in progress');
            return;
        }
        try {
            const data = (await TaskRepository.getAll()) as unknown as Task[];

            // ROLLOVER SYSTEM INTEGRATION
            const { updates, creations } = RolloverSystem.getRolloverActions(data);

            let finalTasks = data;

            if (updates.length > 0 || creations.length > 0) {
                if (__DEV__) console.log(`[useTaskController] Rollover Active: ${updates.length} updates, ${creations.length} created`);

                const taskMap = new Map(data.map(t => [t.id, t]));
                updates.forEach(u => taskMap.set(u.id, u));

                finalTasks = [...Array.from(taskMap.values()), ...creations];
            }
            setTasks(finalTasks);
        } catch (e) {
            console.error("Failed to load tasks", e);
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * ADD TASK
     */
    const addTask = useCallback((task: Task) => {
        setTasks(prev => [...prev, task]);

        // Log to history
        HistoryRepository.addLog({
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            taskId: task.id,
            taskTitle: task.title,
            action: 'added',
            timestamp: new Date().toISOString(),
            date: task.date
        });
    }, []);

    /**
     * TOGGLE COMPLETION
     */
    const toggleTask = useCallback((taskId: string, dateString: string) => {
        setTasks(prev => {
            const index = resolveTaskIndex(prev, taskId);
            if (index === -1) {
                if (__DEV__) console.warn(`[toggleTask] Task not found: ${taskId}`);
                return prev;
            }

            const updatedTasks = [...prev];
            const task = { ...updatedTasks[index] };

            // Logic: Add/Remove from completedDates array
            const completedDates = new Set(task.completedDates || []);
            const wasCompleted = completedDates.has(dateString);

            if (wasCompleted) {
                completedDates.delete(dateString);

                HistoryRepository.addLog({
                    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    taskId: task.id,
                    taskTitle: task.title,
                    action: 'uncompleted',
                    timestamp: new Date().toISOString(),
                    date: dateString
                });
            } else {
                completedDates.add(dateString);

                HistoryRepository.addLog({
                    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    taskId: task.id,
                    taskTitle: task.title,
                    action: 'completed',
                    timestamp: new Date().toISOString(),
                    date: dateString
                });
            }
            task.completedDates = Array.from(completedDates);

            updatedTasks[index] = task;
            return updatedTasks;
        });
    }, []);

    /**
     * UPDATE TASK / SUBTASKS
     */
    const updateTask = useCallback((taskId: string, updates: Partial<Task>) => {
        setTasks(prev => {
            const index = resolveTaskIndex(prev, taskId);
            if (index === -1) return prev;

            const updatedTasks = [...prev];
            const currentTask = updatedTasks[index];

            // RRule Sync Logic: If recurrence object is updated, we must regenerate the rrule string
            let finalUpdates: Partial<Task> = { ...updates };

            if ('recurrence' in updates) {
                if (updates.recurrence) {
                    // Regenerate RRule string
                    const startDateForRRule = updates.date || currentTask.date;
                    try {
                        const newRRule = createRRuleString(updates.recurrence, startDateForRRule);
                        finalUpdates.rrule = newRRule;
                    } catch (e) {
                        console.error("[useTaskController] Failed to generate RRule", e);
                    }
                } else {
                    // Recurrence removal
                    finalUpdates.rrule = undefined;
                    // Also clear other recurrence fields if needed
                    finalUpdates.recurrence = undefined;
                }
            }

            // Protect Master ID: Don't let the Ghost ID overwrite the Master ID
            const { id: updateId, ...safeUpdates } = finalUpdates;

            updatedTasks[index] = {
                ...currentTask,
                ...safeUpdates
            };

            // Calculate simple diff for details
            const diffKeys = Object.keys(safeUpdates).filter(k => (safeUpdates as unknown as Record<string, unknown>)[k] !== (currentTask as unknown as Record<string, unknown>)[k]);
            if (diffKeys.length > 0) {
                HistoryRepository.addLog({
                    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    taskId: currentTask.id,
                    taskTitle: safeUpdates.title || currentTask.title,
                    action: 'modified',
                    timestamp: new Date().toISOString(),
                    date: currentTask.date,
                    details: `Updated: ${diffKeys.join(', ')}`
                });
            }

            return updatedTasks;
        });
    }, []);

    /**
     * SUBTASK LOGIC
     */
    const toggleSubtask = useCallback((taskId: string, subtaskId: string, dateString: string) => {
        setTasks(prev => {
            // Robust ID Resolution
            let index = prev.findIndex(t => t.id === taskId);

            // Try resolving composite ID if not found
            if (index === -1 && taskId.includes('_')) {
                const potentialMasterId = taskId.split('_')[0];
                index = prev.findIndex(t => t.id === potentialMasterId);

                // If still not found, try popping the last segment
                if (index === -1) {
                    const parts = taskId.split('_');
                    parts.pop();
                    const poppedId = parts.join('_');
                    index = prev.findIndex(t => t.id === poppedId);
                }
            }

            if (index === -1) {
                console.warn(`[useTaskController] Task not found for subtask toggle: ${taskId}`);
                return prev;
            }

            const updatedTasks = [...prev];
            const task = { ...updatedTasks[index] };

            if (task.rrule) {
                // Instance Logic
                const currentInstanceSubtasks = (task.instanceSubtasks && task.instanceSubtasks[dateString])
                    ? task.instanceSubtasks[dateString]
                    : (task.subtasks?.map(s => ({ ...s, completed: false })) || []);

                const newSubtasks = currentInstanceSubtasks.map(s =>
                    s.id === subtaskId ? { ...s, completed: !s.completed } : s
                );

                task.instanceSubtasks = {
                    ...(task.instanceSubtasks || {}),
                    [dateString]: newSubtasks
                };
            } else {
                // Single Task Logic
                task.subtasks = task.subtasks?.map(s =>
                    s.id === subtaskId ? { ...s, completed: !s.completed } : s
                );
            }

            updatedTasks[index] = task;
            return updatedTasks;
        });
    }, []);

    const updateSubtask = useCallback((taskId: string, subtaskId: string, progress: number, dateString: string) => {
        setTasks(prev => {
            const index = resolveTaskIndex(prev, taskId);
            if (index === -1) return prev;

            const updatedTasks = [...prev];
            const task = { ...updatedTasks[index] };

            const isComplete = progress === 100;

            if (task.rrule) {
                // Instance Logic
                const currentInstanceSubtasks = (task.instanceSubtasks && task.instanceSubtasks[dateString])
                    ? task.instanceSubtasks[dateString]
                    : (task.subtasks?.map(s => ({ ...s, completed: false, progress: 0 })) || []);

                const newSubtasks = currentInstanceSubtasks.map(s =>
                    s.id === subtaskId ? { ...s, progress, completed: isComplete } : s
                );

                task.instanceSubtasks = {
                    ...(task.instanceSubtasks || {}),
                    [dateString]: newSubtasks
                };
            } else {
                // Single Task Logic
                task.subtasks = task.subtasks?.map(s =>
                    s.id === subtaskId ? { ...s, progress, completed: isComplete } : s
                );
            }

            updatedTasks[index] = task;
            return updatedTasks;
        });
    }, []);

    // ----------------------------------------
    // DELETE TASK (Single or Series)
    // ----------------------------------------
    const deleteTask = useCallback((taskId: string, dateString: string, mode: 'single' | 'future' | 'all') => {
        setTasks(prev => {
            const index = resolveTaskIndex(prev, taskId);
            if (index === -1) return prev;

            const updatedTasks = [...prev];
            const task = { ...updatedTasks[index] };

            if (mode === 'all') {
                updatedTasks.splice(index, 1);
            }
            else if (mode === 'future' && task.rrule) {
                // Cap the recurrence
                try {
                    const rule = RRule.fromString(task.rrule);
                    const options = { ...rule.options };
                    const cutoff = new Date(dateString + 'T00:00:00');
                    cutoff.setDate(cutoff.getDate() - 1); // Yesterday
                    options.until = cutoff;
                    if ((options as any).count) delete (options as any).count;

                    task.rrule = new RRule(options).toString();
                    updatedTasks[index] = task;
                } catch (e) {
                    console.warn("Failed to update RRule for deletion", e);
                }
            }
            else if (mode === 'single' && task.rrule) {
                // Exception
                const exceptions = new Set(task.exceptionDates || []);
                exceptions.add(dateString);
                task.exceptionDates = Array.from(exceptions);
                updatedTasks[index] = task;
            }

            HistoryRepository.addLog({
                id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                taskId: task.id,
                taskTitle: task.title,
                action: 'deleted',
                timestamp: new Date().toISOString(),
                date: dateString,
                details: mode === 'single' ? 'Deleted instance' : (mode === 'future' ? 'Deleted future instances' : 'Deleted task')
            });

            return updatedTasks;
        });
    }, []);

    /**
     * TOGGLE REMINDER
     */
    const toggleTaskReminder = useCallback((taskId: string, enabled: boolean, time?: string, date?: string, offset?: number) => {
        setTasks(prev => {
            const index = prev.findIndex(t => t.id === taskId);
            if (index === -1) return prev;

            const updatedTasks = [...prev];
            const task = { ...updatedTasks[index] };

            task.reminderEnabled = enabled;
            if (time !== undefined) task.reminderTime = time || undefined;

            // Offset Logic:
            // If offset is provided, use it and clear legacy date
            if (offset !== undefined) {
                task.reminderOffset = offset;
                task.reminderDate = undefined;
            } else if (date !== undefined) {
                // Legacy/Specific Date logic (if we still support it in some paths)
                task.reminderDate = date || undefined;
                task.reminderOffset = undefined;
            }

            updatedTasks[index] = task;

            return updatedTasks;
        });
    }, []);

    // Initial Load
    useEffect(() => {
        loadTasks();
    }, []);

    // Auto-Save Effect
    useEffect(() => {
        if (isFirstRun.current) {
            isFirstRun.current = false;
            return;
        }
        if (!loading) {
            isSaving.current = true;
            TaskRepository.saveAll(tasks as any)
                .catch(e => console.error("Failed to auto-save", e))
                .finally(() => {
                    isSaving.current = false;
                });
        }
    }, [tasks, loading]);

    /**
     * ATOMIC REORDER BATCH
     * Handles both sortOrder updates and task moves (cross-day) in a single state change
     * to prevent race conditions during complex drag-and-drop operations.
     */
    const applyReorderBatch = useCallback((
        reorderUpdates: Array<{ id: string; sortOrder: number }>,
        moveUpdates: Array<{ calendarItem: any; newDate: string; sortOrder: number }> = []
    ) => {
        setTasks(prev => {
            const updatedTasks = [...prev];

            // 1. Handle reorder updates
            reorderUpdates.forEach(({ id, sortOrder }) => {
                const ghostMatch = id.match(/^(.+)_(\d{4}-\d{2}-\d{2})$/);
                const masterId = ghostMatch ? ghostMatch[1] : id;
                const date = ghostMatch ? ghostMatch[2] : null;

                const index = resolveTaskIndex(updatedTasks, masterId);
                if (index !== -1) {
                    const task = updatedTasks[index];
                    if (date && (task.rrule || task.recurrence)) {
                        const instanceSortOrders = { ...(task.instanceSortOrders || {}) };
                        instanceSortOrders[date] = sortOrder;
                        updatedTasks[index] = { ...task, instanceSortOrders };
                    } else {
                        updatedTasks[index] = { ...task, sortOrder };
                    }
                }
            });

            // 2. Handle move updates (Cross-Day "Delete & Duplicate" Engine)
            moveUpdates.forEach(move => {
                const { calendarItem, newDate, sortOrder: targetSortOrder } = move;
                if (calendarItem.date === newDate) return;

                const isGhost = calendarItem.isGhost;
                const masterId = calendarItem.originalTaskId;
                const oldDate = calendarItem.date;

                // Step 1: Mark/delete the OLD task
                if (isGhost && masterId) {
                    const masterIndex = resolveTaskIndex(updatedTasks, masterId);
                    if (masterIndex !== -1) {
                        const master = { ...updatedTasks[masterIndex] };
                        const exceptions = new Set(master.exceptionDates || []);
                        exceptions.add(oldDate);
                        master.exceptionDates = Array.from(exceptions);
                        updatedTasks[masterIndex] = master;
                    }
                } else {
                    const taskId = masterId || calendarItem.id;
                    const taskIndex = resolveTaskIndex(updatedTasks, taskId);
                    if (taskIndex !== -1) {
                        const task = { ...updatedTasks[taskIndex] };
                        const completedDates = new Set(task.completedDates || []);
                        completedDates.add(oldDate);
                        task.completedDates = Array.from(completedDates);
                        if (!task.rrule) task.completed = true;
                        updatedTasks[taskIndex] = task;
                    }
                }

                // Step 2: Create a CLEAN duplicate on the NEW date
                const duplicate: Task = {
                    id: `${masterId || calendarItem.id}_moved_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    title: calendarItem.title,
                    date: newDate,
                    deadline: calendarItem.deadline,
                    estimatedTime: calendarItem.estimatedTime,
                    subtasks: calendarItem.subtasks?.map((s: any) => ({ ...s, completed: false })),
                    color: calendarItem.color,
                    type: calendarItem.taskType || calendarItem.type,
                    importance: calendarItem.importance,
                    tagIds: calendarItem.tagIds,
                    reminderEnabled: calendarItem.reminderEnabled,
                    reminderTime: calendarItem.reminderTime,
                    reminderDate: undefined,
                    rrule: undefined,
                    recurrence: undefined,
                    completedDates: undefined,
                    exceptionDates: undefined,
                    sortOrder: targetSortOrder ?? 9999,
                    completed: false,
                };

                updatedTasks.push(duplicate);

                HistoryRepository.addLog({
                    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    taskId: duplicate.id,
                    taskTitle: duplicate.title,
                    action: 'added',
                    timestamp: new Date().toISOString(),
                    date: newDate,
                    details: `Moved from ${oldDate} (atomic batch update)`
                });
            });

            return updatedTasks;
        });
    }, []);

    /**
     * MOVE TASK TO DATE (Legacy wrapper)
     */
    const moveTaskToDate = useCallback((calendarItem: any, newDate: string, sortOrder?: number) => {
        applyReorderBatch([], [{ calendarItem, newDate, sortOrder: sortOrder ?? 9999 }]);
    }, [applyReorderBatch]);

    /**
     * REORDER TASKS (Legacy wrapper)
     */
    const reorderTasks = useCallback((updates: Array<{ id: string; sortOrder: number }>) => {
        applyReorderBatch(updates, []);
    }, [applyReorderBatch]);

    return {
        tasks,
        loading,
        addTask,
        toggleTask,
        updateTask,
        toggleSubtask,
        updateSubtask,
        deleteTask,
        toggleTaskReminder,
        reorderTasks,
        moveTaskToDate,
        applyReorderBatch,
        refresh: loadTasks
    };
};
