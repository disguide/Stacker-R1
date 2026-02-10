
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Task, ProjectedTask, ISODate } from '../../../core/types';
import { Projector } from '../../../core/Projector';
import { ActionService } from '../../../core/ActionService';
import { TaskRepository } from '../../../services/storage/TaskRepository';
import { Sanitizer } from '../../../core/Sanitizer';

export function useTasks() {
    // --- STATE ---
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    // --- LOAD ---
    const refresh = useCallback(async () => {
        setLoading(true);
        const data = await TaskRepository.getAll();
        setTasks(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    // --- PROJECTION ---
    const getCalendarItems = useCallback((startDate: ISODate, days: number): ProjectedTask[] => {
        return Projector.projectTasks(tasks, startDate, days);
    }, [tasks]);

    // --- ACTIONS ---

    const addTask = useCallback(async (newTask: Task) => {
        const updated = [...tasks, newTask];
        setTasks(updated);
        await TaskRepository.saveAll(updated);
    }, [tasks]);

    const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
        const updated = tasks.map(t => t.id === taskId ? { ...t, ...updates, updatedAt: Date.now() } : t);
        setTasks(updated);
        await TaskRepository.saveAll(updated);
    }, [tasks]);

    const deleteTask = useCallback(async (taskId: string) => {
        const updated = tasks.filter(t => t.id !== taskId);
        setTasks(updated);
        await TaskRepository.saveAll(updated);
    }, [tasks]);

    /**
     * Toggles completion for any task (Single or Recurring Instance)
     */
    const toggleCompletion = useCallback(async (projectedTask: ProjectedTask) => {
        // Find the "Master" source of truth
        const masterId = projectedTask.originalTaskId || projectedTask.id;
        const master = tasks.find(t => t.id === masterId);

        if (!master) {
            console.warn('[useTasks] Master task not found for toggle', masterId);
            return;
        }

        const changes = ActionService.onToggle(projectedTask, master);
        await updateTask(masterId, changes);
    }, [tasks, updateTask]);

    /**
     * Updates an instance (Recurrence Split or Exception)
     */
    const updateInstance = useCallback(async (
        projectedTask: ProjectedTask,
        changes: Partial<Task>,
        mode: 'single' | 'future' | 'all'
    ) => {
        const masterId = projectedTask.originalTaskId || projectedTask.id;
        const master = tasks.find(t => t.id === masterId);

        if (!master) return;

        // A. SINGLE INSTANCE (Exception)
        if (mode === 'single') {
            // If it's already a single task, just update it
            if (!master.rrule) {
                await updateTask(masterId, changes);
                return;
            }

            // Create Exception
            const { masterUpdate, newSingleTask } = ActionService.onUpdateInstance(projectedTask, master, changes);

            // Apply: Update Master + Add New Task
            const newTaskList = tasks.map(t => t.id === masterId ? { ...t, ...masterUpdate } : t);
            newTaskList.push(newSingleTask);
            setTasks(newTaskList);
            await TaskRepository.saveAll(newTaskList);
            return;
        }

        // B. FUTURE or ALL (Series)
        if (mode === 'future' || mode === 'all') {
            if (!master.rrule) {
                // If not recurring, just update
                await updateTask(masterId, changes);
                return;
            }

            const { oldMasterUpdate, newMaster } = ActionService.onUpdateSeries(projectedTask, master, changes, mode);

            let newTaskList = [...tasks];

            // Update Old Master
            if (oldMasterUpdate) {
                newTaskList = newTaskList.map(t => t.id === masterId ? { ...t, ...oldMasterUpdate } : t);
            }

            // Add New Master (if Split)
            if (newMaster) {
                newTaskList.push(newMaster);
            }

            setTasks(newTaskList);
            await TaskRepository.saveAll(newTaskList);
        }
    }, [tasks, updateTask]);

    return {
        tasks,
        loading,
        refresh,
        getCalendarItems,
        addTask,
        updateTask,       // Low-level
        deleteTask,       // Low-level
        toggleCompletion, // High-level logic
        updateInstance    // High-level logic
    };
}
