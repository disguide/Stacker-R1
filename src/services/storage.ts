import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
    ACTIVE_TASKS: '@stacker_tasks_active',
    HISTORY: '@stacker_tasks_history_v1',
    SPRINT_TASKS: '@stacker_sprint_tasks_temp',
    TAGS: '@stacker_tags_v1',
    COLOR_LABELS: '@stacker_color_labels_v1',
    USER_PROFILE: '@stacker_user_profile_v1',
    USER_COLORS: '@stacker_user_colors_v1',
    SPRINT_SETTINGS: '@stacker_sprint_settings_v1', // New Key
    SAVED_SPRINTS: '@stacker_saved_sprints_v1',
    SPRINT_HISTORY: '@stacker_sprint_history_v1',
    MAIL: '@stacker_mail_v1',
    DAILY_DATA: '@stacker_daily_data_v1', // New Key
    UI_STATE: '@stacker_ui_state_v1', // New Key
};

export interface SprintSettings {
    showTimer: boolean;
    allowPause: boolean;
    defaultDuration?: number; // Minutes, optional
    autoBreakMode?: boolean;
    autoBreakWorkTime?: number;
    autoBreakDuration?: number;
    maxDurationEnabled?: boolean;
    maxDurationMinutes?: number;
    use24HourFormat?: boolean; // New: Persistent preference
}

export interface SavedSprint {
    id: string;
    date: string;
    durationSeconds: number;
    breakDurationSeconds?: number;
    totalDurationSeconds?: number;
    timelineEvents: any[];
    // New Metadata
    primaryTask?: string;
    taskCount?: number;
    note?: string;
    intensity?: number; // 0-100 score
    sortOrder?: number;
}

export type GoalCategory = 'traits' | 'habits' | 'environment' | 'outcomes';

export type GoalEventType = 'added' | 'achieved' | 'modified' | 'cancelled';

export interface GoalEvent {
    id: string;
    type: GoalEventType;
    date: string;
}

export interface GoalItem {
    id: string;
    title: string;
    completed: boolean;
    createdAt?: string;
    completedAt?: string;
    category?: GoalCategory;
    color?: string;
    cancelled?: boolean;
    cancelledAt?: string;
    events?: GoalEvent[];
    note?: string;
}

export interface MailMessage {
    id: string;
    subject: string;
    sender: string;
    date: string; // ISO String
    preview: string;
    body: string;
    read: boolean;
    trashed?: boolean;
    trashedAt?: string;
}

export interface UserProfile {
    name: string;
    handle: string;
    avatar?: string; // URL or local path
    banner?: string; // URL or Hex color
    bio?: string;
    goals?: GoalItem[];
    antigoals?: GoalItem[];
    identity?: {
        anti: {
            head?: string;  // Traits
            torso?: string; // Environment
            arms?: string;  // Habits
            legs?: string;  // Outcomes
        };
        hero: {
            head?: string;
            torso?: string;
            arms?: string;
            legs?: string;
        };
    };
}

export type ColorLabelMap = Record<string, string>; // Color Hex -> Label

export interface ColorDefinition {
    id: string;
    color: string; // Hex
    label: string;
}

// Red, Orange, Amber, Emerald, Blue, Violet
export const TASK_COLORS = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
export const TASK_COLOR_LABELS = ['Urgent', 'High', 'Medium', 'Low', 'Work', 'Personal'];

// Task and Recurrence types — single source of truth is features/tasks/types.ts
// Re-exported here so existing imports from this file continue to work.
import { Task, RecurrenceRule, RecurrenceFrequency, WeekDay } from '../features/tasks/types';
export { Task, RecurrenceRule, RecurrenceFrequency, WeekDay };

export interface TagDefinition {
    id: string;
    label: string;
    color: string;
    symbol: string; // Emoji
}

export interface DailyData {
    date: string; // ISO Date YYYY-MM-DD
    rating?: number;
    reflection?: string;
    updatedAt: string;
    isStarred?: boolean;
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

