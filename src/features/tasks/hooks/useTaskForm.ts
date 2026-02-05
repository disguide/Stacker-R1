import { useState, useCallback } from 'react';
import { Keyboard } from 'react-native';
import { RecurrenceRule } from '../../../../services/storage';

export const useTaskForm = () => {
    const [addingTaskForDate, setAddingTaskForDate] = useState<string | null>(null);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDeadline, setNewTaskDeadline] = useState<string | null>(null);
    const [newTaskEstimatedTime, setNewTaskEstimatedTime] = useState<string | null>(null);
    const [newTaskRecurrence, setNewTaskRecurrence] = useState<RecurrenceRule | null>(null);
    const [newTaskReminderTime, setNewTaskReminderTime] = useState<string | null>(null);
    const [addingSubtaskToParentId, setAddingSubtaskToParentId] = useState<string | null>(null);

    const resetForm = useCallback(() => {
        setAddingTaskForDate(null);
        setAddingSubtaskToParentId(null);
        setNewTaskTitle('');
        setNewTaskDeadline(null);
        setNewTaskEstimatedTime(null);
        setNewTaskRecurrence(null);
        setNewTaskReminderTime(null);
        Keyboard.dismiss();
    }, []);

    const startAddingTask = useCallback((dateString: string) => {
        setAddingTaskForDate(dateString);
        setNewTaskTitle('');
    }, []);

    return {
        // State
        addingTaskForDate,
        setAddingTaskForDate,
        newTaskTitle,
        setNewTaskTitle,
        newTaskDeadline,
        setNewTaskDeadline,
        newTaskEstimatedTime,
        setNewTaskEstimatedTime,
        newTaskRecurrence,
        setNewTaskRecurrence,
        newTaskReminderTime,
        setNewTaskReminderTime,
        addingSubtaskToParentId,
        setAddingSubtaskToParentId,

        // Actions
        resetForm,
        startAddingTask
    };
};
