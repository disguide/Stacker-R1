import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
    ACTIVE_TASKS: '@stacker_tasks_active',
    HISTORY: '@stacker_tasks_history_v1',
    SPRINT_TASKS: '@stacker_sprint_tasks_temp',
    TAGS: '@stacker_tags_v1',
    COLOR_LABELS: '@stacker_color_labels_v1',
    USER_PROFILE: '@stacker_user_profile_v1',
    USER_COLORS: '@stacker_user_colors_v1', // New Key
};

export interface UserProfile {
    name: string;
    handle: string;
    avatar?: string; // URL or local path
    banner?: string; // URL or Hex color
    bio?: string;
    goals?: string[]; // Array of strings
}

export type ColorLabelMap = Record<string, string>; // Color Hex -> Label

export interface ColorDefinition {
    id: string;
    color: string; // Hex
    label: string;
}

// Red, Orange, Amber, Emerald, Blue, Violet, Pink
export const TASK_COLORS = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];

export interface Task {
    id: string;
    title: string;
    completed?: boolean;
    date: string;
    originalDate?: string;
    deadline?: string;
    estimatedTime?: string;
    progress?: number; // 0 to 100
    subtasks?: { id: string; title: string; completed: boolean; }[];
    recurrence?: RecurrenceRule;
    originalTaskId?: string;
    seriesId?: string;
    rrule?: string;
    completedDates?: string[];
    exceptionDates?: string[];
    tagIds?: string[]; // New: Array of tag IDs
    instanceProgress?: Record<string, number>; // Map of date -> progress (0-100) for recurring instances
    instanceSubtasks?: Record<string, { id: string; title: string; completed: boolean; }[]>; // Map of date -> subtasks

    // Design System (User customizable)
    color?: string; // Hex color for stripe
    type?: 'task' | 'event' | 'work' | 'chore' | 'habit';
}