                if (!t) return false;
                const isGhostId = /_(\d{4}-\d{2}-\d{2})$/.test(t.id);
                if (isGhostId) {
                    if (__DEV__) console.log('Sanitizing storage: Removing ghost task', t.id);
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

    async loadUIState() {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEYS.UI_STATE);
            if (__DEV__) console.log('[StorageService] Loaded UI State:', data);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Failed to load UI state', e);
            return null;
        }
    },

    async saveUIState(state: any) {
        try {
            const current = await this.loadUIState() || {};
            const next = { ...current, ...state };
            if (__DEV__) console.log('[StorageService] Saving UI State:', next);
            await AsyncStorage.setItem(STORAGE_KEYS.UI_STATE, JSON.stringify(next));
        } catch (e) {
            console.error('Failed to save UI state', e);
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
    },

    // SPRINT SETTINGS
    async loadSprintSettings(): Promise<SprintSettings> {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEYS.SPRINT_SETTINGS);
            if (data) return JSON.parse(data);
            return {
                showTimer: true,
                allowPause: true,
                autoBreakMode: false,
                autoBreakWorkTime: 25,
                autoBreakDuration: 5,
                maxDurationEnabled: false,
                maxDurationMinutes: 60
            };
        } catch (error) {
            console.error('Error loading sprint settings:', error);
            return { 
                showTimer: true, 
                allowPause: true,
                maxDurationEnabled: false,
                maxDurationMinutes: 60
            };
        }
    },

    async saveSprintSettings(settings: SprintSettings) {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.SPRINT_SETTINGS, JSON.stringify(settings));
        } catch (e) {
            console.error('Failed to save sprint settings', e);
        }
    },

    // SAVED SPRINTS
    async loadSavedSprints(): Promise<SavedSprint[]> {
        try {
            const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_SPRINTS);
            return jsonValue != null ? JSON.parse(jsonValue) : [];
        } catch (e) {
            console.error('Failed to load saved sprints', e);
            return [];
        }
    },

    async saveSavedSprint(sprint: SavedSprint) {
        try {
            const currentSprints = await this.loadSavedSprints();
            const updatedSprints = [sprint, ...currentSprints];
            await AsyncStorage.setItem(STORAGE_KEYS.SAVED_SPRINTS, JSON.stringify(updatedSprints));
        } catch (e) {
            console.error('Failed to save saved sprint', e);
        }
    },

    async updateSavedSprints(sprints: SavedSprint[]) {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.SAVED_SPRINTS, JSON.stringify(sprints));
        } catch (e) {
            console.error('Failed to update saved sprints array', e);
        }
    },

    async deleteSavedSprint(sprintId: string) {
        try {
            const currentSprints = await this.loadSavedSprints();
            const updated = currentSprints.filter(s => s.id !== sprintId);
            await AsyncStorage.setItem(STORAGE_KEYS.SAVED_SPRINTS, JSON.stringify(updated));
        } catch (e) {
            console.error('Failed to delete saved sprint', e);
        }
    },

    // SPRINT HISTORY (All sessions)
    async loadSprintHistory(): Promise<SavedSprint[]> {
        try {
            const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.SPRINT_HISTORY);
            return jsonValue != null ? JSON.parse(jsonValue) : [];
        } catch (e) {
            console.error('Failed to load sprint history', e);
            return [];
        }
    },

    async addToSprintHistory(sprint: SavedSprint) {
        try {
            const currentHistory = await this.loadSprintHistory();
            const updatedHistory = [sprint, ...currentHistory];
            await AsyncStorage.setItem(STORAGE_KEYS.SPRINT_HISTORY, JSON.stringify(updatedHistory));
        } catch (e) {
            console.error('Failed to add to sprint history', e);
        }
    },

    async deleteSprintHistory(sprintId: string) {
        try {
            const currentHistory = await this.loadSprintHistory();
            const updated = currentHistory.filter(s => s.id !== sprintId);
            await AsyncStorage.setItem(STORAGE_KEYS.SPRINT_HISTORY, JSON.stringify(updated));
        } catch (e) {
            console.error('Failed to delete from sprint history', e);
        }
    },

    async updateSprintHistory(history: SavedSprint[]) {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.SPRINT_HISTORY, JSON.stringify(history));
        } catch (e) {
            console.error('Failed to update sprint history array', e);
        }
    },

    // --- Daily Data (Journal V2) --- //
    async loadDailyData(date: string): Promise<DailyData | null> {
        try {
            const jsonValue = await AsyncStorage.getItem(`${STORAGE_KEYS.DAILY_DATA}_${date}`);
            return jsonValue != null ? JSON.parse(jsonValue) : null;
        } catch (e) {
            console.error('Failed to load daily data', e);
            return null;
        }
    },

    async saveDailyData(date: string, data: DailyData) {
        try {
            await AsyncStorage.setItem(`${STORAGE_KEYS.DAILY_DATA}_${date}`, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save daily data', e);
        }
    },

    async loadAllDailyData(): Promise<DailyData[]> {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const dailyKeys = keys.filter(k => k.startsWith(STORAGE_KEYS.DAILY_DATA));
            const pairs = await AsyncStorage.multiGet(dailyKeys);
            return pairs
                .map(([_, value]) => value ? JSON.parse(value) : null)
                .filter(v => v !== null);
        } catch (e) {
            console.error('Failed to load all daily data', e);
            return [];
        }
    },

    // --- Mail Storage --- //
    async loadMail(): Promise<MailMessage[]> {
        try {
            const raw = await AsyncStorage.getItem(STORAGE_KEYS.MAIL);
            if (!raw) {
                return [];
            }
            return JSON.parse(raw);
        } catch (e) {
            console.error('[Storage] Error loading mail', e);
            return [];
        }
    },

    async saveMail(messages: MailMessage[]): Promise<void> {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.MAIL, JSON.stringify(messages));
        } catch (e) {
            console.error('[Storage] Error saving mail', e);
        }
    },

    async autoDisposeOldData() {
        try {
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            
            // 1. Dispose old DailyData
            const keys = await AsyncStorage.getAllKeys();
            const dailyKeys = keys.filter(k => k.startsWith(STORAGE_KEYS.DAILY_DATA + '_'));
            const keysToRemove: string[] = [];
            
            const pairs = await AsyncStorage.multiGet(dailyKeys);
            pairs.forEach(([key, value]) => {
                if (value) {
                    const data: DailyData = JSON.parse(value);
                    if (!data.isStarred && new Date(data.date) < oneYearAgo) {
                        keysToRemove.push(key);
                    }
                }
            });

            if (keysToRemove.length > 0) {
                await AsyncStorage.multiRemove(keysToRemove);
                console.log(`[Storage] Auto-disposed ${keysToRemove.length} old daily log entries.`);
            }
            
            // 2. Load all starred dates for exemption
            const starredDates = new Set<string>();
            const remainingDaily = await this.loadAllDailyData(); 
            remainingDaily.forEach(d => {
                if (d.isStarred) starredDates.add(d.date);
            });
            
            // 3. Dispose old sprints
            let sprintHistory = await this.loadSprintHistory();
            const originalSprintCount = sprintHistory.length;
            sprintHistory = sprintHistory.filter(s => {
                const sDate = new Date(s.date);
                if (sDate >= oneYearAgo) return true; // Keep recent
                const [y, m, d] = s.date.split('-').map(Number);
                const dateStr = new Date(y, m - 1, d).toISOString().split('T')[0];
                return starredDates.has(dateStr); // Keep if day is starred
            });
            if (sprintHistory.length < originalSprintCount) {
                await this.updateSprintHistory(sprintHistory);
            }
            
            // 4. Dispose old task history
            let taskHistory = await this.loadHistory();
            const originalTaskCount = taskHistory.length;
            taskHistory = taskHistory.filter(t => {
                const tDateStr = t.completedAt ? t.completedAt.split('T')[0] : t.date;
                const tDate = new Date(tDateStr);
                if (tDate >= oneYearAgo) return true; // Keep recent
                return starredDates.has(tDateStr); // Keep if day is starred
            });
            if (taskHistory.length < originalTaskCount) {
                await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(taskHistory));
            }

        } catch (e) {
            console.error('[Storage] Failed to auto-dispose old data', e);
        }
    },

    async clearAllData() {
        try {
            const keys = Object.values(STORAGE_KEYS);
            await AsyncStorage.multiRemove(keys);
            this._userColorsCache = null;
        } catch (e) {
            console.error('Failed to clear all data', e);
        }
    }
};
