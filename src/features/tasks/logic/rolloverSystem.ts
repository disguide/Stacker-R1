import { Task, Subtask } from '../types';
import { RRule } from 'rrule';
import { toISODateString } from '../../../utils/dateHelpers';

// Simple UUID generator
const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
});

export interface RolloverActions {
    updates: Task[];      // Modified existing tasks (Single tasks moved forward, Master tasks with new exceptions)
    creations: Task[];    // New single tasks created from recurring instances
}

export const RolloverSystem = {
    /**
     * Scans tasks and determines what needs to be rolled over to "Today".
     * @param tasks All current tasks
     * @param today Date object for "Today" (defaults to real now)
     * @param lookbackDays How far back to check for missed instances
     */
    getRolloverActions(
        tasks: Task[],
        today: Date = new Date(),
        lookbackDays: number = 60
    ): RolloverActions {
        const updates: Task[] = [];
        const creations: Task[] = [];

        // Normalize today to start of day YYYY-MM-DD
        const now = new Date(today);
        now.setHours(0, 0, 0, 0);
        const todayStr = toISODateString(now);

        // Calculate lookback window
        const lookbackDate = new Date(now);
        lookbackDate.setDate(now.getDate() - lookbackDays);
        const lookbackStr = toISODateString(lookbackDate);

        tasks.forEach(task => {
            // 1. SINGLE TASKS (Non-Recurring)
            if (!task.rrule) {
                // Check if it's in the past AND incomplete
                const isCompleted = task.completedDates
                    ? task.completedDates.includes(task.date)
                    : !!(task as any).completed;

                if (!isCompleted && task.date < todayStr && task.date >= lookbackStr) {
                    // IT NEEDS ROLLOVER
                    // Logic: Move to Today, Increment daysRolled
                    const originalDateObj = new Date(task.date + 'T00:00:00');
                    const diffTime = Math.abs(now.getTime() - originalDateObj.getTime());
                    const daysAdded = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    const currentRolled = task.daysRolled || 0;

                    updates.push({
                        ...task,
                        date: todayStr,
                        daysRolled: currentRolled + daysAdded
                    });
                }
            }

            // 2. RECURRING TASKS (Master)
            else if (task.rrule) {
                try {
                    const rule = RRule.fromString(task.rrule);
                    const instances = rule.between(lookbackDate, now, true);

                    const newExceptions: string[] = [];
                    let hasChanges = false;

                    instances.forEach(dateObj => {
                        const dateString = toISODateString(dateObj);

                        // Safety: stop if we reached Today
                        if (dateString >= todayStr) return;

                        // Check Exception (Already processed/deleted)
                        if (task.exceptionDates?.includes(dateString)) return;

                        // Check Completion
                        const isCompleted = task.completedDates?.includes(dateString);
                        if (isCompleted) return;

                        // FOUND OVERDUE INSTANCE!
                        hasChanges = true;
                        newExceptions.push(dateString);

                        const diffTime = Math.abs(now.getTime() - dateObj.getTime());
                        const daysAdded = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        // Clone Subtasks (Reset completion)
                        const freshSubtasks: Subtask[] = task.subtasks?.map(s => ({
                            ...s,
                            id: uuid(),
                            completed: false,
                            progress: 0
                        })) || [];

                        // Check for instance specific data
                        let specificSubtasks: Subtask[] = freshSubtasks;
                        if (task.instanceSubtasks && task.instanceSubtasks[dateString]) {
                            // Use slice/map to clone
                            specificSubtasks = task.instanceSubtasks[dateString].map(s => ({ ...s }));
                        }

                        // Create the new Task
                        const newTask: Task = {
                            ...task,
                            id: uuid(), // NEW ID
                            originalTaskId: task.id, // Link back
                            date: todayStr, // Force to Today
                            rrule: undefined, // REMOVE Recurrence
                            recurrence: undefined,
                            completedDates: [],
                            exceptionDates: [],
                            instanceProgress: undefined,
                            instanceSubtasks: undefined,
                            daysRolled: daysAdded,
                            subtasks: specificSubtasks,
                        };

                        creations.push(newTask);
                    });

                    if (hasChanges) {
                        const existingExceptions = task.exceptionDates || [];
                        updates.push({
                            ...task,
                            exceptionDates: [...existingExceptions, ...newExceptions]
                        });
                    }

                } catch (e) {
                    console.warn(`[RolloverSystem] Failed to parse rule for ${task.id}`, e);
                }
            }
        });

        return { updates, creations };
    }
};
