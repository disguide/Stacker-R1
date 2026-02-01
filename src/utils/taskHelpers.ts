/**
 * Resolves a potentially composite ID (e.g. "task123_2024-01-01") into its components.
 * 
 * Composite IDs are used for instances of recurring tasks. 
 * They follow the format: `${originalTaskId}_${dateString}`
 */
export const resolveId = (id: string) => {
    let masterId = id;
    let date: string | null = null;
    let isInstance = false;

    if (id && id.includes('_')) {
        const parts = id.split('_');
        const potentialDate = parts[parts.length - 1];
        // Check for YYYY-MM-DD
        if (potentialDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            masterId = parts.slice(0, parts.length - 1).join('_');
            date = potentialDate;
            isInstance = true;
        }
    }
    return { masterId, date, isInstance };
};
