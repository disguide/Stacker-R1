import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { schema } from './schema';
import { TaskHistoryModel } from './models/TaskHistory';
import { SavedSprintModel } from './models/SavedSprint';
import { SprintHistoryModel } from './models/SprintHistory';

const adapter = new SQLiteAdapter({
    schema,
    jsi: true, // fast access
    onSetUpError: error => {
        // Database failed to load -- offer the user to reload the app or log out
        console.error('WatermelonDB setup error', error);
    }
});

export const database = new Database({
    adapter,
    modelClasses: [
        TaskHistoryModel,
        SavedSprintModel,
        SprintHistoryModel,
    ],
});
