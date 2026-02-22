import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Task } from '../types';
import { StorageService } from '../../../services/storage';

export const useSprintMode = (tasks: Task[]) => {
    const router = useRouter();
    const [isSprintSelectionMode, setIsSprintSelectionMode] = useState(false);
    const [selectedSprintTaskIds, setSelectedSprintTaskIds] = useState<Set<string>>(new Set());

    const toggleSprintSelectionMode = useCallback(() => {
        setIsSprintSelectionMode(prev => !prev);
        setSelectedSprintTaskIds(new Set());
    }, []);

    const toggleSprintTaskSelection = useCallback((taskId: string) => {
        setSelectedSprintTaskIds(prev => {
            const next = new Set(prev);
            if (next.has(taskId)) {
                next.delete(taskId);
            } else {
                next.add(taskId);
            }
            return next;
        });
    }, []);

    const startSprint = useCallback(async () => {
        if (selectedSprintTaskIds.size === 0) return;

        const selectedTasks = tasks.filter(t => selectedSprintTaskIds.has(t.id));

        // Flatten tasks that have incomplete subtasks
        const flattenedSprintTasks: Task[] = [];

        selectedTasks.forEach(parentTask => {
            const incompleteSubtasks = parentTask.subtasks?.filter(st => !st.completed) || [];

            if (incompleteSubtasks.length > 0) {
                // Generate a temporary sprint task for each subtask
                incompleteSubtasks.forEach(subtask => {
                    flattenedSprintTasks.push({
                        id: `sprint_${parentTask.id}_${subtask.id}`,
                        title: `${parentTask.title} / ${subtask.title}`,
                        date: parentTask.date,
                        estimatedTime: subtask.estimatedTime,
                        sprintParentId: parentTask.id,
                        sprintSubtaskId: subtask.id,
                    } as Task);
                });
            } else {
                // No incomplete subtasks, pass the parent task as-is
                flattenedSprintTasks.push(parentTask);
            }
        });

        await StorageService.saveSprintTasks(flattenedSprintTasks);

        router.push({
            pathname: '/sprint',
            params: { taskIds: JSON.stringify(flattenedSprintTasks.map(t => t.id)) }
        });
    }, [selectedSprintTaskIds, tasks, router]);

    return {
        isSprintSelectionMode,
        selectedSprintTaskIds,
        toggleSprintSelectionMode,
        toggleSprintTaskSelection,
        startSprint
    };
};
