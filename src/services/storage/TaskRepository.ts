import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task } from '../../core/types';

const KEYS = {
    ACTIVE: '@stacker_tasks_active',
    HISTORY: '@stacker_tasks_history_v1'
};

export const TaskRepository = {
    /**
     * Load all active tasks (Masters + Singles)
     */
    async getAll(): Promise<Task[]> {
        try {
            console.log('[TaskRepository] Reading from storage...');
            const json = await AsyncStorage.getItem(KEYS.ACTIVE);
            const data = json ? JSON.parse(json) : [];
            console.log('[TaskRepository] Read complete. Count:', data.length);
            return data;
        } catch (e) {
            console.error('[TaskRepository] Failed to load active tasks', e);
            return [];
        }
    },

    /**
     * Save the entire active list (Replace)
     */
    async saveAll(tasks: Task[]): Promise<void> {
        try {
            console.log('[TaskRepository] Saving to storage. Count:', tasks.length);
            await AsyncStorage.setItem(KEYS.ACTIVE, JSON.stringify(tasks));
            console.log('[TaskRepository] Save complete.');
        } catch (e) {
            console.error('[TaskRepository] Failed to save tasks', e);
        }
    },

    /**
     * Move a task to history (Archive)
     */
    async archive(task: Task): Promise<void> {
        try {
            const historyJson = await AsyncStorage.getItem(KEYS.HISTORY);
            const history = historyJson ? JSON.parse(historyJson) : [];
            const updated = [task, ...history];
            await AsyncStorage.setItem(KEYS.HISTORY, JSON.stringify(updated));
        } catch (e) {
            console.error('[TaskRepository] Failed to archive task', e);
        }
    }
};
