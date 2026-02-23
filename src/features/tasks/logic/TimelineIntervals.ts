/**
 * Math utilities for converting Date and Time specifically into
 * pixel Y-coordinates for the continuous Macro Timeline View.
 */

// Configuration Options
export const TIMELINE_CONFIG = {
    DAY_HEIGHT: 20, // Vertical pixels per 1 elapsed day
};

// Represents the very top of the scroll view (Y=0).
// In V1, we'll fix this to January 1, 2024. Later this could be dynamic based on the oldest goal.
export const BASE_EPOCH = new Date(2024, 0, 1); // Jan 1, 2024 00:00:00

export const getDaysElapsed = (startDate: Date, endDate: Date): number => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    const diffTime = end.getTime() - start.getTime();
    return diffTime / (1000 * 60 * 60 * 24);
};

/**
 * Converts a Javascript Date object into an exact Y vertical pixel position.
 * This determines where to plot an event Marker relative to the BASE_EPOCH.
 */
export const dateToYPosition = (date: Date): number => {
    // 1. Get full days elapsed
    const fullDays = getDaysElapsed(BASE_EPOCH, date);

    // 2. Add fraction of the current day based on hours/minutes
    // (This allows absolute precision within the 20 pixel daily block)
    const fractionOfDay = (date.getHours() * 60 + date.getMinutes()) / 1440;

    return (fullDays + fractionOfDay) * TIMELINE_CONFIG.DAY_HEIGHT;
};

export interface MonthLabel {
    label: string;
    yPos: number;
}

/**
 * Generate formatted Month strings and their absolute Y positions
 * starting from BASE_EPOCH up to the given end date.
 */
export const getMonthLabels = (endDate: Date): MonthLabel[] => {
    const labels: MonthLabel[] = [];

    let currentDate = new Date(BASE_EPOCH);

    // Loop through months until we surpass the endDate
    while (currentDate.getTime() <= endDate.getTime()) {
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

        labels.push({
            label: monthStart.toLocaleDateString('default', { month: 'short', year: 'numeric' }), // e.g., "Jan 2024"
            yPos: dateToYPosition(monthStart)
        });

        // Increment to next month
        currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return labels;
};
