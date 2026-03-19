const fs = require('fs');

const storageFilePath = 'src/services/storage.ts';
let code = fs.readFileSync(storageFilePath, 'utf8');

const importStatement = `import { database } from '../database';
import { Q } from '@nozbe/watermelondb';
import { TaskHistoryModel } from '../database/models/TaskHistory';
import { SavedSprintModel } from '../database/models/SavedSprint';
import { SprintHistoryModel } from '../database/models/SprintHistory';
`;

code = code.replace("import AsyncStorage from '@react-native-async-storage/async-storage';", "import AsyncStorage from '@react-native-async-storage/async-storage';\n" + importStatement);


// Map fields properly for serialization and deserialization
const newMethods = `
    // HISTORY
    async loadHistory(): Promise<Task[]> {
        try {
            const historyCollection = database.get<TaskHistoryModel>('task_history');
            const records = await historyCollection.query(Q.sortBy('created_at', Q.desc)).fetch();
            return records.map(r => ({
                id: r.originalId,
                title: r.title,
                type: r.type as any,
                completed: r.completed,
                isCompleted: r.isCompleted,
                completedAt: r.completedAt,
                createdAt: r.createdAt,
                tagId: r.tagId,
                colorId: r.colorId,
                note: r.note,
                rrule: r.recurrenceRule,
                completedDates: r.completedDates,
                events: r.events,
                dueDate: r.dueDate,
            }));
        } catch (e) {
            console.error('Failed to load history', e);
            return [];
        }
    },

    async addToHistory(task: Task) {
        try {
            await database.write(async () => {
                const historyCollection = database.get<TaskHistoryModel>('task_history');
                await historyCollection.create(record => {
                    record.originalId = task.id;
                    record.title = task.title;
                    record.type = task.type || 'task';
                    record.completed = task.completed || false;
                    record.isCompleted = task.isCompleted || false;
                    record.completedAt = task.completedAt;
                    record.createdAt = task.createdAt || new Date().toISOString();
                    record.tagId = task.tagId;
                    record.colorId = task.colorId;
                    record.note = task.note;
                    record.recurrenceRule = task.rrule;
                    record.completedDates = task.completedDates;
                    record.events = task.events;
                    record.dueDate = task.dueDate;
                });
            });
        } catch (e) {
            console.error('Failed to add to history', e);
        }
    },

    async removeFromHistory(taskId: string): Promise<Task | null> {
        try {
            let taskData: Task | null = null;
            await database.write(async () => {
                const historyCollection = database.get<TaskHistoryModel>('task_history');
                const records = await historyCollection.query(Q.where('original_id', taskId)).fetch();
                if (records.length > 0) {
                    const r = records[0];
                    taskData = {
                        id: r.originalId,
                        title: r.title,
                        type: r.type as any,
                        completed: r.completed,
                        isCompleted: r.isCompleted,
                        completedAt: r.completedAt,
                        createdAt: r.createdAt,
                        tagId: r.tagId,
                        colorId: r.colorId,
                        note: r.note,
                        rrule: r.recurrenceRule,
                        completedDates: r.completedDates,
                        events: r.events,
                        dueDate: r.dueDate,
                    };
                    await r.destroyPermanently();
                }
            });
            return taskData;
        } catch (e) {
            console.error('Failed to restore from history', e);
            return null;
        }
    },

    async deleteFromHistory(taskId: string) {
        try {
            await database.write(async () => {
                const historyCollection = database.get<TaskHistoryModel>('task_history');
                const records = await historyCollection.query(Q.where('original_id', taskId)).fetch();
                for (const record of records) {
                    await record.destroyPermanently();
                }
            });
        } catch (e) {
            console.error('Failed to delete from history', e);
        }
    },
`;

code = code.replace(/\/\/ HISTORY[\s\S]*?(?=\/\/ TAGS)/, newMethods);

