import { useState } from 'react';
import { Task, Subtask } from '../types';

export const useTaskUI = () => {
    // Top-level Modals
    const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
    const [isRecurrencePickerVisible, setIsRecurrencePickerVisible] = useState(false);
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);

    // Color Settings
    const [isColorSettingsVisible, setIsColorSettingsVisible] = useState(false);

    // Calendar / Date Picking
    const [isCalendarVisible, setIsCalendarVisible] = useState(false);
    const [calendarMode, setCalendarMode] = useState<'new' | 'edit'>('new');
    const [calendarInitialPage, setCalendarInitialPage] = useState(0);
    const [calendarTempDate, setCalendarTempDate] = useState<string | null>(null);

    // Duration Picking
    const [isDurationPickerVisible, setIsDurationPickerVisible] = useState(false);
    const [durationMode, setDurationMode] = useState<'new' | 'edit'>('new');

    // Task Edit Drawer
    const [isDrawerVisible, setIsDrawerVisible] = useState(false);
    const [editingTask, setEditingTask] = useState<any>(null); // Using any temporarily to match existing usage (extended task)
    const [editingSubtask, setEditingSubtask] = useState<{ parentId: string, subtask: Subtask } | null>(null);

    // Task Menu
    const [isMenuVisible, setIsMenuVisible] = useState(false);
    const [activeMenuTask, setActiveMenuTask] = useState<Task | null>(null);
    const [activeMenuSubtask, setActiveMenuSubtask] = useState<{ parentId: string, subtaskId: string } | null>(null);

    return {
        // Modals
        isTimePickerVisible, setIsTimePickerVisible,
        isRecurrencePickerVisible, setIsRecurrencePickerVisible,
        isHistoryVisible, setIsHistoryVisible,
        isColorSettingsVisible, setIsColorSettingsVisible,

        // Calendar
        isCalendarVisible, setIsCalendarVisible,
        calendarMode, setCalendarMode,
        calendarInitialPage, setCalendarInitialPage,
        calendarTempDate, setCalendarTempDate,

        // Duration
        isDurationPickerVisible, setIsDurationPickerVisible,
        durationMode, setDurationMode,

        // Drawer
        isDrawerVisible, setIsDrawerVisible,
        editingTask, setEditingTask,
        editingSubtask, setEditingSubtask,

        // Menu
        isMenuVisible, setIsMenuVisible,
        activeMenuTask, setActiveMenuTask,
        activeMenuSubtask, setActiveMenuSubtask
    };
};