export interface TagDefinition {
    id: string;
    label: string;
    color: string;
    symbol: string; // Emoji
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type WeekDay = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

export interface RecurrenceRule {
    frequency: RecurrenceFrequency;
    interval: number; // e.g., 1 for every week, 2 for every other week
    daysOfWeek?: WeekDay[]; // for weekly specific days
    endDate?: string; // ISO date string
    occurrenceCount?: number; // end after X times
}

export const StorageService = {
    // ACTIVE TASKS
    async loadActiveTasks(): Promise<Task[]> {
        try {
            const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_TASKS);
            let tasks: Task[] = jsonValue != null ? JSON.parse(jsonValue) : [];

            // CLEANUP: Remove accidentally saved "Ghost" instances (Projected tasks).
            // A genuine task id is simple UUID. A Ghost ID is "UUID_YYYY-MM-DD".
            // Only "Detached" tasks (exceptions) should remain, and they should have new unique IDs.
            // If we find an ID that looks like "ID_Date" AND doesn't have its own unique properties distinct from master...
            // Safest heuristic: If it has an originalTaskId that matches the prefix of its ID?
            // Actually, we shouldn't save ghosts ever.
            // Filter out any task where ID contains "_" followed by a date pattern, UNLESS it's explicitly marked as a "detach" (which we handle by giving new IDs in useTaskActions).

            const originalLength = tasks.length;
            tasks = tasks.filter(t => {
                // Check if ID looks like "uuid_2024-01-01"
                // And check if it's NOT a master (masters might use UUIDs? No, usually generated).
                // Actually, if it has `rrule`, it's a master. Keep it.
                if (t.rrule) return true;

                // If it's a simple task (no rrule), check ID.
                // If ID matches ".*_\d{4}-\d{2}-\d{2}$" it MIGHT be a ghost.
                // But detached tasks might use that format?
                // In `useTaskActions`, detached tasks get `${masterTask.id}_detach_${Date.now()}`.
                // So "UUID_YYYY-MM-DD" is definitely a temporary ghost ID.

                const isGhostId = /_(\d{4}-\d{2}-\d{2})$/.test(t.id);
                if (isGhostId) {
                    console.log('Sanitizing storage: Removing ghost task', t.id);
                    return false;
                }
                return true;
            });

            if (tasks.length !== originalLength) {
                // Save the cleaned list back to storage execution
                await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_TASKS, JSON.stringify(tasks));
            }

            return tasks;
        } catch (e) {
            console.error('Failed to load active tasks', e);
            return [];
        }
    },

    async saveActiveTasks(tasks: Task[]) {
        try {
            const jsonValue = JSON.stringify(tasks);
            await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_TASKS, jsonValue);
        } catch (e) {
            console.error('Failed to save active tasks', e);
        }
    },

    // SPRINT TASKS (Temporary)
    async saveSprintTasks(tasks: Task[]) {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.SPRINT_TASKS, JSON.stringify(tasks));
        } catch (e) {
            console.error('Failed to save sprint tasks', e);
        }
    },

    async loadSprintTasks(): Promise<Task[]> {
        try {
            const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.SPRINT_TASKS);
            return jsonValue != null ? JSON.parse(jsonValue) : [];
        } catch (e) {
            console.error('Failed to load sprint tasks', e);
            return [];
        }
    },

    // HISTORY
    async loadHistory(): Promise<Task[]> {
        try {
            const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.HISTORY);
            return jsonValue != null ? JSON.parse(jsonValue) : [];
        } catch (e) {
            console.error('Failed to load history', e);
            return [];
        }
    },

    async addToHistory(task: Task) {
        try {
            const currentHistory = await this.loadHistory();
            // Add to start of array
            const updatedHistory = [task, ...currentHistory];
            await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updatedHistory));
        } catch (e) {
            console.error('Failed to add to history', e);
        }
    },

    async removeFromHistory(taskId: string): Promise<Task | null> {
        try {
            const currentHistory = await this.loadHistory();
            const task = currentHistory.find(t => t.id === taskId);

            if (task) {
                const updatedHistory = currentHistory.filter(t => t.id !== taskId);
                await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updatedHistory));
                return task;
            }
            return null;
        } catch (e) {
            console.error('Failed to restore from history', e);
            return null;
        }
    },

    async deleteFromHistory(taskId: string) {
        try {
            const currentHistory = await this.loadHistory();
            const updatedHistory = currentHistory.filter(t => t.id !== taskId);
            await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updatedHistory));
        } catch (e) {
            console.error('Failed to delete from history', e);
        }
    },

    // TAGS
    async loadTags(): Promise<TagDefinition[]> {
        try {
            const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.TAGS);
            return jsonValue != null ? JSON.parse(jsonValue) : [];
        } catch (e) {
            console.error('Failed to load tags', e);
            return [];
        }
    },

    async saveTags(tags: TagDefinition[]) {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(tags));
        } catch (e) {
            console.error('Failed to save tags', e);
        }
    },

    // COLOR LABELS
    async loadColorLabels(): Promise<ColorLabelMap> {
        try {
            const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.COLOR_LABELS);
            return jsonValue != null ? JSON.parse(jsonValue) : {};
        } catch (e) {
            console.error('Failed to load color labels', e);
            return {};
        }
    },

    async saveColorLabels(labels: ColorLabelMap) {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.COLOR_LABELS, JSON.stringify(labels));
        } catch (e) {
            console.error('Failed to save color labels', e);
        }
    },

    // DYNAMIC USER COLORS
    _userColorsCache: null as ColorDefinition[] | null,

    getDefaultUserColors(): ColorDefinition[] {
        return TASK_COLORS.map((color, index) => ({
            id: `default_${index}`, // Stable ID
            color: color,
            label: ''
        }));
    },

    async loadUserColors(): Promise<ColorDefinition[]> {
        // Return cache if available to prevent read-after-write race conditions
        if (this._userColorsCache) {
            return this._userColorsCache;
        }

        try {
            const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.USER_COLORS);
            if (jsonValue != null) {
                const colors = JSON.parse(jsonValue);
                if (colors.length > 0) {
                    this._userColorsCache = colors;
                    return colors;
                }
            }

            // Default fallback
            const defaults = this.getDefaultUserColors();
            this._userColorsCache = defaults;
            await this.saveUserColors(defaults);
            return defaults;
        } catch (e) {
            console.error('Failed to load user colors', e);
            return this.getDefaultUserColors();
        }
    },

    async saveUserColors(colors: ColorDefinition[]) {
        try {
            this._userColorsCache = colors; // Update cache immediately
            await AsyncStorage.setItem(STORAGE_KEYS.USER_COLORS, JSON.stringify(colors));
        } catch (e) {
            console.error('Failed to save user colors', e);
        }
    },

    // USER PROFILE
    async loadProfile(): Promise<UserProfile | null> {
        try {
            const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
            return jsonValue != null ? JSON.parse(jsonValue) : null;
        } catch (e) {
            console.error('Failed to load profile', e);
            return null;
        }
    },

    async saveProfile(profile: UserProfile) {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
        } catch (e) {
            console.error('Failed to save profile', e);
        }
    }
};
