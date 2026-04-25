import { 
    Task as CoreTask, 
    TaskType, 
    RecurrenceFrequency, 
    WeekDay, 
    RecurrenceConfig as RecurrenceRule 
} from '../../core/types';

export interface Task extends CoreTask {
    // Identity - Inherited
    
    // Feature-Specific UI Fields
    reminderOffset?: number; // Days offset for reminder calculation
    instanceProgress?: Record<string, number>;
    instanceSubtasks?: Record<string, Subtask[]>;
    instanceSortOrders?: Record<string, number>;

    // Sprint Extraction Tracking
    sprintParentId?: string;
    sprintSubtaskId?: string;

    // Archival Metadata
    completedAt?: number;
}

export { RecurrenceFrequency, WeekDay, RecurrenceRule };

export interface Subtask {
    id: string;
    title: string;
    isCompleted: boolean;
    deadline?: string;
    estimatedTime?: string;
    progress?: number;
}

// The UI object (Projected)
export interface CalendarItem {
    id: string; // Unique UI ID (e.g., "gym_master_2026-01-29")
    originalTaskId: string; // Points to the Master Task ID
    title: string;
    date: string; // YYYY-MM-DD
    isGhost: boolean; // True if projected from rrule, False if real single task
    isCompleted: boolean;
    type: 'task' | 'header';

    // UI helpers passed from Master
    deadline?: string;
    estimatedTime?: string;
    subtasks?: Subtask[];
    progress?: number;
    rrule?: string; // Pass through for recurrence indicator
    recurrence?: RecurrenceRule; // UI Object
    tagIds?: string[];

    // Design System
    color?: string;
    // Overriding type to include original specific types
    taskType?: 'task' | 'event' | 'work' | 'chore' | 'habit';
    daysRolled?: number;
    originalDate?: string;
    importance?: number;
    reminderEnabled?: boolean;
    reminderDate?: string; // YYYY-MM-DD
    reminderTime?: string;
    sortOrder?: number;
}
