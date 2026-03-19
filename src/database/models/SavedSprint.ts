import { Model } from '@nozbe/watermelondb';
import { field, json } from '@nozbe/watermelondb/decorators';

const sanitizeJson = (raw: any) => raw;

export class SavedSprintModel extends Model {
    static table = 'saved_sprints';

    @field('original_id') originalId!: string;
    @field('date') date!: string;
    @field('primary_task') primaryTask?: string;
    @field('duration_seconds') durationSeconds!: number;
    @field('task_count') taskCount!: number;
    @json('timeline_events', sanitizeJson) timelineEvents?: any[];
}
