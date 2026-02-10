
import { RRule } from 'rrule';
import { Task, ProjectedTask, ISODate } from './types';

/**
 * PROJECTOR
 * Pure logic to expand recurring tasks into "Projected" instances for the UI.
 * Zero side effects.
 */
export class Projector {

    static projectTasks(tasks: Task[], viewStartDate: ISODate, daysToProject: number): ProjectedTask[] {
        const result: ProjectedTask[] = [];
        const viewStart = new Date(viewStartDate + 'T00:00:00');
        const viewEnd = new Date(viewStart);
        viewEnd.setDate(viewEnd.getDate() + daysToProject);
        // Set end of day for inclusive comparison
        viewEnd.setHours(23, 59, 59, 999);

        const projectableTasks = tasks.filter(t => !t.seriesId); // Master (rrule) or Independent Single Tasks

        for (const task of projectableTasks) {
            // 1. Single Task (Non-recurring)
            if (!task.rrule) {
                // Determine display date (effective logic: use date)
                // Filter by view range
                if (Projector.isDateInRange(task.date, viewStart, viewEnd)) {
                    result.push(Projector.toProjected(task, task.date, false));
                }
                continue;
            }

            // 2. Recurring Series (Master)
            try {
                // Parse Rule
                const rule = RRule.fromString(task.rrule);
                const options = rule.options;

                // Override dtstart with master task date if needed, or rely on rrule string?
                // Stacker logic: RRule string is source of truth for schedule.
                // However, we must respect the "Exception Dates" to skip instances.

                const instances = rule.between(viewStart, viewEnd, true); // true = inclusive

                for (const dateObj of instances) {
                    const dateStr = dateObj.toISOString().split('T')[0];

                    // CHECK EXCEPTIONS (Skipped/Moved Instances)
                    if (task.exceptionDates && task.exceptionDates.includes(dateStr)) {
                        continue; // Skip this date, it was moved/deleted
                    }

                    // CHECK COMPLETION (Is this specific instance done?)
                    const isCompleted = task.completedDates && task.completedDates.includes(dateStr);

                    // Create Ghost Projection
                    result.push(Projector.toProjected(task, dateStr, true, isCompleted));
                }

            } catch (e) {
                console.warn(`[Projector] Failed to project task ${task.id}`, e);
                // Fallback: Show master if in range
                if (Projector.isDateInRange(task.date, viewStart, viewEnd)) {
                    result.push(Projector.toProjected(task, task.date, false));
                }
            }
        }

        // 3. Independent Instances (Tasks WITH seriesId)
        // These are "Exceptions" that became real tasks (Moved/Detached)
        // They are stored as normal tasks but linked to a series for history/color syncing if desired.
        // We treat them as normal single tasks for projection purposes, but maybe grouping later?
        // For now, simple projection.
        const detachedInstances = tasks.filter(t => t.seriesId);
        for (const task of detachedInstances) {
            if (Projector.isDateInRange(task.date, viewStart, viewEnd)) {
                result.push(Projector.toProjected(task, task.date, false));
            }
        }

        // Sort by Time/Creation
        return result.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            // Same date? Check time
            if (a.time && b.time) return a.time.localeCompare(b.time);
            if (a.time && !b.time) return -1; // Time comes first? Or last? Usually time-based first.
            if (!a.time && b.time) return 1;
            // Creation fallback
            return a.createdAt - b.createdAt;
        });
    }

    // --- HELPERS ---

    private static toProjected(master: Task, date: ISODate, isGhost: boolean, isCompletedOverride?: boolean): ProjectedTask {
        // Generating a stable ID for the projection
        // If it's a real task (not ghost), use its ID.
        // If ghost, generate: masterId + date
        const id = isGhost ? `${master.id}_${date}` : master.id;

        return {
            ...master,
            id: id,
            date: date, // The Projected Date
            originalDate: date, // For tracking
            isGhost: isGhost,
            isCompleted: isCompletedOverride !== undefined ? isCompletedOverride : master.isCompleted,
            daysRolled: 0, // Logic to be added for Rollovers if needed, or calculated elsewhere

            // If it's a ghost, it doesn't have real "completedDates" of its own, so we strip them to avoid confusion
            completedDates: isGhost ? [] : master.completedDates,
            exceptionDates: isGhost ? [] : master.exceptionDates,
            originalTaskId: isGhost ? master.id : master.originalTaskId
        };
    }

    private static isDateInRange(dateStr: string, start: Date, end: Date): boolean {
        const d = new Date(dateStr + 'T00:00:00');
        return d >= start && d <= end;
    }
}
