import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task } from '../../core/types';
import { triggerSync } from '../SyncBus';

const KEYS = {
    ACTIVE: '@stacker_tasks_active',
    HISTORY: '@stacker_tasks_history_v1'
};

export const TaskRepository = {
    /**
     * Load all active tasks (Masters + Singles)
     * Automatically filters out soft-deleted items
     */
    async getAll(): Promise<Task[]> {
        try {
            const json = await AsyncStorage.getItem(KEYS.ACTIVE);
            const data: Task[] = json ? JSON.parse(json) : [];
            // FILTER: Hide soft-deleted tasks from the UI
            return data.filter(t => !t.deleted_at);
        } catch (e) {
            console.error('[TaskRepository] Failed to load active tasks', e);
            return [];
        }
    },

    /**
     * Internal helper to save data with sync flags.
     * Implements a diffing engine to prevent mass-timestamp updates.
     * @param tasks The array to save
     * @param markDirty If true, sets _isDirty = true on changed items
     */
    async _saveToStorage(key: string, newTasks: Task[], markDirty = true): Promise<void> {
        try {
            const timestamp = Date.now();
            const existingJson = await AsyncStorage.getItem(key);
            const existingTasks: Task[] = existingJson ? JSON.parse(existingJson) : [];
            const existingMap = new Map(existingTasks.map(t => [t.id, t]));

            const finalTasks: Task[] = [];
            const seenIds = new Set<string>();

            // 1. Process incoming tasks (Add/Update)
            for (const newTask of newTasks) {
                seenIds.add(newTask.id);
                const oldTask = existingMap.get(newTask.id);

                if (!oldTask) {
                    // New record
                    finalTasks.push({
                        ...newTask,
                        updated_at: timestamp,
                        ...(markDirty ? { _isDirty: true } : {})
                    });
                } else {
                    // Existing record - check for changes (ignore sync metadata)
                    const { updated_at: _u1, _isDirty: _d1, deleted_at: _del1, ...cleanOld } = oldTask as any;
                    const { updated_at: _u2, _isDirty: _d2, deleted_at: _del2, ...cleanNew } = newTask as any;
                    
                    if (JSON.stringify(cleanOld) !== JSON.stringify(cleanNew)) {
                        // Modified
                        finalTasks.push({
                            ...newTask,
                            updated_at: timestamp,
                            ...(markDirty ? { _isDirty: true } : {})
                        });
                    } else {
                        // Unchanged - preserve sync metadata
                        finalTasks.push({
                            ...newTask,
                            updated_at: (oldTask.updated_at as any) || timestamp,
                            _isDirty: oldTask._isDirty,
                            deleted_at: oldTask.deleted_at
                        });
                    }
                }
            }

            // 2. Handle missing items (Soft Delete)
            // Only for the active list: if an item is missing from the state array, it was deleted in the UI.
            if (key === KEYS.ACTIVE) {
                for (const oldTask of existingTasks) {
                    if (!seenIds.has(oldTask.id)) {
                        if (oldTask.deleted_at) {
                            finalTasks.push(oldTask); // Keep existing soft-deleted items
                        } else {
                            // Soft-delete item that was just removed from UI
                            finalTasks.push({
                                ...oldTask,
                                deleted_at: timestamp,
                                updated_at: timestamp,
                                ...(markDirty ? { _isDirty: true } : {})
                            });
                        }
                    }
                }
            }

            await AsyncStorage.setItem(key, JSON.stringify(finalTasks));
            triggerSync();
        } catch (e) {
            console.error('[TaskRepository] _saveToStorage failed', e);
        }
    },

    /**
     * Save the entire active list.
     * Used by UI actions to update state.
     */
    async saveAll(tasks: Task[]): Promise<void> {
        return this._saveToStorage(KEYS.ACTIVE, tasks, true);
    },

    /**
     * Soft Delete: Marks an item as deleted + dirty + bumps updated_at.
     */
    async softDelete(taskId: string): Promise<void> {
        try {
            const json = await AsyncStorage.getItem(KEYS.ACTIVE);
            const tasks: Task[] = json ? JSON.parse(json) : [];
            const timestamp = Date.now();
            
            const updated = tasks.map(t => 
                t.id === taskId ? { ...t, deleted_at: timestamp, updated_at: timestamp, _isDirty: true } : t
            );
            
            await AsyncStorage.setItem(KEYS.ACTIVE, JSON.stringify(updated));
            triggerSync();
        } catch (e) {
            console.error('[TaskRepository] Soft delete failed', e);
        }
    },

    /**
     * Move a task to history (Archive).
     * Soft-deletes from active list and appends to history.
     */
    async archive(task: Task): Promise<void> {
        try {
            const timestamp = Date.now();

            // 1. Soft-delete from active (propagate deletion to server)
            const activeJson = await AsyncStorage.getItem(KEYS.ACTIVE);
            const active: Task[] = activeJson ? JSON.parse(activeJson) : [];
            const updatedActive = active.map((t: Task) => 
                t.id === task.id ? { ...t, deleted_at: timestamp, updated_at: timestamp, _isDirty: true } : t
            );
            // If the task wasn't in the map (e.g. archived immediately after creation), add the tombstone
            if (!updatedActive.find(t => t.id === task.id)) {
                updatedActive.push({ ...task, deleted_at: timestamp, updated_at: timestamp, _isDirty: true });
            }
            await AsyncStorage.setItem(KEYS.ACTIVE, JSON.stringify(updatedActive));

            // 2. Add to history + mark Dirty
            const historyJson = await AsyncStorage.getItem(KEYS.HISTORY);
            const history = historyJson ? JSON.parse(historyJson) : [];
            const archivedTask = { ...task, updated_at: timestamp, _isDirty: true, deleted_at: undefined };
            const updatedHistory = [archivedTask, ...history];
            
            await AsyncStorage.setItem(KEYS.HISTORY, JSON.stringify(updatedHistory));
            triggerSync();
        } catch (e) {
            console.error('[TaskRepository] Failed to archive task', e);
        }
    }
};
