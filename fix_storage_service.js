const fs = require('fs');

const storageFilePath = 'src/services/storage.ts';
let code = fs.readFileSync(storageFilePath, 'utf8');

// The Task type doesn't have `isCompleted`, `createdAt`, `tagId`, `colorId`, `note`, `events`, `dueDate`
// It uses `tagIds` (array), `color` (string), `date` (string).

code = code.replace(/id: r.originalId,[\s\S]*?dueDate: r.dueDate,/g, `
                id: r.originalId,
                title: r.title,
                type: (r.type as any) || 'task',
                completed: r.completed || r.isCompleted,
                completedAt: r.completedAt,
                date: r.date || new Date().toISOString().split('T')[0],
                // Map the DB fields back to the Task type as best as possible
                tagIds: r.tagId ? [r.tagId] : [],
                color: r.colorId,
                rrule: r.recurrenceRule,
                completedDates: r.completedDates || []
`);

code = code.replace(/record.originalId = task.id;[\s\S]*?record.dueDate = task.dueDate;/g, `
                    record.originalId = task.id;
                    record.title = task.title;
                    record.type = task.type || 'task';
                    record.completed = task.completed || false;
                    record.isCompleted = task.completed || false;
                    record.completedAt = task.completedAt;
                    record.createdAt = new Date().toISOString();
                    record.date = task.date || new Date().toISOString().split('T')[0];
                    record.tagId = task.tagIds?.[0]; // Just save first tag for simplicity in flat schema
                    record.colorId = task.color;
                    record.recurrenceRule = task.rrule;
                    record.completedDates = task.completedDates;
`);

fs.writeFileSync(storageFilePath, code);
