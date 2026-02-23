import AsyncStorage from '@react-native-async-storage/async-storage';

export type HistoryEventAction = 'added' | 'modified' | 'completed' | 'uncompleted' | 'deleted' | 'restored';

export interface HistoryLog {
    id: string; // uuid
    taskId: string;
    taskTitle: string;
    action: HistoryEventAction;
    timestamp: string; // ISO String (when did the event actually occur)
    date: string; // The logical "Date" bucket this event belongs to (for grouping by day in the UI)
    details?: string; // Optional metadata 
}

const KEYS = {
    ACTION_LOGS: '@stacker_action_logs_v1' // separate from old HISTORY key
};

export const HistoryRepository = {
    /**
     * Load all timeline logs
     */
    async getAll(): Promise<HistoryLog[]> {
        try {
            const json = await AsyncStorage.getItem(KEYS.ACTION_LOGS);
            return json ? JSON.parse(json) : [];
        } catch (e) {
            console.error('[HistoryRepository] Failed to load action logs', e);
            return [];
        }
    },

    /**
     * Save the entire log list (Replace)
     */
    async saveAll(logs: HistoryLog[]): Promise<void> {
        try {
            await AsyncStorage.setItem(KEYS.ACTION_LOGS, JSON.stringify(logs));
        } catch (e) {
            console.error('[HistoryRepository] Failed to save logs', e);
        }
    },

    /**
     * Prepend a single log (Archive style, but for timeline)
     */
    async addLog(log: HistoryLog): Promise<void> {
        try {
            const currentLogs = await this.getAll();
            const updated = [log, ...currentLogs];

            // Optional: keep the log size unbounded for now, or cap at e.g. 1000
            // if (updated.length > 1000) updated.length = 1000;

            await AsyncStorage.setItem(KEYS.ACTION_LOGS, JSON.stringify(updated));
        } catch (e) {
            console.error('[HistoryRepository] Failed to add log', e);
        }
    },

    /**
     * Clear all logs
     */
    async clearAll(): Promise<void> {
        try {
            await AsyncStorage.removeItem(KEYS.ACTION_LOGS);
        } catch (e) {
            console.error('[HistoryRepository] Failed to clear logs', e);
        }
    }
};
