import { useState, useCallback, useEffect, useRef } from 'react';
import { Task } from '../types';
import { TaskRepository } from '../../../services/storage/TaskRepository';
import { RecurrenceEngine } from '../logic/recurrenceEngine';
import { RRule } from 'rrule';
import { RolloverSystem } from '../logic/rolloverSystem';
import { createRRuleString } from '../../../utils/recurrence';

export const useTaskController = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    // Initial Load
    useEffect(() => {
        loadTasks();
    }, []);

    const isFirstRun = useRef(true);
    const isSaving = useRef(false);

    useEffect(() => {
        if (isFirstRun.current) {
            isFirstRun.current = false;
            return;
        }
        if (!loading) {
            console.log('[useTaskController] Auto-saving tasks:', tasks.length);
            isSaving.current = true;
            TaskRepository.saveAll(tasks as any)
                .catch(e => console.error("Failed to auto-save", e))
                .finally(() => {
                    isSaving.current = false;
                    console.log('[useTaskController] Auto-save finished');
                });
        }
    }, [tasks, loading]);

    const loadTasks = useCallback(async () => {
        if (isSaving.current) {
            console.warn('[useTaskController] Skipping loadTasks - Save in progress');
            return;
        }
        console.log('[useTaskController] Loading tasks...');
        const data = (await TaskRepository.getAll()) as unknown as Task[];

        // ROLLOVER SYSTEM INTEGRATION
        const { updates, creations } = RolloverSystem.getRolloverActions(data);

        let finalTasks = data;

        if (updates.length > 0 || creations.length > 0) {
            console.log(`[useTaskController] Rollover Active: ${updates.length} updates, ${creations.length} created`);

            const taskMap = new Map(data.map(t => [t.id, t]));
            updates.forEach(u => taskMap.set(u.id, u));

            finalTasks = [...Array.from(taskMap.values()), ...creations];
        }

        console.log('[useTaskController] Tasks loaded (with rollovers):', finalTasks.length);
        setTasks(finalTasks);
        setLoading(false);
    }, []);

    /**
     * ADD TASK
     */
    const addTask = useCallback((task: Task) => {
        console.log('[useTaskController] Adding task:', task.id);
        setTasks(prev => [...prev, task]);
    }, []);

    /**
     * TOGGLE COMPLETION
     */
    const toggleTask = useCallback((taskId: string, dateString: string) => {
        setTasks(prev => {
            // Handle Ghost IDs (e.g., "task123_2023-10-27")
            const originalId = taskId.includes('_') ? taskId.split('_')[0] : taskId;

            const index = prev.findIndex(t => t.id === originalId);
            if (index === -1) {
                console.error(`[toggleTask] Task not found: ${taskId} (original: ${originalId})`);
                return prev;
            }

            const updatedTasks = [...prev];
            const task = { ...updatedTasks[index] };

            // Logic: Add/Remove from completedDates array
            const completedDates = new Set(task.completedDates || []);
            if (completedDates.has(dateString)) {
                completedDates.delete(dateString);
            } else {
                completedDates.add(dateString);
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
            // Handle Ghost IDs for updates too
            const originalId = taskId.includes('_') ? taskId.split('_')[0] : taskId;

            const index = prev.findIndex(t => t.id === originalId);
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
                        console.log(`[useTaskController] Regenerated RRule for ${originalId}:`, newRRule);
                        finalUpdates.rrule = newRRule;
                    } catch (e) {
                        console.error("[useTaskController] Failed to generate RRule", e);
                    }
                } else {
                    // Recurrence removal
                    console.log(`[useTaskController] Removing recurrence for ${originalId}`);
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
            return updatedTasks;
        });
    }, []);

    /**
     * DELETE TASK (Single or Series)
     */
    const toggleSubtask = useCallback((taskId: string, subtaskId: string, dateString: string) => {
        console.log(`[useTaskController] toggleSubtask called`, { taskId, subtaskId, dateString });
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
            const originalId = taskId.includes('_') ? taskId.split('_')[0] : taskId;
            const index = prev.findIndex(t => t.id === originalId);
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
            const index = prev.findIndex(t => t.id === taskId);
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

            return updatedTasks;
        });
    }, []);

    return {
        tasks,
        loading,
        addTask,
        toggleTask,
        updateTask,
        toggleSubtask,
        updateSubtask,
        deleteTask,
        refresh: loadTasks
    };
};
