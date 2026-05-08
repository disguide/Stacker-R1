import { useCallback } from 'react';
import { Alert } from 'react-native';
import { Task, Subtask } from '../../tasks/types';
import { resolveId } from '../../../utils/taskHelpers';
import { RRule } from 'rrule';
import { RecurrenceRule, RecurrenceFrequency, ColorDefinition, ColorSettings } from '../../../services/storage';
import { parseRRuleString } from '../../../utils/recurrence';
import { detectAutoColor, escapeRegex } from '../../../utils/autoColor';

interface UseTaskCreationProps {
    tasks: Task[];
    form: any; // Typed as return of useTaskForm
    addTask: (task: Task) => void;
    updateTask: (id: string, updates: Partial<Task>) => void;
    setEditingTask: (task: any) => void;
    setIsDrawerVisible: (visible: boolean) => void;
    setAddingSubtaskToParentId: (id: string | null) => void;
    setEditingSubtask: (task: any) => void;
    setInitialActiveFeature: (feature: any) => void;
    // Auto-color
    userColors?: ColorDefinition[];
    colorSettings?: ColorSettings;
}

export function useTaskCreation({
    tasks,
    form,
    addTask,
    updateTask,
    setEditingTask,
    setIsDrawerVisible,
    setAddingSubtaskToParentId,
    setEditingSubtask,
    setInitialActiveFeature,
    userColors = [],
    colorSettings = {},
}: UseTaskCreationProps) {

    const {
        newTaskTitle, newTaskDeadline, newTaskEstimatedTime, newTaskRecurrence, newTaskReminderTime,
        cancelAddingTask, setNewTaskTitle, setNewTaskDeadline, setNewTaskEstimatedTime
    } = form;

    const generateRRuleString = (recurrence: RecurrenceRule, startDateStr: string): string | undefined => {
        try {
            const freqMap: { [key: string]: any } = {
                'daily': RRule.DAILY,
                'weekly': RRule.WEEKLY,
                'monthly': RRule.MONTHLY,
                'yearly': RRule.YEARLY
            };

            const options: any = {
                freq: freqMap[recurrence.frequency],
                interval: recurrence.interval || 1,
                dtstart: new Date(startDateStr + 'T00:00:00')
            };

            if (recurrence.endDate) {
                options.until = new Date(recurrence.endDate);
            }
            if (recurrence.occurrenceCount) {
                options.count = recurrence.occurrenceCount;
            }
            if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
                const dayMap: { [key: string]: any } = {
                    'MO': RRule.MO, 'TU': RRule.TU, 'WE': RRule.WE, 'TH': RRule.TH, 'FR': RRule.FR, 'SA': RRule.SA, 'SU': RRule.SU
                };
                options.byweekday = recurrence.daysOfWeek.map(d => dayMap[d]).filter(Boolean);
            }

            const rule = new RRule(options);
            return rule.toString();
        } catch (e) {
            if (__DEV__) console.error("RRule Generation Failed", e);
            return undefined;
        }
    };

    const handleAddTask = useCallback((date: string | null, parentId?: string | null) => {
        if (!newTaskTitle.trim()) return;

        // Subtask Creation Mode - PRIORITY
        if (parentId) {
            const newSubtask: Subtask = {
                id: Date.now().toString(),
                title: newTaskTitle.trim(),
                isCompleted: false,
                deadline: newTaskDeadline || undefined,
                estimatedTime: newTaskEstimatedTime || undefined,
            };

            const { masterId } = resolveId(parentId);
            const targetMasterId = masterId;
            const parentTask = tasks.find(t => t.id === targetMasterId);

            if (parentTask) {
                const updatedSubtasks = [...(parentTask.subtasks || []), newSubtask];
                updateTask(targetMasterId, { subtasks: updatedSubtasks });
            }

            // Keep the quick add bar open for continuous subtask entry
            setNewTaskTitle('');
            // DO NOT clear parentId here to allow multiple subtasks
            return;
        }

        // Main Task Creation Mode
        if (!date) return;

        const taskId = Date.now().toString();
        let rruleString: string | undefined = undefined;

        if (newTaskRecurrence) {
            rruleString = generateRRuleString(newTaskRecurrence, date);
        }

        // AUTO-COLOR: scan the title for keyword matches against the user's palette
        const rawTitle = newTaskTitle.trim();
        const autoColorResult = detectAutoColor(rawTitle, userColors);
        const resolvedColor = autoColorResult?.color;
        let resolvedTitle = rawTitle;

        if (autoColorResult) {
            const regex = new RegExp(`\\b${escapeRegex(autoColorResult.matchedKeyword)}\\b`, 'g');
            const cleaned = rawTitle.replace(regex, '').replace(/\s+/g, ' ').trim();
            if (cleaned.length > 0) {
                resolvedTitle = cleaned;
            }
        }

        if (__DEV__ && autoColorResult) {
            console.log(
                `[AutoColor] Matched "${autoColorResult.matchedKeyword}" → ${autoColorResult.color}`
            );
        }

        const newTask: Task = {
            id: taskId,
            title: resolvedTitle,
            date: date,
            type: 'task',
            isCompleted: false,
            completedDates: [],
            exceptionDates: [],
            deadline: newTaskDeadline || undefined,
            estimatedTime: newTaskEstimatedTime || undefined,
            reminderTime: newTaskReminderTime || undefined,
            rrule: rruleString,
            subtasks: [],
            progress: 0,
            color: resolvedColor, // undefined when no keyword matched
            created_at: Date.now(),
            updated_at: Date.now(),
        };

        addTask(newTask);
        cancelAddingTask();
    }, [newTaskTitle, newTaskDeadline, newTaskEstimatedTime, newTaskRecurrence, newTaskReminderTime, tasks, addTask, updateTask, cancelAddingTask, setNewTaskTitle, userColors]);

    const saveEditedTask = useCallback((updatedTask: Task, shouldClose: boolean = true, editingTask: any) => {
        // 1. HANDLE NEW TASK CREATION
        if (updatedTask.id.startsWith('new_temp_')) {
            let finalTitle = updatedTask.title.trim();
            let finalColor = updatedTask.color;

            const autoColorResult = detectAutoColor(finalTitle, userColors);
            if (autoColorResult) {
                finalColor = autoColorResult.color;
                
                const regex = new RegExp(`\\b${escapeRegex(autoColorResult.matchedKeyword)}\\b`, 'g');
                const cleaned = finalTitle.replace(regex, '').replace(/\s+/g, ' ').trim();
                if (cleaned.length > 0) {
                    finalTitle = cleaned;
                }
            }

            const finalTask = { ...updatedTask, id: Date.now().toString(), title: finalTitle, color: finalColor };
            if (finalTask.recurrence) {
                const rrule = generateRRuleString(finalTask.recurrence, finalTask.date);
                if (rrule) finalTask.rrule = rrule;
            }
            addTask(finalTask);
            setEditingTask(null);
            setIsDrawerVisible(false);
            return;
        }

        // 2. DETECT CONTEXT (Series vs Single)
        let originalMasterId = updatedTask.id;
        let instanceDate = updatedTask.originalDate || updatedTask.date;

        if (editingTask?.isGhost && editingTask.originalTaskId) {
            originalMasterId = editingTask.originalTaskId;
        } else if (editingTask?.rrule) {
            originalMasterId = editingTask.id;
        }

        const originalMaster = tasks.find(t => t.id === originalMasterId);

        if (!originalMaster) {
            updateTask(updatedTask.id, updatedTask);
            if (shouldClose) {
                setEditingTask(null);
                setIsDrawerVisible(false);
            }
            return;
        }

        // ZOMBIE PREVENTION: Handle Rollover Rescheduling
        if (editingTask?.daysRolled > 0 && originalMaster.rrule) {
            const oldDate = editingTask.originalDate;
            const exceptions = new Set(originalMaster.exceptionDates || []);
            exceptions.add(oldDate);

            updateTask(originalMaster.id, { exceptionDates: Array.from(exceptions) });

            const newSingleTask: Task = {
                ...originalMaster,
                ...updatedTask,
                id: Date.now().toString(),
                date: updatedTask.date,
                rrule: undefined,
                seriesId: undefined,
                originalTaskId: undefined,
                completedDates: [],
                exceptionDates: [],
                daysRolled: 0
            };

            addTask(newSingleTask);
            if (shouldClose) {
                setEditingTask(null);
                setIsDrawerVisible(false);
            }
            return;
        }

        // RECURRENCE SPLIT ENGINE
        if (originalMaster.rrule) {
            try {
                const oldRule = RRule.fromString(originalMaster.rrule);
                const seriesStart = oldRule.options.dtstart;
                const targetDate = new Date(instanceDate + 'T00:00:00');
                const isFirstInstance = seriesStart.getTime() === targetDate.getTime();

                if (isFirstInstance) {
                    const finalUpdatedTask = { ...originalMaster, ...updatedTask, id: originalMaster.id };
                    if (updatedTask.recurrence) {
                        const newRRule = generateRRuleString(updatedTask.recurrence, instanceDate);
                        if (newRRule) finalUpdatedTask.rrule = newRRule;
                    } else {
                        finalUpdatedTask.rrule = undefined;
                        finalUpdatedTask.seriesId = undefined;
                    }
                    updateTask(originalMaster.id, finalUpdatedTask);
                } else {
                    // Split Series
                    const cutoffDate = new Date(targetDate);
                    cutoffDate.setDate(cutoffDate.getDate() - 1);
                    cutoffDate.setHours(23, 59, 59, 999);

                    const oldOptions = { ...oldRule.options };
                    oldOptions.until = cutoffDate;
                    if ((oldOptions as any).count) delete (oldOptions as any).count;
                    const clampedRRule = new RRule(oldOptions).toString();

                    updateTask(originalMaster.id, { rrule: clampedRRule });

                    const newSeriesId = Date.now().toString();
                    const newMasterTask: Task = {
                        ...originalMaster,
                        ...updatedTask,
                        id: newSeriesId,
                        date: instanceDate,
                        originalTaskId: undefined,
                        completedDates: [],
                        exceptionDates: [],
                        seriesId: `series_${newSeriesId}`,
                    };

                    if (updatedTask.recurrence) {
                        const newRRuleStr = generateRRuleString(updatedTask.recurrence, instanceDate);
                        if (newRRuleStr) newMasterTask.rrule = newRRuleStr;
                    } else {
                        newMasterTask.rrule = undefined;
                        newMasterTask.seriesId = undefined;
                    }

                    addTask(newMasterTask);
                }

            } catch (e) {
                if (__DEV__) console.error("Failed to process recurrence split", e);
                Alert.alert("Error", "Failed to update recurring task. See logs.");
                return;
            }
        } else {
            updateTask(updatedTask.id, updatedTask);
        }

        if (shouldClose) {
            setEditingTask(null);
            setIsDrawerVisible(false);
        }
    }, [tasks, addTask, updateTask, setEditingTask, setIsDrawerVisible, userColors]);

    const saveSubtask = useCallback((subtaskData: any, editingSubtask: any, addingSubtaskToParentId: string | null) => {
        const isNewTemp = editingSubtask?.subtask?.id?.startsWith('new_temp_');
        
        const newSubtask = {
            id: (editingSubtask && !isNewTemp ? subtaskData.id : Date.now().toString()),
            title: subtaskData.title,
            isCompleted: subtaskData.isCompleted || false,
            deadline: subtaskData.deadline,
            estimatedTime: subtaskData.estimatedTime,
        };

        if (editingSubtask) {
            const { masterId } = resolveId(editingSubtask.parentId);
            const parentTask = tasks.find(t => t.id === masterId);
            if (parentTask) {
                let updatedSubtasks;
                if (isNewTemp) {
                    updatedSubtasks = [...(parentTask.subtasks || []), newSubtask];
                } else {
                    updatedSubtasks = parentTask.subtasks?.map(s => s.id === editingSubtask.subtask.id ? newSubtask : s) || [];
                }
                updateTask(masterId, { subtasks: updatedSubtasks });
            }
        } else if (addingSubtaskToParentId) {
            const { masterId } = resolveId(addingSubtaskToParentId);
            const targetMasterId = masterId;
            const parentTask = tasks.find(t => t.id === targetMasterId);
            if (parentTask) {
                const updatedSubtasks = [...(parentTask.subtasks || []), newSubtask];
                updateTask(targetMasterId, { subtasks: updatedSubtasks });
            }
        }

        setEditingSubtask(null);
        setAddingSubtaskToParentId(null);
        setIsDrawerVisible(false);
    }, [tasks, updateTask, setEditingSubtask, setAddingSubtaskToParentId, setIsDrawerVisible]);

    const deleteSubtask = useCallback((parentId: string, subtaskId: string) => {
        const { masterId } = resolveId(parentId);
        const targetMasterId = masterId;
        const parentTask = tasks.find(t => t.id === targetMasterId);
        if (parentTask) {
            const updatedSubtasks = parentTask.subtasks?.filter(s => s.id !== subtaskId);
            updateTask(targetMasterId, { subtasks: updatedSubtasks });
        }
    }, [tasks, updateTask]);

    const openEditDrawer = useCallback((item: any) => {
        let drawerTask = {
            ...item,
            isCompleted: item.isCompleted !== undefined ? item.isCompleted : false,
        };

        if (item.isGhost && item.originalTaskId) {
            const masterTask = tasks.find(t => t.id === item.originalTaskId);
            if (masterTask && masterTask.rrule) {
                const recurrenceObj = parseRRuleString(masterTask.rrule);
                if (recurrenceObj) {
                    drawerTask.recurrence = recurrenceObj;
                }
                drawerTask.rrule = masterTask.rrule;
            }
        } else if (item.rrule) {
            const recurrenceObj = parseRRuleString(item.rrule);
            if (recurrenceObj) {
                drawerTask.recurrence = recurrenceObj;
            }
        }

        setInitialActiveFeature(null);
        setEditingTask(drawerTask);
        setIsDrawerVisible(true);
    }, [tasks, setEditingTask, setIsDrawerVisible, setInitialActiveFeature]);


    return {
        handleAddTask,
        saveEditedTask,
        saveSubtask,
        deleteSubtask,
        openEditDrawer
    };
}
