import { useState, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { Task } from '../../tasks/types';
import { StorageService } from '../../../services/storage';
import { resolveId } from '../../../utils/taskHelpers';

export function useTaskOperations(
    tasks: Task[],
    actions: {
        toggleTask: (id: string, date: string) => void;
        deleteTask: (id: string, date: string, mode: 'single' | 'future' | 'all') => void;
        addTask: (task: Task) => void;
        updateTask: (id: string, updates: Partial<Task>) => void;
        updateSubtask: (parentId: string, subtaskId: string, updates: any, dateContext: string) => void;
        toggleSubtask: (parentId: string, subtaskId: string, dateContext: string) => void;
    }
) {
    const { toggleTask, deleteTask, addTask, updateTask, updateSubtask, toggleSubtask } = actions;

    // Task Completion Cooldown State
    const [completingTaskIds, setCompletingTaskIds] = useState<Set<string>>(new Set());
    const completionTimeouts = useRef<{ [key: string]: NodeJS.Timeout }>({});
    const [historyTasks, setHistoryTasks] = useState<Task[]>([]);
    const [isListScrollEnabled, setIsListScrollEnabled] = useState(true);

    const handleSwipeStart = useCallback(() => setIsListScrollEnabled(false), []);
    const handleSwipeEnd = useCallback(() => setIsListScrollEnabled(true), []);

    const handleListTaskToggle = useCallback((item: any) => {
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
    }, [completingTaskIds, toggleTask]);

    const handleConfirmDelete = useCallback((taskId: string, todayString: string, onSuccess: () => void) => {
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
            onSuccess();
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
            onSuccess();
        }
    }, [tasks, deleteTask]);

    const handleRestoreTask = useCallback(async (taskId: string, todayString: string) => {
        const restoredTask = await StorageService.removeFromHistory(taskId);
        if (restoredTask) {
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
    }, [addTask]);

    const sortTasks = useCallback((tasksToSort: any[], criteria: string | null) => {
        if (!criteria) return tasksToSort;
        const sorted = [...tasksToSort];
        switch (criteria) {
            case 'importance':
                return sorted.sort((a, b) => (b.importance || 0) - (a.importance || 0));
            case 'date':
                return sorted.sort((a, b) => {
                    if (!a.deadline) return 1;
                    if (!b.deadline) return -1;
                    return a.deadline.localeCompare(b.deadline);
                });
            case 'recurrence':
                return sorted.sort((a, b) => {
                    const aRec = !!a.recurrence || !!a.rrule;
                    const bRec = !!b.recurrence || !!b.rrule;
                    if (aRec === bRec) return 0;
                    return aRec ? -1 : 1;
                });
            case 'color':
                return sorted.sort((a, b) => {
                    const colorA = a.color || '';
                    const colorB = b.color || '';
                    return colorA.localeCompare(colorB);
                });
            default:
                return tasksToSort;
        }
    }, []);

    const updateTaskProgress = useCallback((taskId: string, value: number) => {
        const { masterId, date, isInstance } = resolveId(taskId);
        if (isInstance && date) {
            const masterTask = tasks.find(t => t.id === masterId);
            if (masterTask) {
                const newInstanceProgress = { ...(masterTask.instanceProgress || {}) };
                newInstanceProgress[date] = value;
                updateTask(masterId, { instanceProgress: newInstanceProgress });
            }
        } else {
            updateTask(taskId, { progress: value });
        }
    }, [tasks, updateTask]);

    const handleSubtaskProgress = useCallback((taskId: string, subtaskId: string, progress: number, dateContext: string) => {
        updateSubtask(taskId, subtaskId, progress, dateContext);
    }, [updateSubtask]);

    return {
        completingTaskIds,
        handleListTaskToggle,
        handleConfirmDelete,
        handleRestoreTask,
        handleSwipeStart,
        handleSwipeEnd,
        isListScrollEnabled,
        sortTasks,
        historyTasks,
        setHistoryTasks,
        updateTaskProgress,
        handleSubtaskToggle: toggleSubtask,
        handleSubtaskProgress
    };
}
