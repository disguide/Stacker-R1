import { useState, useEffect, useRef, useCallback } from 'react';
import { Task } from '../../../services/storage';

/**
 * Encapsulates all Reminder-related logic to keep the main component clean.
 * Handles initialization, toggling, updating, and resetting.
 */
export default function useTaskReminders(task: Task | null) {
    const [reminderOffset, setReminderOffset] = useState<number | null>(null);
    const [reminderTime, setReminderTime] = useState<string | null>(null);
    const [reminderEnabled, setReminderEnabled] = useState<boolean>(false);

    const prevTaskIdRef = useRef<string | null>(null);

    // 1. Initialization
    useEffect(() => {
        if (task) {
            const isNewTask = task.id !== prevTaskIdRef.current;
            if (isNewTask) {

                setReminderOffset(task.reminderOffset !== undefined ? task.reminderOffset : null);
                setReminderTime(task.reminderTime || null);
                // If explicit enabled flag exists, use it. Otherwise, infer from offset presence.
                setReminderEnabled(task.reminderEnabled !== undefined
                    ? task.reminderEnabled
                    : (task.reminderOffset !== null && task.reminderOffset !== undefined)
                );
                prevTaskIdRef.current = task.id;
            }
        } else {
            prevTaskIdRef.current = null;
        }
    }, [task]);

    // 2. Actions
    const toggleReminder = useCallback((enabled: boolean) => {
        setReminderEnabled(enabled);

        // Intelligent Toggle: If turning ON and no data exists, set defaults.
        if (enabled && reminderOffset === null) {
            setReminderOffset(0); // Default: Same Day (Always 0 now)
            setReminderTime('09:00'); // Default: 9 AM
        }
    }, [reminderOffset]);

    const updateReminder = useCallback((offset: number | null, time: string | null) => {
        setReminderOffset(offset);
        setReminderTime(time);

        // If we get valid data, auto-enable. If null, disable.
        if (offset !== null) {
            setReminderEnabled(true);
        } else {
            setReminderEnabled(false);
        }
    }, []);

    const clearReminder = useCallback(() => {
        setReminderOffset(null);
        setReminderTime(null);
        setReminderEnabled(false);
    }, []);

    return {
        reminderOffset,
        reminderTime,
        reminderEnabled,
        toggleReminder,
        updateReminder,
        clearReminder,
        setReminderOffset, // Expose raw setters if absolutely needed (try to avoid)
        setReminderTime,
        setReminderEnabled
    };
}
