import { RRule } from 'rrule';
import { Task, CalendarItem } from '../types';

/**
 * Flattens master tasks into a list of daily CalendarItems for the UI.
 * Handles recurrence projection, exceptions, and completions.
 */
export function flattenCalendarData(
    startDateStr: string,
    daysToShow: number,
    allTasks: Task[]
): CalendarItem[] {
    const items: CalendarItem[] = [];

    // Normalize start date to midnight local
    // "2026-01-29" -> Date object
    const startDate = new Date(startDateStr + 'T00:00:00');
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + daysToShow + 30); // Buffer for safety

    allTasks.forEach(task => {
        // 1. Recurring Masters
        if (task.rrule) {
            try {
                const rule = RRule.fromString(task.rrule);

                // Optimize: Only get dates in range
                const dates = rule.between(startDate, endDate, true); // true = include start if matches

                dates.forEach(dateObj => {
                    // Format to YYYY-MM-DD
                    const dateString = dateObj.toISOString().split('T')[0];

                    // Check Exceptions (Deleted Instances)
                    if (task.exceptionDates?.includes(dateString)) {
                        return; // Skip this day
                    }

                    // Check Completion
                    const isCompleted = task.completedDates?.includes(dateString) || false;

                    // VANISH COMPLETED: If completed, do not add to items
                    if (isCompleted) {
                        return;
                    }

                    items.push({
                        id: `${task.id}_${dateString}`, // Unique stable ID for UI
                        originalTaskId: task.id,
                        title: task.title,
                        date: dateString,
                        isGhost: true, // It's a projection
                        isCompleted: isCompleted,
                        type: 'task',
                        deadline: task.deadline,
                        estimatedTime: task.estimatedTime,
                        subtasks: task.subtasks,
                        progress: task.progress
                    });
                });
            } catch (e) {
                console.warn('Failed to parse rrule for task', task.id, e);
            }
        }
        // 2. Single Tasks
        else {
            // Simple date filter
            // Use string comparison for YYYY-MM-DD
            // But we generally want to include all if we support "Agenda" view, 
            // or filter if strict "Calendar" view.
            // For now, let's include if >= startDate (simple optimization)
            if (task.date >= startDateStr) {
                const isCompleted = task.completedDates ? task.completedDates.includes(task.date) : ((task as any).completed || false);

                // VANISH COMPLETED: If completed, do not add to items
                if (isCompleted) {
                    return;
                }

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
                    progress: task.progress
                });
            }
        }
    });

    // 3. Deduplication & Sorting
    // Ensure uniqueness by ID. If collision, prefer "Single" task over "Ghost".
    const uniqueItems = new Map<string, CalendarItem>();

    items.forEach(item => {
        if (!uniqueItems.has(item.id)) {
            uniqueItems.set(item.id, item);
        } else {
            // Collision handling:
            // If we have a collision, it means we have a "Ghost" and a "Real" task with same expected ID?
            // Or two ghosts?
            // "Ghost" ID includes Date. "Real" task ID usually UUID. 
            // Only if "Real" task matches the Ghost ID format would we collide.
            // But let's prioritize the non-ghost (Real task > Ghost)
            const existing = uniqueItems.get(item.id)!;
            if (!item.isGhost && existing.isGhost) {
                uniqueItems.set(item.id, item); // Replace ghost with real
            }
        }
    });

    const finalItems = Array.from(uniqueItems.values());

    // Sort by Date
    finalItems.sort((a, b) => a.date.localeCompare(b.date));

    return finalItems;
}
