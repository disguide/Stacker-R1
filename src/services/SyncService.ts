import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { STORAGE_KEYS } from './storage.types';

const SYNC_INTERVAL = 2000; // 2 seconds debounce
const LAST_SYNCED_AT_KEY = '@stacker_last_synced_at';

/**
 * SyncEngine — Complete offline-first bidirectional sync with Supabase.
 *
 * Sync Types:
 *   'array'     → Each item gets its own row (tasks, sprints, journal entries)
 *   'singleton' → Entire data blob stored as one row per user (settings, config)
 *
 * Not synced (device-local only):
 *   - SPRINT_TASKS  → Temporary in-flight sprint data
 *   - UI_STATE      → Device-specific UI preferences
 */

interface SyncMapping {
    key: string;           // AsyncStorage key
    table: string;         // Supabase table name
    type: 'array' | 'singleton';
}

const SYNC_TABLES: SyncMapping[] = [
    // === ARRAY tables (one row per item) ===
    { key: STORAGE_KEYS.ACTIVE_TASKS,    table: 'tasks',           type: 'array' },
    { key: STORAGE_KEYS.HISTORY,         table: 'task_history',    type: 'array' },
    { key: STORAGE_KEYS.SAVED_SPRINTS,   table: 'saved_sprints',   type: 'array' },
    { key: STORAGE_KEYS.SPRINT_HISTORY,  table: 'sprint_history',  type: 'array' },
    // Daily data is handled separately (per-date keys)
    
    // === SINGLETON tables (one row per user) ===
    { key: STORAGE_KEYS.USER_PROFILE,    table: 'profiles',        type: 'singleton' },
    { key: STORAGE_KEYS.SPRINT_SETTINGS, table: 'sprint_settings', type: 'singleton' },
    { key: STORAGE_KEYS.TAGS,            table: 'tags',            type: 'singleton' },
    { key: STORAGE_KEYS.COLOR_LABELS,    table: 'color_labels',    type: 'singleton' },
    { key: STORAGE_KEYS.USER_COLORS,     table: 'user_colors',     type: 'singleton' },
    { key: STORAGE_KEYS.MAIL,            table: 'mail',            type: 'singleton' },
];

class SyncEngine {
    private syncTimeout: NodeJS.Timeout | null = null;
    private isSyncing = false;

    /** Tables confirmed missing from Supabase — skip on future syncs */
    private missingTables = new Set<string>();

    triggerSync() {
        if (this.syncTimeout) clearTimeout(this.syncTimeout);
        this.syncTimeout = setTimeout(() => this.sync(), SYNC_INTERVAL);
    }

