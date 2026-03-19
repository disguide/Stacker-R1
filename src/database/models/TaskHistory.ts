import { Model } from '@nozbe/watermelondb';
import { field, json } from '@nozbe/watermelondb/decorators';

const sanitizeJson = (raw: any) => raw;

export class TaskHistoryModel extends Model {
    static table = 'task_history';

    @field('original_id') originalId!: string;
    @field('title') title!: string;
    @field('type') type!: 'task' | 'event' | 'work' | 'chore' | 'habit';
    @field('completed') completed!: boolean;
    @field('is_completed') isCompleted!: boolean;
    @field('completed_at') completedAt?: string;
    @field('created_at') createdAt!: string;
    @field('tag_id') tagId?: string;
    @field('color_id') colorId?: string;
    @field('note') note?: string;
    @field('recurrence_rule') recurrenceRule?: string;
    @json('completed_dates', sanitizeJson) completedDates?: string[];
    @json('events', sanitizeJson) events?: any[];
    @field('due_date') dueDate?: string;
    @field('date') date!: string;
}
