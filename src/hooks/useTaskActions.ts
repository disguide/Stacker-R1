import { useCallback } from 'react';
import { Task } from '../types';
import { RRule } from 'rrule';

/**
 * Controller Hook for Master-Exception Logic
 */
export const useTaskActions = (tasks: Task[], params: { saveTasks: (tasks: Task[]) => void }) => {

    // Helper to find task index
    const findTaskIndex = (id: string) => tasks.findIndex(t => t.id === id);

    /**
     * TOGGLE: Check/Uncheck a specific day
     * - Single: Toggle boolean
     * - Master: Add/Remove date from completedDates
     */
    const toggleTask = useCallback((taskId: string, dateString: string) => {
        const index = findTaskIndex(taskId);
        if (index === -1) return;

        const task = { ...tasks[index] };
        const isMaster = !!task.rrule;

        if (isMaster) {
            // Recurrence Logic
            const completedDates = new Set(task.completedDates || []);
            if (completedDates.has(dateString)) {
                completedDates.delete(dateString);
            } else {
                completedDates.add(dateString);
            }
            task.completedDates = Array.from(completedDates);
        } else {
            // Single Task Logic
            const completedDates = new Set(task.completedDates || []);
            if (completedDates.has(dateString)) {
                completedDates.delete(dateString); // Uncheck
            } else {
                completedDates.add(dateString); // Check
            }
            task.completedDates = Array.from(completedDates);
        }

        const newTasks = [...tasks];
        newTasks[index] = task;
        params.saveTasks(newTasks);

    }, [tasks, params]);


    /**
     * DELETE: Handle Single vs Series
     */
    const deleteInstance = useCallback((taskId: string, dateString: string, deleteSeries: boolean) => {
        const index = findTaskIndex(taskId);
        if (index === -1) return;

        const newTasks = [...tasks];
        const task = { ...tasks[index] };

        if (task.rrule) {
            // MASTER TASK LOGIC
            if (deleteSeries) {
                // DELETE FUTURE (Stop recurrence at yesterday)
                if (task.date === dateString) {
                    // Deleting from start -> Remove entire series
                    newTasks.splice(index, 1);
                } else {
                    // Deleting from middle -> Clamp end date
                    try {
                        const rule = RRule.fromString(task.rrule);
                        const options = { ...rule.options };

                        // Calculate Cutoff (Yesterday End of Day)
                        const cutoff = new Date(dateString + 'T00:00:00');
                        cutoff.setDate(cutoff.getDate() - 1);
                        cutoff.setHours(23, 59, 59, 999);

                        options.until = cutoff;
                        // Remove count if present to ensure UNTIL matches
                        if ((options as any).count) delete (options as any).count;

                        task.rrule = new RRule(options).toString();
                        newTasks[index] = task;
                    } catch (e) {
                        console.warn("Failed to clamp recurrence", e);
                        newTasks.splice(index, 1); // Fallback
                    }
                }
            } else {
                // DELETE SINGLE DAY (Hide this specific day via exception)
                const exceptions = new Set(task.exceptionDates || []);
                exceptions.add(dateString);
                task.exceptionDates = Array.from(exceptions);
                newTasks[index] = task;
            }
        } else {
            // SINGLE TASK LOGIC - Always permanently delete
            newTasks.splice(index, 1);
        }

        params.saveTasks(newTasks);
    }, [tasks, params]);


    /**
     * EDIT: Handle Detaching or Series Update
     */
    const editInstance = useCallback((
        taskId: string,
        dateString: string,
        updates: Partial<Task>,
        editSeries: boolean
    ) => {
        const index = findTaskIndex(taskId);
        if (index === -1) return;

        let newTasks = [...tasks];
        const masterTask = { ...tasks[index] };

        if (editSeries) {
            // UPDATE MASTER
            // Apply updates to the master task
            Object.assign(masterTask, updates);
            newTasks[index] = masterTask;
        } else {
            // SPLIT (Detach)
            // 1. Hide this date on Master
            const exceptions = new Set(masterTask.exceptionDates || []);
            exceptions.add(dateString);
            masterTask.exceptionDates = Array.from(exceptions);
            newTasks[index] = masterTask;

            // 2. Create new Single Task
            const newTask: Task = {
                ...masterTask,
                ...updates,
                id: `${masterTask.id}_detach_${Date.now()}`, // New ID
                date: dateString,
                rrule: undefined, // It is now single
                completedDates: [], // Start fresh
                exceptionDates: [],
            };

            // If the day was completed on master, should the new task be completed?
            if (masterTask.completedDates?.includes(dateString)) {
                newTask.completedDates = [dateString];
            }

            newTasks.push(newTask);
        }

        params.saveTasks(newTasks);
    }, [tasks, params]);

    return { toggleTask, deleteInstance, editInstance };
};
