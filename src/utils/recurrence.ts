import { RecurrenceRule, WeekDay } from '../services/storage';
import { RRule, Frequency } from 'rrule';

const WEEKDAYS: WeekDay[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/**
 * Converts our internal RecurrenceRule object to an iCal RRule string.
 */
export function createRRuleString(rule: RecurrenceRule, startDateStr: string): string {
    const dtstart = new Date(startDateStr + 'T00:00:00');

    // Map Frequency
    let freq = RRule.DAILY;
    switch (rule.frequency) {
        case 'weekly': freq = RRule.WEEKLY; break;
        case 'monthly': freq = RRule.MONTHLY; break;
        case 'yearly': freq = RRule.YEARLY; break;
    }

    // Map Weekdays
    let byweekday: any[] | undefined = undefined;
    if (rule.frequency === 'weekly' && rule.daysOfWeek) {
        byweekday = rule.daysOfWeek.map(d => {
            switch (d) {
                case 'MO': return RRule.MO;
                case 'TU': return RRule.TU;
                case 'WE': return RRule.WE;
                case 'TH': return RRule.TH;
                case 'FR': return RRule.FR;
                case 'SA': return RRule.SA;
                case 'SU': return RRule.SU;
            }
        });
    }

    const options: any = {
        freq,
        dtstart,
        interval: rule.interval || 1,
        byweekday
    };

    if (rule.endDate) {
        options.until = new Date(rule.endDate + 'T00:00:00');
    }

    if (rule.occurrenceCount) {
        options.count = rule.occurrenceCount;
    }

    const rrule = new RRule(options);
    return rrule.toString();
}

/**
 * Calculates the next occurrence date based on the recurrence rule and the last occurrence date.
 */
export function calculateNextOccurrence(rule: RecurrenceRule, lastDateStr: string): string | null {
    const lastDate = new Date(lastDateStr);
    let nextDate = new Date(lastDate);

    // Basic Interval Calculation
    switch (rule.frequency) {
        case 'daily':
            nextDate.setDate(lastDate.getDate() + rule.interval);
            break;

        case 'weekly':
            if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
                // Find next day in the list
                const currentDayIndex = lastDate.getDay();
                const sortedDays = rule.daysOfWeek.map(d => WEEKDAYS.indexOf(d)).sort((a, b) => a - b);

                // Find first day in list that is AFTER current day
                const nextDayIndex = sortedDays.find(d => d > currentDayIndex);

                if (nextDayIndex !== undefined) {
                    // Same week, just later
                    nextDate.setDate(lastDate.getDate() + (nextDayIndex - currentDayIndex));
                } else {
                    // Next week (or configured interval), first available day
                    const daysToNextWeekStart = 7 - currentDayIndex; // Days to reach next Sunday
                    const firstDayOfNextInterval = sortedDays[0]; // Target day index

                    // Simplified logic for "Every X weeks" starting from Sunday
                    // Ideally we track "week start", but relative jump works:
                    // Jump to end of week, add (interval - 1) weeks, add offset to target day
                    const daysToJump = (rule.interval - 1) * 7 + (7 - currentDayIndex + firstDayOfNextInterval);
                    nextDate.setDate(lastDate.getDate() + daysToJump);
                }
            } else {
                // Simple weekly (e.g., every Monday if started on Monday)
                nextDate.setDate(lastDate.getDate() + (rule.interval * 7));
            }
            break;

        case 'monthly':
            // Simple monthly: Same day number
            const expectedMonth = (lastDate.getMonth() + rule.interval) % 12;
            nextDate.setMonth(lastDate.getMonth() + rule.interval);
            if (nextDate.getMonth() !== expectedMonth) {
                nextDate.setDate(0);
            }
            break;

        case 'yearly':
            nextDate.setFullYear(lastDate.getFullYear() + rule.interval);
            break;
    }

    // Check End Date
    if (rule.endDate) {
        const end = new Date(rule.endDate);
        if (nextDate > end) {
            return null;
        }
    }

    return toLocalISOString(nextDate);
}

/**
 * Checks if a target date matches the recurrence rule based on a start date.
 * Used for projecting future tasks safely.
 */
export function isRecurrenceMatch(rule: RecurrenceRule, startDateStr: string, targetDateStr: string): boolean {
    if (targetDateStr <= startDateStr) return false; // Only project future?

    const start = new Date(startDateStr);
    const target = new Date(targetDateStr);
    const end = rule.endDate ? new Date(rule.endDate) : null;

    if (end && target > end) return false;

    // Normalize times to midnight to avoid issues
    // But our Date objects from ISO strings usually are UTC midnight -> local midnight depends on parsing
    // Let's rely on date math.

    const diffTime = target.getTime() - start.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    switch (rule.frequency) {
        case 'daily':
            return diffDays % rule.interval === 0;

        case 'weekly':
            // 1. Check if same day of week (if simple) OR in allowed days
            // 2. Check if week interval matches

            const startDay = start.getDay();
            const targetDay = target.getDay();

            // Calculate "weeks passed"
            // Be careful with day of week boundaries.
            // Simple approach: difference in days / 7
            // But strict "Every 2 weeks" aligns with the Start Date's week.

            // Days from start date's Sunday?
            // Let's assume start date defines the "Anchor Week".
            const startSunday = new Date(start);
            startSunday.setDate(start.getDate() - startDay);

            const targetSunday = new Date(target);
            targetSunday.setDate(target.getDate() - targetDay);

            const weeksDiff = Math.round((targetSunday.getTime() - startSunday.getTime()) / (1000 * 60 * 60 * 24 * 7));

            if (weeksDiff % rule.interval !== 0) return false;

            if (rule.daysOfWeek && rule.daysOfWeek.length > 0) {
                const targetDayCode = WEEKDAYS[targetDay];
                return rule.daysOfWeek.includes(targetDayCode);
            } else {
                // Simple weekly must match the exact day of week
                return startDay === targetDay;
            }

        case 'monthly':
            // Check month diff matches interval
            // And day of month matches
            // (Handling day overflow - e.g. 31st - is tricky for projection, let's assume strict match for now or simple overflow)

            // Year diff * 12 + month diff
            const monthDiff = (target.getFullYear() - start.getFullYear()) * 12 + (target.getMonth() - start.getMonth());

            if (monthDiff > 0 && monthDiff % rule.interval === 0) {
                return target.getDate() === start.getDate();
            }
            return false;

        case 'yearly':
            const yearDiff = target.getFullYear() - start.getFullYear();
            if (yearDiff > 0 && yearDiff % rule.interval === 0) {
                return target.getMonth() === start.getMonth() && target.getDate() === start.getDate();
            }
            return false;

        default:
            return false;
    }
}

// Helper to match app's date string format
function toLocalISOString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
