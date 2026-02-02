import { RRule } from 'rrule';
import { Task, CalendarItem } from '../types';
import { toISODateString } from '../../../utils/dateHelpers';

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
                        // Use local YYYY-MM-DD to avoid checking UTC previous day
                        const dateString = toISODateString(dateObj);

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
                            // Use instance subtasks if available, otherwise use Template (all unchecked)
                            subtasks: (task.instanceSubtasks && task.instanceSubtasks[dateString])
                                ? task.instanceSubtasks[dateString]
                                : (task.subtasks?.map(s => ({ ...s, completed: false })) || []),
                            progress: (task.instanceProgress && task.instanceProgress[dateString]) || 0,
                            rrule: task.rrule, // Pass through for recurrence indicator
                            tagIds: task.tagIds // Copy tags
                        });
                    });
                } catch (e) {
                    console.warn(`[RecurrenceEngine] Failed to parse RRule for task ${task.id}`, e);
                }
            }
            // 2. SINGLE TASKS (Non-Recurring Only)
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
                        progress: task.progress || 0,
                        tagIds: task.tagIds
                    });
                }
            }
        });

        return this.deduplicateAndSort(items);
    },

    /**
     * Resolves collisions: Real Task > Ghost Task for the same ID/Date
     * AND ensures strict ID uniqueness.
     */
    deduplicateAndSort(items: CalendarItem[]): CalendarItem[] {
        // 1. Semantic Deduplication (Master vs Exception)
        const semanticMap = new Map<string, CalendarItem>();

        items.forEach(item => {
            // Unify key to be "OriginalTaskId_Date" to catch both Ghost and Real collisions
            const uniqueKey = `${item.originalTaskId}_${item.date}`;

            if (!semanticMap.has(uniqueKey)) {
                semanticMap.set(uniqueKey, item);
            } else {
                const existing = semanticMap.get(uniqueKey)!;
                // If collision, prefer Real Task over Ghost Task
                if (!item.isGhost && existing.isGhost) {
                    semanticMap.set(uniqueKey, item);
                }
            }
        });

        // 2. Strict ID Uniqueness (Safety Net)
        // Even after semantic dedup, verify we don't have two items with same ID
        const finalItems: CalendarItem[] = [];
        const seenIds = new Set<string>();

        Array.from(semanticMap.values()).forEach(item => {
            if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                finalItems.push(item);
            } else {
                console.warn(`[RecurrenceEngine] Duplicate ID filtered out: ${item.id}`);
            }
        });

        return finalItems.sort((a, b) => a.date.localeCompare(b.date));
    }
};
