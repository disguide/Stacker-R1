import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './storage.types';
import { triggerSync } from './SyncService';
import { Task as CoreTask, DailyData } from '../core/types';
import { toISODateString } from '../utils/dateHelpers';
import { TaskRepository } from './storage/TaskRepository';
export { DailyData };

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
    language?: string;
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
    updated_at?: number;
    deleted_at?: number;
}

export type GoalCategory = 'traits' | 'habits' | 'environment' | 'outcomes';

export type GoalEventType = 'added' | 'achieved' | 'modified' | 'cancelled';

export interface GoalEvent {
    id: string;
    type: GoalEventType;
    date: number;
}

export interface GoalItem {
    id: string;
    title: string;
    isCompleted: boolean;
    created_at?: number;
    completedAt?: number;
    category?: GoalCategory;
    color?: string;
    cancelled?: boolean;
    cancelledAt?: number;
    events?: GoalEvent[];
    note?: string;
    targetCount?: number;
    currentCount?: number;
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
    updated_at?: number;
}

export type ColorLabelMap = Record<string, string>; // Color Hex -> Label

export interface ColorDefinition {
    id: string;
    color: string; // Hex
    label: string;
    keywords?: string[]; // Auto-color trigger words
}

export interface ColorSettings {
    // Reserved for future keyword/detection settings
}

// Red, Orange, Amber, Emerald, Blue, Violet
export const TASK_COLORS = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
export const TASK_COLOR_LABELS = ['Urgent', 'High', 'Medium', 'Low', 'Work', 'Personal'];

// Task and Recurrence types — single source of truth is core/types.ts
import { Task, RecurrenceRule, RecurrenceFrequency, WeekDay } from '../features/tasks/types';
export { Task, RecurrenceRule, RecurrenceFrequency, WeekDay };

export interface TagDefinition {
    id: string;
    label: string;
    color: string;
    symbol: string; // Emoji
}

export interface ActionLog {
    id: string;
    action: string;
    timestamp: number;
    metadata?: any;
    updated_at?: number;
    deleted_at?: number;
    _isDirty?: boolean;
}

// (DailyData is now imported from core types)


