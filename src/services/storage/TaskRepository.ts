import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task } from '../../features/tasks/types'; // We'll need to define this or import from central types

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
            const json = await AsyncStorage.getItem(KEYS.ACTIVE);
            return json ? JSON.parse(json) : [];
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
            await AsyncStorage.setItem(KEYS.ACTIVE, JSON.stringify(tasks));
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