const newSavedSprintMethods = `
    // SAVED SPRINTS
    async loadSavedSprints(): Promise<SavedSprint[]> {
        try {
            const collection = database.get<SavedSprintModel>('saved_sprints');
            const records = await collection.query(Q.sortBy('date', Q.desc)).fetch();
            return records.map(r => ({
                id: r.originalId,
                date: r.date,
                primaryTask: r.primaryTask,
                durationSeconds: r.durationSeconds,
                taskCount: r.taskCount,
                timelineEvents: r.timelineEvents || [],
            }));
        } catch (e) {
            console.error('Failed to load saved sprints', e);
            return [];
        }
    },

    async saveSavedSprint(sprint: SavedSprint) {
        try {
            await database.write(async () => {
                const collection = database.get<SavedSprintModel>('saved_sprints');
                await collection.create(record => {
                    record.originalId = sprint.id;
                    record.date = sprint.date;
                    record.primaryTask = sprint.primaryTask;
                    record.durationSeconds = sprint.durationSeconds;
                    record.taskCount = sprint.taskCount || 0;
                    record.timelineEvents = sprint.timelineEvents;
                });
            });
        } catch (e) {
            console.error('Failed to save saved sprint', e);
        }
    },

    async updateSavedSprints(sprints: SavedSprint[]) {
        try {
            // Bulk delete and insert for re-ordering or full sync if needed
            await database.write(async () => {
                const collection = database.get<SavedSprintModel>('saved_sprints');
                const allRecords = await collection.query().fetch();
                for (const r of allRecords) {
                    await r.destroyPermanently();
                }

                for (const sprint of sprints) {
                    await collection.create(record => {
                        record.originalId = sprint.id;
                        record.date = sprint.date;
                        record.primaryTask = sprint.primaryTask;
                        record.durationSeconds = sprint.durationSeconds;
                        record.taskCount = sprint.taskCount || 0;
                        record.timelineEvents = sprint.timelineEvents;
                    });
                }
            });
        } catch (e) {
            console.error('Failed to update saved sprints array', e);
        }
    },

    async deleteSavedSprint(sprintId: string) {
        try {
            await database.write(async () => {
                const collection = database.get<SavedSprintModel>('saved_sprints');
                const records = await collection.query(Q.where('original_id', sprintId)).fetch();
                for (const r of records) {
                    await r.destroyPermanently();
                }
            });
        } catch (e) {
            console.error('Failed to delete saved sprint', e);
        }
    },

    // SPRINT HISTORY (All sessions)
    async loadSprintHistory(): Promise<SavedSprint[]> {
        try {
            const collection = database.get<SprintHistoryModel>('sprint_history');
            const records = await collection.query(Q.sortBy('date', Q.desc)).fetch();
            return records.map(r => ({
                id: r.originalId,
                date: r.date,
                primaryTask: r.primaryTask,
                durationSeconds: r.durationSeconds,
                taskCount: r.taskCount,
                timelineEvents: r.timelineEvents || [],
            }));
        } catch (e) {
            console.error('Failed to load sprint history', e);
            return [];
        }
    },

    async addToSprintHistory(sprint: SavedSprint) {
        try {
            await database.write(async () => {
                const collection = database.get<SprintHistoryModel>('sprint_history');
                await collection.create(record => {
                    record.originalId = sprint.id;
                    record.date = sprint.date;
                    record.primaryTask = sprint.primaryTask;
                    record.durationSeconds = sprint.durationSeconds;
                    record.taskCount = sprint.taskCount || 0;
                    record.timelineEvents = sprint.timelineEvents;
                });
            });
        } catch (e) {
            console.error('Failed to add to sprint history', e);
        }
    },

    async deleteSprintHistory(sprintId: string) {
        try {
            await database.write(async () => {
                const collection = database.get<SprintHistoryModel>('sprint_history');
                const records = await collection.query(Q.where('original_id', sprintId)).fetch();
                for (const r of records) {
                    await r.destroyPermanently();
                }
            });
        } catch (e) {
            console.error('Failed to delete from sprint history', e);
        }
    },
`;

code = code.replace(/\/\/ SAVED SPRINTS[\s\S]*?(?=\/\/ --- Mail Storage --- \/\/)/, newSavedSprintMethods + "\n    ");

fs.writeFileSync(storageFilePath, code);
