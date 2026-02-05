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
        await StorageService.saveSprintTasks(selectedTasks);

        router.push({
            pathname: '/sprint',
            params: { taskIds: JSON.stringify(Array.from(selectedSprintTaskIds)) }
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