    async sync() {
        if (this.isSyncing) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return; // Guest mode — skip sync

        this.isSyncing = true;
        if (__DEV__) console.log('[SyncService] Starting sync...');

        try {
            const lastSyncedAtStr = await AsyncStorage.getItem(LAST_SYNCED_AT_KEY);
            const lastSyncedAt = lastSyncedAtStr ? parseInt(lastSyncedAtStr, 10) : 0;
            const now = Date.now();

            const activeTables = SYNC_TABLES.filter(t => !this.missingTables.has(t.table));

            // 1. Pull from Cloud
            await this.pullFromCloud(lastSyncedAt, session.user.id, activeTables);

            // 2. Pull daily_data (special per-date handling)
            await this.pullDailyData(lastSyncedAt, session.user.id);

            // 3. Push to Cloud
            await this.pushToCloud(lastSyncedAt, session.user.id, activeTables);

            // 4. Push daily_data
            await this.pushDailyData(lastSyncedAt, session.user.id);

            await AsyncStorage.setItem(LAST_SYNCED_AT_KEY, now.toString());
            if (__DEV__) console.log('[SyncService] Sync complete.');
        } catch (error) {
            if (__DEV__) console.warn('[SyncService] Sync failed:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    // ─── Helpers ──────────────────────────────────────────────

    /** PostgreSQL 42P01 = "relation does not exist" */
    private isTableMissing(error: any): boolean {
        if (!error) return false;
        const code = error.code || '';
        const msg = (error.message || '').toLowerCase();
        return code === '42P01' || (msg.includes('relation') && msg.includes('does not exist'));
    }

    private markMissing(table: string) {
        if (__DEV__) console.log(`[SyncService] Table "${table}" not found in Supabase — skipping.`);
        this.missingTables.add(table);
    }

    // ─── PULL ─────────────────────────────────────────────────

    private async pullFromCloud(lastSyncedAt: number, userId: string, tables: SyncMapping[]) {
        const lastSyncedAtISO = new Date(lastSyncedAt > 0 ? lastSyncedAt : 0).toISOString();

        for (const mapping of tables) {
            const { data, error } = await supabase
                .from(mapping.table)
                .select('*')
                .eq('user_id', userId)
                .gt('updated_at', lastSyncedAtISO);

            if (error) {
                if (this.isTableMissing(error)) this.markMissing(mapping.table);
                else if (__DEV__) console.warn(`[SyncService] Pull failed for ${mapping.table}:`, error.message);
                continue;
            }

            if (data && data.length > 0) {
                if (mapping.type === 'array') {
                    await this.mergeArrayRecords(mapping.key, data);
                } else {
                    await this.mergeSingletonRecord(mapping.key, data);
                }
            }
        }
    }

    private async pullDailyData(lastSyncedAt: number, userId: string) {
        if (this.missingTables.has('daily_data')) return;

        const lastSyncedAtISO = new Date(lastSyncedAt > 0 ? lastSyncedAt : 0).toISOString();
        const { data, error } = await supabase
            .from('daily_data')
            .select('*')
            .eq('user_id', userId)
            .gt('updated_at', lastSyncedAtISO);

        if (error) {
            if (this.isTableMissing(error)) this.markMissing('daily_data');
            else if (__DEV__) console.warn('[SyncService] Pull failed for daily_data:', error.message);
            return;
        }

        if (data && data.length > 0) {
            for (const record of data) {
                const dateKey = `${STORAGE_KEYS.DAILY_DATA}_${record.id}`; // id = date string
                if (record.deleted_at) {
                    await AsyncStorage.removeItem(dateKey);
                } else if (record.data) {
                    await AsyncStorage.setItem(dateKey, JSON.stringify(record.data));
                }
            }
        }
    }

    // ─── MERGE ────────────────────────────────────────────────

    /** Merge array-type cloud records into local AsyncStorage */
    private async mergeArrayRecords(storageKey: string, records: any[]) {
        const localStr = await AsyncStorage.getItem(storageKey);
        const localData: any[] = localStr ? JSON.parse(localStr) : [];
        const localMap = new Map(localData.map((item: any) => [item.id, item]));

        for (const record of records) {
            if (record.deleted_at) {
                localMap.delete(record.id);
            } else if (record.data) {
                localMap.set(record.id, record.data);
            }
        }

        await AsyncStorage.setItem(storageKey, JSON.stringify(Array.from(localMap.values())));
    }

    /** Merge singleton-type cloud records (take latest) */
    private async mergeSingletonRecord(storageKey: string, records: any[]) {
        const latest = records.sort((a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )[0];

        if (!latest.deleted_at && latest.data) {
            await AsyncStorage.setItem(storageKey, JSON.stringify(latest.data));
        } else {
            await AsyncStorage.removeItem(storageKey);
        }
    }

    // ─── PUSH ─────────────────────────────────────────────────

    private async pushToCloud(lastSyncedAt: number, userId: string, tables: SyncMapping[]) {
        for (const mapping of tables) {
            const localStr = await AsyncStorage.getItem(mapping.key);
            if (!localStr) continue;

            const localData = JSON.parse(localStr);

            if (mapping.type === 'array') {
                await this.pushArray(mapping.table, localData, lastSyncedAt, userId);
            } else {
                await this.pushSingleton(mapping.table, localData, lastSyncedAt, userId);
            }
        }
    }

    private async pushArray(table: string, localData: any[], lastSyncedAt: number, userId: string) {
        const updated = localData.filter((item: any) => (item.updated_at || 0) > lastSyncedAt);
        if (updated.length === 0) return;

        const payloads = updated.map((item: any) => ({
            id: item.id,
            user_id: userId,
            updated_at: new Date(item.updated_at || Date.now()).toISOString(),
            deleted_at: item.deleted_at ? new Date(item.deleted_at).toISOString() : null,
            data: item,
        }));

        const { error } = await supabase.from(table).upsert(payloads);
        if (error && this.isTableMissing(error)) this.markMissing(table);
    }

    private async pushSingleton(table: string, localData: any, lastSyncedAt: number, userId: string) {
        if ((localData.updated_at || 0) <= lastSyncedAt) return;

        const { error } = await supabase.from(table).upsert({
            id: table, // Singleton convention
            user_id: userId,
            updated_at: new Date(localData.updated_at || Date.now()).toISOString(),
            data: localData,
        });
        if (error && this.isTableMissing(error)) this.markMissing(table);
    }

    private async pushDailyData(lastSyncedAt: number, userId: string) {
        if (this.missingTables.has('daily_data')) return;

        const allKeys = await AsyncStorage.getAllKeys();
        const dailyKeys = allKeys.filter(k => k.startsWith(STORAGE_KEYS.DAILY_DATA + '_'));
        if (dailyKeys.length === 0) return;

        const pairs = await AsyncStorage.multiGet(dailyKeys);
        const payloads: any[] = [];

        for (const [key, value] of pairs) {
            if (!value) continue;
            const data = JSON.parse(value);
            if ((data.updated_at || 0) <= lastSyncedAt) continue;

            // Extract date from key: "@stacker_daily_data_v1_2026-04-12" → "2026-04-12"
            const dateStr = key.replace(STORAGE_KEYS.DAILY_DATA + '_', '');
            payloads.push({
                id: dateStr,
                user_id: userId,
                updated_at: new Date(data.updated_at || Date.now()).toISOString(),
                deleted_at: data.deleted_at ? new Date(data.deleted_at).toISOString() : null,
                data,
            });
        }

        if (payloads.length > 0) {
            const { error } = await supabase.from('daily_data').upsert(payloads);
            if (error && this.isTableMissing(error)) this.markMissing('daily_data');
        }
    }

    // ─── Migration ────────────────────────────────────────────

    async migrateGuestToCloud() {
        if (__DEV__) console.log('[SyncService] Migrating guest data...');
        await AsyncStorage.setItem(LAST_SYNCED_AT_KEY, '0');
        this.missingTables.clear(); // Re-probe all tables
        this.triggerSync();
    }
}

export const SyncService = new SyncEngine();

export function triggerSync() {
    SyncService.triggerSync();
}
