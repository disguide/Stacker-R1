import { useState, useCallback, useEffect } from 'react';
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

    const loadTasks = async () => {
        const data = await TaskRepository.getAll();
        setTasks(data);
        setLoading(false);
    };

    /**
     * ADD TASK
     */
    const addTask = useCallback(async (task: Task) => {
        const newTasks = [...tasks, task];
        setTasks(newTasks);
        await TaskRepository.saveAll(newTasks);
    }, [tasks]);

    /**
     * TOGGLE COMPLETION
     */
    const toggleTask = useCallback(async (taskId: string, dateString: string) => {
        const index = tasks.findIndex(t => t.id === taskId);
        if (index === -1) return;

        const updatedTasks = [...tasks];
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
        setTasks(updatedTasks);
        await TaskRepository.saveAll(updatedTasks);
    }, [tasks]);

    /**
     * UPDATE TASK / SUBTASKS
     */
    const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
        const index = tasks.findIndex(t => t.id === taskId);
        if (index === -1) return;

        const updatedTasks = [...tasks];
        updatedTasks[index] = { ...updatedTasks[index], ...updates };

        setTasks(updatedTasks);
        await TaskRepository.saveAll(updatedTasks);
    }, [tasks]);

    /**
     * DELETE TASK (Single or Series)
     */
    const deleteTask = useCallback(async (taskId: string, dateString: string, mode: 'single' | 'future' | 'all') => {
        const index = tasks.findIndex(t => t.id === taskId);
        if (index === -1) return;

        const updatedTasks = [...tasks];
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

        setTasks(updatedTasks);
        await TaskRepository.saveAll(updatedTasks);
    }, [tasks]);

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
