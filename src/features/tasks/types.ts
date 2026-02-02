export interface Task {
    id: string; // Unique ID (UUID)
    title: string;
    date: string; // Start Date YYYY-MM-DD

    // Recurrence Fields (Optional - only for Master Tasks)
    rrule?: string; // e.g. "FREQ=DAILY;COUNT=90"
    completedDates?: string[]; // Array of ISO Date Strings ["2026-01-29", ...]
    exceptionDates?: string[]; // Array of ISO Date Strings ["2026-02-05"] (Deleted days)

    // Legacy/Optional fields we might still need for UI
    deadline?: string;
    estimatedTime?: string;
    reminderTime?: string; // HH:mm format for notification time
    subtasks?: Subtask[];
    progress?: number;
    completed?: boolean; // For single tasks
    tagIds?: string[];
    instanceProgress?: Record<string, number>;
    instanceSubtasks?: Record<string, Subtask[]>;
}

export interface Subtask {
    id: string;
    title: string;
    completed: boolean;
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
    tagIds?: string[];
}
