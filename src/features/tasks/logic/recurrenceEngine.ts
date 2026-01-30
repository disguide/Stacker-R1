import { RRule } from 'rrule';
import { Task, CalendarItem } from '../types';

/**
 * Domain Logic for generating "Ghost" instances from "Master" tasks.
 */
export const RecurrenceEngine = {
    /**
     * Projects Master tasks onto a date range to create CalendarItems.
     * Merges with Single tasks and filters out Exceptions/Completions.
     */
    generateCalendarItems(
        tasks: Task[],
        startDateStr: string,
        daysToShow: number
    ): CalendarItem[] {
        const items: CalendarItem[] = [];
        const startDate = new Date(startDateStr + 'T00:00:00');
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + daysToShow + 30); // Buffer

        tasks.forEach(task => {
            // 1. MASTER TASKS (Recurrence)
            if (task.rrule) {
                try {
                    const rule = RRule.fromString(task.rrule);
                    const dates = rule.between(startDate, endDate, true);

                    dates.forEach(dateObj => {
                        const dateString = dateObj.toISOString().split('T')[0];

                        // Skip Exceptions (Detached/Deleted instances)
                        if (task.exceptionDates?.includes(dateString)) return;

                        // Check Completion
                        const isCompleted = task.completedDates?.includes(dateString) || false;
                        if (isCompleted) return; // Completed instances vanish in this design

                        items.push({
                            id: `${task.id}_${dateString}`,
                            originalTaskId: task.id,
                            title: task.title,
                            date: dateString,
                            isGhost: true,
                            isCompleted: false,
                            type: 'task',
                            deadline: task.deadline,
                            estimatedTime: task.estimatedTime,
                            subtasks: task.subtasks,
                            progress: task.progress || 0
                        });
                    });
                } catch (e) {
                    console.warn(`[RecurrenceEngine] Failed to parse RRule for task ${task.id}`, e);
                }
            }
            // 2. SINGLE TASKS
            else {
                if (task.date >= startDateStr) {
                    // Check Completion (handling both new array and legacy boolean)
                    const isCompleted = task.completedDates
                        ? task.completedDates.includes(task.date)
                        : (task as any).completed || false;

                    if (isCompleted) return;

                    items.push({
                        id: task.id,
                        originalTaskId: task.id,
                        title: task.title,
                        date: task.date,
                        isGhost: false,
                        isCompleted: false,
                        type: 'task',
                        deadline: task.deadline,
                        estimatedTime: task.estimatedTime,
                        subtasks: task.subtasks,
                        progress: task.progress || 0
                    });
                }
            }
        });

        return this.deduplicateAndSort(items);
    },

    /**
     * Resolves collisions: Real Task > Ghost Task for the same ID/Date
     */
    deduplicateAndSort(items: CalendarItem[]): CalendarItem[] {
        const uniqueItems = new Map<string, CalendarItem>();

        items.forEach(item => {
            if (!uniqueItems.has(item.id)) {
                uniqueItems.set(item.id, item);
            } else {
                // If collision, prefer valid object? 
                // Logic: A 'detached' task has a new ID, so it won't collide with Ghost `${Master}_${Date}`.
                // Collisions mainly happen if logic error or duplicate keys.
                // We keep existing unless current is Real and existing was Ghost (unlikely with ID suffix).
                const existing = uniqueItems.get(item.id)!;
                if (!item.isGhost && existing.isGhost) {
                    uniqueItems.set(item.id, item);
                }
            }
        });

        return Array.from(uniqueItems.values()).sort((a, b) => a.date.localeCompare(b.date));
    }
};
