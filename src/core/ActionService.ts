
import { Task, ProjectedTask, ISODate } from './types';
import { RRule } from 'rrule';

/**
 * ACTION SERVICE
 * Determines HOW to update the store based on user intent.
 * Handles the complexity of Recurrence Splitting and Exceptions.
 */
export class ActionService {

    /**
     * TOGGLE COMPLETION
     * Returns the update for the Master Task.
     */
    static onToggle(task: ProjectedTask, master: Task): Partial<Task> {
        // 1. Single Task
        if (!master.rrule) {
            return {
                isCompleted: !task.isCompleted,
                updatedAt: Date.now()
            };
        }

        // 2. Recurring Instance
        const date = task.date; // The specific date of this instance
        const completedDates = new Set(master.completedDates || []);

        if (task.isCompleted) {
            // It WAS completed, so we un-complete it
            completedDates.delete(date);
        } else {
            // It WAS NOT completed, so we complete it
            completedDates.add(date);
        }

        return {
            completedDates: Array.from(completedDates),
            updatedAt: Date.now()
        };
    }

    /**
     * UPDATE SINGLE INSTANCE (Exception)
     * e.g. User changes title of ONE instance, or moves it.
     * Returns:
     * 1. Update for Master (add exception date)
     * 2. New Task (the independent instance)
     */
    static onUpdateInstance(task: ProjectedTask, master: Task, updates: Partial<Task>): { masterUpdate: Partial<Task>, newSingleTask: Task } {
        // 1. Mark date as Exception in Master
        const exceptionDates = new Set(master.exceptionDates || []);
        exceptionDates.add(task.date);

        // 2. Create Detached Single Task
        const newId = `${master.id}_exc_${task.date}`;
        const newSingleTask: Task = {
            ...master, // Inherit usage/color
            ...updates, // Apply specific edits
            id: newId,
            date: updates.date || task.date, // Use new date or keep original
            rrule: undefined, // Detached
            seriesId: master.id, // Link back to parent
            originalTaskId: master.id,
            completedDates: [],
            exceptionDates: [],
            updatedAt: Date.now(),
            createdAt: Date.now()
        };

        return {
            masterUpdate: {
                exceptionDates: Array.from(exceptionDates),
                updatedAt: Date.now()
            },
            newSingleTask
        };
    }

    /**
     * UPDATE SERIES (Normal or Split)
     * e.g. "Change all future events to 10am"
     */
    static onUpdateSeries(task: ProjectedTask, master: Task, updates: Partial<Task>, mode: 'all' | 'future'): {
        oldMasterUpdate?: Partial<Task>,
        newMaster?: Task
    } {
        if (mode === 'all') {
            // Simple update of the master
            return {
                oldMasterUpdate: { ...updates, updatedAt: Date.now() }
            };
        }

        // FUTURE SPLIT
        // 1. Clamp old master
        const cutoffDate = new Date(task.date + 'T00:00:00');
        cutoffDate.setDate(cutoffDate.getDate() - 1); // Until Yesterday
        cutoffDate.setHours(23, 59, 59, 999);

        let oldRRuleStr = master.rrule || '';
        try {
            const oldRule = RRule.fromString(oldRRuleStr);
            const options = { ...oldRule.options, until: cutoffDate, count: undefined }; // Force UNTIL, remove COUNT
            oldRRuleStr = new RRule(options).toString();
        } catch (e) {
            console.warn('Failed to clamp RRule', e);
        }

        // 2. Create New Master
        const newSeriesId = `${Date.now()}_series`;
        const newMaster: Task = {
            ...master,
            ...updates,
            id: newSeriesId,
            date: task.date, // Start from THIS date
            completedDates: [], // Reset history
            exceptionDates: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            seriesId: `series_${newSeriesId}`
        };

        // Regenerate RRule for new master starting at new date
        // Note: consumer needs to generate the valid RRule string based on updates.recurrence

        return {
            oldMasterUpdate: { rrule: oldRRuleStr, updatedAt: Date.now() },
            newMaster
        };
    }
}
