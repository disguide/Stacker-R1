import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
    version: 1,
    tables: [
        tableSchema({
            name: 'task_history',
            columns: [
                { name: 'original_id', type: 'string' }, // maps to Task.id
                { name: 'title', type: 'string' },
                { name: 'type', type: 'string' },
                { name: 'completed', type: 'boolean' },
                { name: 'is_completed', type: 'boolean' },
                { name: 'completed_at', type: 'string', isOptional: true },
                { name: 'created_at', type: 'string' },
                { name: 'tag_id', type: 'string', isOptional: true },
                { name: 'color_id', type: 'string', isOptional: true },
                { name: 'note', type: 'string', isOptional: true },
                { name: 'recurrence_rule', type: 'string', isOptional: true },
                { name: 'completed_dates', type: 'string', isOptional: true }, // JSON array string
                { name: 'events', type: 'string', isOptional: true }, // JSON array string
                { name: 'due_date', type: 'string', isOptional: true },
                { name: 'date', type: 'string' },
            ]
        }),
        tableSchema({
            name: 'saved_sprints',
            columns: [
                { name: 'original_id', type: 'string' }, // maps to SavedSprint.id
                { name: 'date', type: 'string' },
                { name: 'primary_task', type: 'string', isOptional: true },
                { name: 'duration_seconds', type: 'number' },
                { name: 'task_count', type: 'number' },
                { name: 'timeline_events', type: 'string', isOptional: true }, // JSON array string
            ]
        }),
        tableSchema({
            name: 'sprint_history',
            columns: [
                { name: 'original_id', type: 'string' }, // maps to SavedSprint.id
                { name: 'date', type: 'string' },
                { name: 'primary_task', type: 'string', isOptional: true },
                { name: 'duration_seconds', type: 'number' },
                { name: 'task_count', type: 'number' },
                { name: 'timeline_events', type: 'string', isOptional: true }, // JSON array string
            ]
        })
    ]
});
