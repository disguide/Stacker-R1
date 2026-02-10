
import { Task, ISODate, ISOTime } from './types';

/**
 * SANITIZER
 * Pure functions to clean and validate task data.
 * This is the firewall against "Zombie Tasks".
 */

export class Sanitizer {

    /**
     * Cleans a single task object, fixing or stripping invalid data.
     */
    static sanitizeTask(raw: any): Task | null {
        if (!raw || typeof raw !== 'object') return null;
        if (!raw.id || !raw.title) return null; // Garbage data

        // Fix Defaults
        const sanitized: Task = {
            id: String(raw.id),
            title: String(raw.title || 'Untitled'),

            // Critical: Date Sanitization
            date: Sanitizer.stripTime(raw.date) || Sanitizer.getToday(),
            time: Sanitizer.extractTime(raw.date) || raw.time, // Recover time if it was stuck in date

            // Optional Dates
            deadline: raw.deadline ? Sanitizer.stripTime(raw.deadline) : undefined,

            // Recurrence
            rrule: raw.rrule || undefined,
            recurrence: raw.recurrence || undefined,
            seriesId: raw.seriesId || undefined,

            // Logic
            isCompleted: !!raw.isCompleted || !!raw.completed, // Legacy field support
            completedDates: Array.isArray(raw.completedDates) ? raw.completedDates.map(Sanitizer.stripTime).filter(Boolean) as string[] : [],
            exceptionDates: Array.isArray(raw.exceptionDates) ? raw.exceptionDates.map(Sanitizer.stripTime).filter(Boolean) as string[] : [],

            // Progress
            progress: typeof raw.progress === 'number' ? raw.progress : 0,
            estimatedTime: (typeof raw.estimatedTime === 'string') ? raw.estimatedTime : undefined,

            // Metadata
            color: raw.color || '#38A169',
            type: raw.type || raw.taskType || 'task', // Handle legacy 'taskType'
            createdAt: raw.createdAt || Date.now(),
            updatedAt: Date.now(),
            originalTaskId: raw.originalTaskId || undefined
        };

        return sanitized;
    }

    /**
     * Batch sanitize
     */
    static sanitizeAll(rawTasks: any[]): Task[] {
        if (!Array.isArray(rawTasks)) return [];
        return rawTasks.map(t => Sanitizer.sanitizeTask(t)).filter(t => t !== null) as Task[];
    }

    // --- HELPERS ---

    /**
     * Returns strictly "YYYY-MM-DD" or null if invalid.
     * Safely handles "YYYY-MM-DDT12:00:00" by splitting.
     */
    static stripTime(dateStr: any): ISODate | null {
        if (!dateStr || typeof dateStr !== 'string') return null;
        try {
            // Split by T to remove time
            const clean = dateStr.split('T')[0];
            // Format check YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
                return clean;
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Extracts "HH:mm" from a dirty date string if present.
     */
    static extractTime(dateStr: any): ISOTime | undefined {
        if (!dateStr || typeof dateStr !== 'string') return undefined;
        if (dateStr.includes('T')) {
            const parts = dateStr.split('T');
            if (parts[1] && parts[1].length >= 5) {
                return parts[1].substring(0, 5); // "12:00"
            }
        }
        return undefined;
    }

    static getToday(): ISODate {
        return new Date().toISOString().split('T')[0];
    }
}
