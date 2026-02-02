import { useState, useCallback, useEffect, useRef } from 'react';
import { Task } from '../types';
import { TaskRepository } from '../../../services/storage/TaskRepository';
import { RecurrenceEngine } from '../logic/recurrenceEngine';
import { RRule } from 'rrule';

export const useTaskController = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    // Initial Load
    useEffect(() => {
        loadTasks();
    }, []);

    // Auto-Save Effect
    // Skip saving on initial load by checking if loading is false (and maybe a ref to skip first render if needed)
    // But simpliest is: only save if tasks changed?
    // We'll wrap save in a debouncer or just save on every change?
    // Let's keep it simple: manual saving was fine, but we need functional updates.
    // We can't easily get the 'next' state out of setTasks(prev => next).

    // Alternative: Use a helper that does both? 
    // No, functional update is required for the race condition.
    // So we MUST use useEffect to save `tasks`.

    const isFirstRun = useRef(true);
    useEffect(() => {
        if (isFirstRun.current) {
            isFirstRun.current = false;
            return;
        }
        if (!loading) {
            TaskRepository.saveAll(tasks).catch(e => console.error("Failed to auto-save", e));
        }
    }, [tasks, loading]);

    const loadTasks = async () => {
        const data = await TaskRepository.getAll();
        setTasks(data);
        setLoading(false);
    };

    /**
     * ADD TASK
     */
    const addTask = useCallback((task: Task) => {
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
            updatedTasks[index] = { ...updatedTasks[index], ...updates };
            return updatedTasks;
        });
    }, []);

    /**
     * DELETE TASK (Single or Series)
     */
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
        deleteTask,
        refresh: loadTasks
    };
};
