import { ViewMode, VIEW_CONFIG } from '../constants/theme';

// ============================================================================
// === DATE HELPER FUNCTIONS ===
// ============================================================================

/**
 * Format date as "23 Jan"
 */
export const formatDate = (date: Date): string => {
    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    return `${day} ${month}`;
};

/**
 * Get day name (e.g., "Monday")
 */
export const getDayName = (date: Date): string => {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
};

/**
 * Get local ISO date string (YYYY-MM-DD) without timezone issues
 */
export const toISODateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Check if date is today
 */
export const isToday = (date: Date): boolean => {
    const today = new Date();
    return toISODateString(date) === toISODateString(today);
};

/**
 * Generate dates based on view mode and offset
 */
export const generateDates = (viewMode: ViewMode, offset: number): Date[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const numDays = VIEW_CONFIG[viewMode].days;
    const startOffset = offset * numDays;

    const dates: Date[] = [];
    for (let i = 0; i < numDays; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + startOffset + i);
        dates.push(date);
    }
    return dates;
};

/**
 * Format deadline for display
 * Handles time-only format, ISO datetime, and standard date format
 * Format: "Jan 31 10AM • 1D" or "Jan 31 • Today"
 */
export const formatDeadline = (dateString: string): string => {
    if (!dateString) return '';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Handle time-only format (HH:mm or HH:mm:ss) for recurring tasks
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(dateString)) {
        const [hours, mins] = dateString.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${mins.toString().padStart(2, '0')}${period}`;
    }

    let datePart = dateString;
    let timeStr = '';

    // Handle ISO datetime with time (e.g., "2026-01-29T09:00")
    if (dateString.includes('T')) {
        const [dp, tp] = dateString.split('T');
        datePart = dp;
        if (tp) {
            const [hours, mins] = tp.slice(0, 5).split(':').map(Number);
            const period = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours % 12 || 12;
            timeStr = ` ${displayHours}${period}`;
        }
    }

    // Parse date part
    const [y, m, d] = datePart.split('-').map(Number);
    const deadlineDate = new Date(y, m - 1, d);

    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const month = deadlineDate.toLocaleString('default', { month: 'short' });
    const day = deadlineDate.getDate();

    let relative = '';
    if (diffDays === 0) relative = 'Today';
    else if (diffDays === 1) relative = '1D';
    else if (diffDays > 1) relative = `${diffDays}D`;
    else if (diffDays < 0) relative = `${diffDays}D`;

    return `${month} ${day}${timeStr} • ${relative}`;
};

/**
 * Calculate remaining time from estimated time and progress
 */
export const getRemainingTime = (estimatedTime: string, progress: number = 0): string | null => {
    if (!estimatedTime) return null;
    if (progress === 100) return 'Done';

    // Parse: "1h 30m", "1h45", "45min"
    let totalMinutes = 0;
    const hoursMatch = estimatedTime.match(/(\d+)\s*h/i);
    const minutesMatch = estimatedTime.match(/(\d+)\s*m/i) || estimatedTime.match(/h\s*(\d+)/i);

    if (hoursMatch) totalMinutes += parseInt(hoursMatch[1]) * 60;
    if (minutesMatch) totalMinutes += parseInt(minutesMatch[1]);

    if (totalMinutes === 0) return estimatedTime;

    // Apply progress ONLY if > 0 (otherwise show original estimate)
    const remaining = progress > 0 ? Math.round(totalMinutes * (1 - progress / 100)) : totalMinutes;

    const h = Math.floor(remaining / 60);
    const m = remaining % 60;

    // Format: 1h45 or 45min
    if (h > 0) {
        return m > 0 ? `${h}h${m}` : `${h}h`;
    } else {
        return `${m}min`;
    }
};

/**
 * Parse estimated time string and return total minutes
 */
export const parseEstimatedTime = (estimatedTime: string): number => {
    let totalMinutes = 0;
    const hMatch = estimatedTime.match(/(\d+)\s*h/i);
    const mMatch = estimatedTime.match(/(\d+)\s*m/i) || estimatedTime.match(/h\s*(\d+)/i);

    if (hMatch) totalMinutes += parseInt(hMatch[1]) * 60;
    if (mMatch) totalMinutes += parseInt(mMatch[1]);

    return totalMinutes;
};

/**
 * Format minutes as time string (e.g., "2h30min")
 */
export const formatMinutesAsTime = (totalMinutes: number): string => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;

    if (h > 0) {
        return m > 0 ? `${h}h${m}min` : `${h}h`;
    }
    return `${m}min`;
};

/**
 * Calculate the difference in days between the given date and today.
 * Returns formatted string like "0D", "1D", "-1D".
 */
export const getDaysDifference = (date: Date): string => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    return `${diffDays}D`;
};