export const StorageService = {
    // ACTIVE TASKS
    async loadActiveTasks(): Promise<Task[]> {
        try {
            const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_TASKS);
            let tasks: Task[] = jsonValue != null ? JSON.parse(jsonValue) : [];

            // Filter out soft-deleted tasks
            tasks = tasks.filter(t => !t.deleted_at);

            const originalLength = tasks.length;
            tasks = tasks.filter(t => {
                if (t.rrule) return true;
                if (!t) return false;
                const isGhostId = /_(\d{4}-\d{2}-\d{2})$/.test(t.id);
                if (isGhostId) {
                    if (__DEV__) console.log('Sanitizing storage: Removing ghost task', t.id);
                    return false;
                }
                return true;
            });

            if (tasks.length !== originalLength) {
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
            await TaskRepository.saveAll(tasks);
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
            if (__DEV__) console.log('[StorageService] Saving UI State:', state);
            await AsyncStorage.setItem(STORAGE_KEYS.UI_STATE, JSON.stringify(state));
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
            const history: Task[] = jsonValue != null ? JSON.parse(jsonValue) : [];
            return history.filter(t => !t.deleted_at);
        } catch (e) {
            console.error('Failed to load history', e);
            return [];
        }
    },

    async addToHistory(task: Task) {
        try {
            await TaskRepository.archive(task);
        } catch (e) {
            console.error('Failed to add to history', e);
        }
    },

    async removeFromHistory(taskId: string): Promise<Task | null> {
        try {
            const currentHistory = await this.loadHistory();
            const task = currentHistory.find(t => t.id === taskId);

            if (task) {
                const rawJson = await AsyncStorage.getItem(STORAGE_KEYS.HISTORY);
                const allHistory: Task[] = rawJson ? JSON.parse(rawJson) : [];
                const timestamp = Date.now();
                
                // Soft delete from history because it's being "moved" (restored) to Active
                const updatedHistory = allHistory.map(t => 
                    t.id === taskId ? { ...t, deleted_at: timestamp, updated_at: timestamp, _isDirty: true } : t
                );
                await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updatedHistory));
                triggerSync();
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
            const rawJson = await AsyncStorage.getItem(STORAGE_KEYS.HISTORY);
            const allHistory: Task[] = rawJson ? JSON.parse(rawJson) : [];
            const timestamp = Date.now();
            const updated = allHistory.map(t => 
                t.id === taskId ? { ...t, deleted_at: timestamp, updated_at: timestamp, _isDirty: true } : t
            );
            await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updated));
            triggerSync();
        } catch (e) {
            console.error('Failed to delete from history', e);
        }
    },

    // --- INTERNAL SINGLETON HELPERS ---
    _wrapSingleton<T>(data: T) {
        return JSON.stringify({
            data,
            updated_at: Date.now(),
            _isDirty: true
        });
    },

    _unwrapSingleton<T>(json: string | null, defaultValue: T): T {
        if (!json) return defaultValue;
        try {
            const parsed = JSON.parse(json);
            if (parsed && parsed.data !== undefined) return parsed.data;
            // Legacy fallbacks: Support old specific keys or pure objects
            return parsed.items || parsed.colors || parsed.messages || parsed.settings || parsed.labels || parsed || defaultValue;
        } catch {
            return defaultValue;
        }
    },

    // TAGS
    async loadTags(): Promise<TagDefinition[]> {
        try {
            const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.TAGS);
            return this._unwrapSingleton<TagDefinition[]>(jsonValue, []);
        } catch (e) {
            console.error('Failed to load tags', e);
            return [];
        }
    },

    async saveTags(tags: TagDefinition[]) {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.TAGS, this._wrapSingleton(tags));
            triggerSync();
        } catch (e) {
            console.error('Failed to save tags', e);
        }
    },

    // COLOR LABELS
    async loadColorLabels(): Promise<ColorLabelMap> {
        try {
            const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.COLOR_LABELS);
            return this._unwrapSingleton<ColorLabelMap>(jsonValue, {});
        } catch (e) {
            console.error('Failed to load color labels', e);
            return {};
        }
    },

    async saveColorLabels(labels: ColorLabelMap) {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.COLOR_LABELS, this._wrapSingleton(labels));
            triggerSync();
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
            const colors = this._unwrapSingleton<ColorDefinition[]>(jsonValue, []);
            
            if (colors.length > 0) {
                this._userColorsCache = colors;
                return colors;
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
            await AsyncStorage.setItem(STORAGE_KEYS.USER_COLORS, this._wrapSingleton(colors));
            triggerSync();
        } catch (e) {
            console.error('Failed to save user colors', e);
        }
    },

    // COLOR SETTINGS (Auto-color preferences)
    async loadColorSettings(): Promise<ColorSettings> {
        try {
            const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.COLOR_SETTINGS);
            return this._unwrapSingleton<ColorSettings>(jsonValue, {});
        } catch (e) {
            console.error('Failed to load color settings', e);
            return {};
        }
    },

    async saveColorSettings(settings: ColorSettings) {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.COLOR_SETTINGS, this._wrapSingleton(settings));
            triggerSync();
        } catch (e) {
            console.error('Failed to save color settings', e);
        }
    },

    // USER PROFILE
    async loadProfile(): Promise<UserProfile | null> {
        try {
            const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
            return this._unwrapSingleton<UserProfile | null>(jsonValue, null);
        } catch (e) {
            console.error('Failed to load profile', e);
            return null;
        }
    },

    async saveProfile(profile: UserProfile) {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, this._wrapSingleton(profile));
            triggerSync();
        } catch (e) {
            console.error('Failed to save profile', e);
        }
    },

    // SPRINT SETTINGS
    async loadSprintSettings(): Promise<SprintSettings> {
        const defaults: SprintSettings = {
            showTimer: true,
            allowPause: true,
            language: 'en',
            autoBreakMode: false,
            autoBreakWorkTime: 25,
            autoBreakDuration: 5,
            maxDurationEnabled: false,
            maxDurationMinutes: 60
        };
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEYS.SPRINT_SETTINGS);
            return this._unwrapSingleton<SprintSettings>(data, defaults);
        } catch (error) {
            console.error('Error loading sprint settings:', error);
            return defaults;
        }
    },

    async saveSprintSettings(settings: SprintSettings) {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.SPRINT_SETTINGS, this._wrapSingleton(settings));
            triggerSync();
        } catch (e) {
            console.error('Failed to save sprint settings', e);
        }
    },

    // SAVED SPRINTS
    async loadSavedSprints(): Promise<SavedSprint[]> {
        try {
            const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_SPRINTS);
            const sprints: SavedSprint[] = jsonValue != null ? JSON.parse(jsonValue) : [];
            return sprints.filter(s => !s.deleted_at);
        } catch (e) {
            console.error('Failed to load saved sprints', e);
            return [];
        }
    },

    async saveSavedSprint(sprint: SavedSprint) {
        try {
            const rawJson = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_SPRINTS);
            const allSprints: SavedSprint[] = rawJson ? JSON.parse(rawJson) : [];
            const timestamp = Date.now();
            
            // New record with sync flags
            const newSprint = { ...sprint, updated_at: timestamp, _isDirty: true };
            const updatedSprints = [newSprint, ...allSprints];
            
            await AsyncStorage.setItem(STORAGE_KEYS.SAVED_SPRINTS, JSON.stringify(updatedSprints));
            triggerSync();
        } catch (e) {
            console.error('Failed to save saved sprint', e);
        }
    },

    async updateSavedSprints(sprints: SavedSprint[]) {
        try {
            const timestamp = Date.now();
            // Since this is a bulk update (usually for reordering), we'll mark all modified ones as dirty.
            // For simplicity, we'll mark all as dirty to ensure sync.
            const updated = sprints.map(s => ({ ...s, updated_at: s.updated_at || timestamp, _isDirty: true }));
            await AsyncStorage.setItem(STORAGE_KEYS.SAVED_SPRINTS, JSON.stringify(updated));
            triggerSync();
        } catch (e) {
            console.error('Failed to update saved sprints array', e);
        }
    },

    async deleteSavedSprint(sprintId: string) {
        try {
            const rawJson = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_SPRINTS);
            const allSprints: SavedSprint[] = rawJson ? JSON.parse(rawJson) : [];
            const timestamp = Date.now();
            const updated = allSprints.map(s => 
                s.id === sprintId ? { ...s, deleted_at: timestamp, updated_at: timestamp, _isDirty: true } : s
            );
            await AsyncStorage.setItem(STORAGE_KEYS.SAVED_SPRINTS, JSON.stringify(updated));
            triggerSync();
        } catch (e) {
            console.error('Failed to delete saved sprint', e);
        }
    },

    // SPRINT HISTORY (All sessions)
    async loadSprintHistory(): Promise<SavedSprint[]> {
        try {
            const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.SPRINT_HISTORY);
            const history: SavedSprint[] = jsonValue != null ? JSON.parse(jsonValue) : [];
            return history.filter(s => !s.deleted_at);
        } catch (e) {
            console.error('Failed to load sprint history', e);
            return [];
        }
    },

    async addToSprintHistory(sprint: SavedSprint) {
        try {
            const rawJson = await AsyncStorage.getItem(STORAGE_KEYS.SPRINT_HISTORY);
            const allHistory: SavedSprint[] = rawJson ? JSON.parse(rawJson) : [];
            const timestamp = Date.now();
            
            const newEntry = { ...sprint, updated_at: timestamp, _isDirty: true };
            const updatedHistory = [newEntry, ...allHistory];
            
            await AsyncStorage.setItem(STORAGE_KEYS.SPRINT_HISTORY, JSON.stringify(updatedHistory));
            triggerSync();
        } catch (e) {
            console.error('Failed to add to sprint history', e);
        }
    },

    async deleteSprintHistory(sprintId: string) {
        try {
            const rawJson = await AsyncStorage.getItem(STORAGE_KEYS.SPRINT_HISTORY);
            const allHistory: SavedSprint[] = rawJson ? JSON.parse(rawJson) : [];
            const timestamp = Date.now();
            const updated = allHistory.map(s => 
                s.id === sprintId ? { ...s, deleted_at: timestamp, updated_at: timestamp, _isDirty: true } : s
            );
            await AsyncStorage.setItem(STORAGE_KEYS.SPRINT_HISTORY, JSON.stringify(updated));
            triggerSync();
        } catch (e) {
            console.error('Failed to delete from sprint history', e);
        }
    },

    async updateSprintHistory(history: SavedSprint[]) {
        try {
            const timestamp = Date.now();
            const updated = history.map(s => ({ ...s, updated_at: s.updated_at || timestamp, _isDirty: true }));
            await AsyncStorage.setItem(STORAGE_KEYS.SPRINT_HISTORY, JSON.stringify(updated));
            triggerSync();
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
            const updated = { ...data, updated_at: Date.now(), _isDirty: true };
            await AsyncStorage.setItem(`${STORAGE_KEYS.DAILY_DATA}_${date}`, JSON.stringify(updated));
            triggerSync();
        } catch (e) {
            console.error('Failed to save daily data', e);
        }
    },

    async loadAllDailyData(): Promise<DailyData[]> {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const dailyKeys = keys.filter(k => k.startsWith(STORAGE_KEYS.DAILY_DATA + '_'));
            const pairs = await AsyncStorage.multiGet(dailyKeys);
            return pairs
                .map(([_, value]) => value ? JSON.parse(value) : null)
                .filter(v => v !== null && !v.deleted_at);
        } catch (e) {
            console.error('Failed to load all daily data', e);
            return [];
        }
    },

    // --- Mail Storage --- //
    async loadMail(): Promise<MailMessage[]> {
        try {
            const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.MAIL);
            const messages = this._unwrapSingleton<MailMessage[]>(jsonValue, []);
            if (!Array.isArray(messages)) return []; // Guard against non-array data
            return messages.filter(m => !m.trashed); // Filter out trashed/deleted mail
        } catch (e) {
            console.error('[Storage] Error loading mail', e);
            return [];
        }
    },

    async saveMail(messages: MailMessage[]) {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.MAIL, this._wrapSingleton(messages));
            triggerSync();
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
                const completedAt = t.completedAt;
                const tDateStr = completedAt ? toISODateString(new Date(completedAt)) : t.date;
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
    },

    // --- ACTION LOGS ---
    async addActionLog(log: Omit<ActionLog, 'id' | 'updated_at' | '_isDirty'>) {
        try {
            const rawJson = await AsyncStorage.getItem(STORAGE_KEYS.ACTION_LOGS);
            const allLogs: ActionLog[] = rawJson ? JSON.parse(rawJson) : [];
            const timestamp = Date.now();
            
            const newEntry: ActionLog = {
                ...log,
                id: Math.random().toString(36).substring(7),
                updated_at: timestamp,
                _isDirty: true
            };
            
            // Limit logs to last 500 locally to prevent overflow
            const updated = [newEntry, ...allLogs].slice(0, 500);
            await AsyncStorage.setItem(STORAGE_KEYS.ACTION_LOGS, JSON.stringify(updated));
            triggerSync();
        } catch (e) {
            console.error('Failed to add action log', e);
        }
    },

    async loadActionLogs(): Promise<ActionLog[]> {
        try {
            const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.ACTION_LOGS);
            const logs: ActionLog[] = jsonValue != null ? JSON.parse(jsonValue) : [];
            return logs.filter(l => !l.deleted_at);
        } catch (e) {
            console.error('Failed to load action logs', e);
            return [];
        }
    },

    async clearActionLogs() {
        try {
            const rawJson = await AsyncStorage.getItem(STORAGE_KEYS.ACTION_LOGS);
            const allLogs: ActionLog[] = rawJson ? JSON.parse(rawJson) : [];
            const timestamp = Date.now();
            
            // Soft delete all to propagate to cloud
            const updated = allLogs.map(l => ({ ...l, deleted_at: timestamp, updated_at: timestamp, _isDirty: true }));
            await AsyncStorage.setItem(STORAGE_KEYS.ACTION_LOGS, JSON.stringify(updated));
            triggerSync();
        } catch (e) {
            console.error('Failed to clear action logs', e);
        }
    }
};
