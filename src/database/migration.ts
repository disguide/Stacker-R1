import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from './index';
import { STORAGE_KEYS } from '../services/storage';
import { TaskHistoryModel } from './models/TaskHistory';
import { SavedSprintModel } from './models/SavedSprint';
import { SprintHistoryModel } from './models/SprintHistory';

export async function migrateHistoryToWatermelonDB() {
    try {
        const hasMigrated = await AsyncStorage.getItem('@stacker_watermelondb_migrated');
        if (hasMigrated === 'true') {
            return; // Already migrated
        }

        console.log('[Migration] Starting WatermelonDB migration...');

        // 1. Migrate Task History
        const taskHistoryJson = await AsyncStorage.getItem(STORAGE_KEYS.HISTORY);
        const taskHistory = taskHistoryJson ? JSON.parse(taskHistoryJson) : [];

        // 2. Migrate Saved Sprints
        const savedSprintsJson = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_SPRINTS);
        const savedSprints = savedSprintsJson ? JSON.parse(savedSprintsJson) : [];

        // 3. Migrate Sprint History
        const sprintHistoryJson = await AsyncStorage.getItem(STORAGE_KEYS.SPRINT_HISTORY);
        const sprintHistory = sprintHistoryJson ? JSON.parse(sprintHistoryJson) : [];

        if (taskHistory.length > 0 || savedSprints.length > 0 || sprintHistory.length > 0) {
            await database.write(async () => {
                const historyCollection = database.get<TaskHistoryModel>('task_history');
                const savedSprintsCollection = database.get<SavedSprintModel>('saved_sprints');
                const sprintHistoryCollection = database.get<SprintHistoryModel>('sprint_history');

                const batches = [];

                // Tasks
                for (const task of taskHistory) {
                    batches.push(
                        historyCollection.prepareCreate(record => {
                            record.originalId = task.id;
                            record.title = task.title;
                            record.type = task.type || 'task';
                            record.completed = task.completed || false;
                            record.isCompleted = task.completed || false;
                            record.completedAt = task.completedAt;
                            record.createdAt = task.createdAt || new Date().toISOString();
                            record.date = task.date || new Date().toISOString().split('T')[0];
                            record.tagId = task.tagIds?.[0];
                            record.colorId = task.color;
                            record.recurrenceRule = task.rrule;
                            record.completedDates = task.completedDates;
                        })
                    );
                }

                // Saved Sprints
                for (const sprint of savedSprints) {
                    batches.push(
                        savedSprintsCollection.prepareCreate(record => {
                            record.originalId = sprint.id;
                            record.date = sprint.date;
                            record.primaryTask = sprint.primaryTask;
                            record.durationSeconds = sprint.durationSeconds;
                            record.taskCount = sprint.taskCount || 0;
                            record.timelineEvents = sprint.timelineEvents;
                        })
                    );
                }

                // Sprint History
                for (const sprint of sprintHistory) {
                    batches.push(
                        sprintHistoryCollection.prepareCreate(record => {
                            record.originalId = sprint.id;
                            record.date = sprint.date;
                            record.primaryTask = sprint.primaryTask;
                            record.durationSeconds = sprint.durationSeconds;
                            record.taskCount = sprint.taskCount || 0;
                            record.timelineEvents = sprint.timelineEvents;
                        })
                    );
                }

                await database.batch(...batches);
            });

            console.log(`[Migration] Successfully migrated ${taskHistory.length} tasks, ${savedSprints.length} saved sprints, and ${sprintHistory.length} sprint history records.`);
        }

        // Clean up AsyncStorage arrays now that they are in SQLite
        await AsyncStorage.multiRemove([
            STORAGE_KEYS.HISTORY,
            STORAGE_KEYS.SAVED_SPRINTS,
            STORAGE_KEYS.SPRINT_HISTORY
        ]);

        // Mark as migrated
        await AsyncStorage.setItem('@stacker_watermelondb_migrated', 'true');
        console.log('[Migration] Migration complete.');

    } catch (e) {
        console.error('[Migration] Failed to migrate to WatermelonDB', e);
    }
}
