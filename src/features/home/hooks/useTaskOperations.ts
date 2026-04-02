import { useState, useRef, useCallback, useEffect } from 'react';
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
    const pendingItems = useRef<{ [key: string]: any }>({});
    const [historyTasks, setHistoryTasks] = useState<Task[]>([]);
    const [isListScrollEnabled, setIsListScrollEnabled] = useState(true);

    const handleSwipeStart = useCallback(() => setIsListScrollEnabled(false), []);
    const handleSwipeEnd = useCallback(() => setIsListScrollEnabled(true), []);

    const flushCompletions = useCallback(() => {
        const itemIds = Object.keys(completionTimeouts.current);
        itemIds.forEach(itemId => {
            clearTimeout(completionTimeouts.current[itemId]);
            const item = pendingItems.current[itemId];
            if (item) {
                // Fire and forget history add
                const originalTask = tasks.find(t => t.id === item.originalTaskId) || item;
                const taskToSave = { ...originalTask, id: item.id, title: item.title, date: item.date, completed: true, completedAt: new Date().toISOString() };
                StorageService.addToHistory(taskToSave as Task).catch(e => console.error('[useTaskOperations] History add failed:', e));

                toggleTask(item.originalTaskId, item.originalDate || item.date);
            }
        });

        completionTimeouts.current = {};
        pendingItems.current = {};
        setCompletingTaskIds(new Set());
    }, [tasks, toggleTask]);

    useEffect(() => {
        return () => {
            flushCompletions();
        };
    }, [flushCompletions]);

    const handleListTaskToggle = useCallback((item: any) => {
        if (__DEV__) console.log('[handleListTaskToggle] Toggling:', { id: item.id, originalDate: item.originalDate, projectedDate: item.date });
        if (item.isCompleted) {
            toggleTask(item.originalTaskId, item.originalDate || item.date);
            return;
        }

        const itemId = item.id;

        if (completingTaskIds.has(itemId)) {
            if (completionTimeouts.current[itemId]) {
                clearTimeout(completionTimeouts.current[itemId]);
                delete completionTimeouts.current[itemId];
                delete pendingItems.current[itemId];
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

            pendingItems.current[itemId] = item;

            completionTimeouts.current[itemId] = setTimeout(() => {
                const pendingItem = pendingItems.current[itemId];
                if (pendingItem) {
                    const originalTask = tasks.find(t => t.id === pendingItem.originalTaskId) || pendingItem;
                    const taskToSave = { ...originalTask, id: pendingItem.id, title: pendingItem.title, date: pendingItem.date, completed: true, completedAt: new Date().toISOString() };
                    StorageService.addToHistory(taskToSave as Task).catch(e => console.error('[useTaskOperations] History add failed:', e));
                    toggleTask(pendingItem.originalTaskId, pendingItem.originalDate || pendingItem.date);
                }

                delete completionTimeouts.current[itemId];
                delete pendingItems.current[itemId];

                setCompletingTaskIds(prev => {
                    const next = new Set(prev);
                    next.delete(itemId);
                    return next;
                });
            }, 2000);
        }
    }, [tasks, completingTaskIds, toggleTask]);

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
                id: Date.now().toString(),
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
        const sorted = [...tasksToSort];

        // Ensure default/'manual' sorting natively respects our dragged custom order
        if (!criteria || criteria === 'manual') {
            return sorted.sort((a, b) => {
                const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : 9999;
                const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : 9999;
                return orderA - orderB;
            });
        }

        // Helper to parse estimated time like "1h 30m" into minutes
        const parseTime = (timeStr?: string) => {
            if (!timeStr) return Number.MAX_SAFE_INTEGER;
            let mins = 0;
            const hMatch = timeStr.match(/(\d+)h/);
            const mMatch = timeStr.match(/(\d+)m/);
            if (hMatch) mins += parseInt(hMatch[1], 10) * 60;
            if (mMatch) mins += parseInt(mMatch[1], 10);
            return mins > 0 ? mins : Number.MAX_SAFE_INTEGER;
        };

        switch (criteria) {
            case 'auto_organise':
                return sorted.sort((a, b) => {
                    // 1. Due Time (Empty/Invalid to bottom)
                    const getTime = (d?: string | null) => {
                        if (!d) return Number.MAX_SAFE_INTEGER;
                        const t = new Date(d).getTime();
                        return isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
                    };
                    const timeA = getTime(a.deadline);
                    const timeB = getTime(b.deadline);
                    if (timeA !== timeB) return timeA - timeB;

                    // 2. Rollovers (Most rolled over first)
                    const rollA = a.daysRolled || 0;
                    const rollB = b.daysRolled || 0;
                    if (rollA !== rollB) return rollB - rollA;

                    // 3. Importance (Descending, empty to bottom)
                    const impA = a.importance || 0;
                    const impB = b.importance || 0;
                    if (impA !== impB) return impB - impA;

                    // 4. Estimated Time (Shortest first, empty to bottom)
                    const estA = parseTime(a.estimatedTime);
                    const estB = parseTime(b.estimatedTime);
                    if (estA !== estB) return estA - estB;

                    // 5. Color (Group colors together, empty to bottom)
                    const colA = a.color || 'zzz';
                    const colB = b.color || 'zzz';
                    return colA.localeCompare(colB);
                });
            case 'importance':
                return sorted.sort((a, b) => (b.importance || 0) - (a.importance || 0));
            case 'date':
                return sorted.sort((a, b) => {
                    if (!a.deadline) return 1;
                    if (!b.deadline) return -1;
                    return a.deadline.localeCompare(b.deadline);
                });
            case 'estimatedTime':
                return sorted.sort((a, b) => {
                    const estA = parseTime(a.estimatedTime);
                    const estB = parseTime(b.estimatedTime);
                    return estA - estB;
                });
            case 'color':
                return sorted.sort((a, b) => {
                    const colorA = a.color || '';
                    const colorB = b.color || '';
                    return colorA.localeCompare(colorB);
                });
            default:
                return sorted.sort((a, b) => {
                    const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : 9999;
                    const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : 9999;
                    return orderA - orderB;
                });
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
        handleSubtaskProgress,
        flushCompletions
    };
}
