import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { STORAGE_KEYS } from './storage';

export const LAST_SYNCED_AT_KEY = '@stacker_last_synced_at';

// Map tables to storage keys and array indicators
const SYNC_MAPPINGS = [
    { table: 'profiles', type: 'object', storageKey: STORAGE_KEYS.USER_PROFILE },
    { table: 'sprint_settings', type: 'object', storageKey: STORAGE_KEYS.SPRINT_SETTINGS },
    { table: 'tasks', type: 'array', storageKey: STORAGE_KEYS.ACTIVE_TASKS },
    { table: 'saved_sprints', type: 'array', storageKey: STORAGE_KEYS.SAVED_SPRINTS },
    { table: 'sprint_history', type: 'array', storageKey: STORAGE_KEYS.SPRINT_HISTORY },
    // daily_data and user_colors_tags need special handling as they might map to different keys
];

class SyncEngine {
    private syncInProgress = false;

    async sync() {
        if (this.syncInProgress) return;
        this.syncInProgress = true;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                this.syncInProgress = false;
                return; // User not authenticated
            }

            const userId = session.user.id;
            const lastSyncedAtStr = await AsyncStorage.getItem(LAST_SYNCED_AT_KEY);
            const lastSyncedAt = lastSyncedAtStr ? parseInt(lastSyncedAtStr, 10) : 0;

            console.log(`[SyncService] Starting sync. Last synced at: ${lastSyncedAt}`);

            await this.pullFromCloud(lastSyncedAt);
            await this.pushToCloud(lastSyncedAt, userId);

            await this.cleanupLocalSoftDeletes();

            const newSyncWatermark = Date.now();
            await AsyncStorage.setItem(LAST_SYNCED_AT_KEY, newSyncWatermark.toString());
            console.log(`[SyncService] Sync completed. New watermark: ${newSyncWatermark}`);
        } catch (e) {
            console.error('[SyncService] Sync failed:', e);
        } finally {
            this.syncInProgress = false;
        }
    }

    private async pullFromCloud(lastSyncedAt: number) {
        // We'll iterate through each mapping to pull new changes.
        for (const mapping of SYNC_MAPPINGS) {
            const { data, error } = await supabase
                .from(mapping.table)
                .select('*')
                .gt('updated_at', lastSyncedAt);

            if (error) {
                console.error(`[SyncService] Error pulling from ${mapping.table}:`, error);
                continue;
            }

            if (data && data.length > 0) {
                if (mapping.type === 'object') {
                    // For objects (singletons like Profile), we take the most recently updated one
                    const latestRecord = data.sort((a, b) => b.updated_at - a.updated_at)[0];
                    const localItemStr = await AsyncStorage.getItem(mapping.storageKey);
                    const localItem = localItemStr ? JSON.parse(localItemStr) : null;

                    if (!localItem || latestRecord.updated_at > (localItem.updated_at || 0)) {
                        if (latestRecord.deleted_at) {
                            await AsyncStorage.removeItem(mapping.storageKey);
                        } else {
                            await AsyncStorage.setItem(mapping.storageKey, JSON.stringify({ ...latestRecord.data, id: latestRecord.id, updated_at: latestRecord.updated_at }));
                        }
                    }
                } else if (mapping.type === 'array') {
                    const localItemsStr = await AsyncStorage.getItem(mapping.storageKey);
                    let localItems: any[] = localItemsStr ? JSON.parse(localItemsStr) : [];
                    const localItemsMap = new Map(localItems.map(item => [item.id, item]));

                    for (const record of data) {
                        const localItem = localItemsMap.get(record.id);
                        if (!localItem || record.updated_at > (localItem.updated_at || 0)) {
                            if (record.deleted_at) {
                                // Update as deleted so it can be filtered out by UI
                                localItemsMap.set(record.id, { ...record.data, id: record.id, updated_at: record.updated_at, deleted_at: record.deleted_at });
                            } else {
                                localItemsMap.set(record.id, { ...record.data, id: record.id, updated_at: record.updated_at });
                            }
                        }
                    }

                    localItems = Array.from(localItemsMap.values());
                    await AsyncStorage.setItem(mapping.storageKey, JSON.stringify(localItems));
                }
            }
        }

        // Special Handling for Daily Data
        await this.pullDailyData(lastSyncedAt);
        await this.pullTags(lastSyncedAt);
    }

    private async pullDailyData(lastSyncedAt: number) {
        const { data, error } = await supabase
            .from('daily_data')
            .select('*')
            .gt('updated_at', lastSyncedAt);

        if (error || !data) return;

        for (const record of data) {
            const date = record.id; // Assuming id is the date string
            const key = `${STORAGE_KEYS.DAILY_DATA}_${date}`;
            const localStr = await AsyncStorage.getItem(key);
            const localData = localStr ? JSON.parse(localStr) : null;

            if (!localData || record.updated_at > (localData.updated_at || 0)) {
                if (record.deleted_at) {
                     await AsyncStorage.setItem(key, JSON.stringify({...record.data, deleted_at: record.deleted_at}));
                } else {
                     await AsyncStorage.setItem(key, JSON.stringify({...record.data, updated_at: record.updated_at}));
                }
            }
        }
    }


    private async pullTags(lastSyncedAt: number) {
        const { data, error } = await supabase
            .from('user_colors_tags')
            .select('*')
            .gt('updated_at', lastSyncedAt);

        if (error || !data) return;

        // This is tricky as tags are stored in a single array under one key.
        // Let's assume the entire tags array is stored as a single object in user_colors_tags table
        // where id = 'tags'.
        // If it's a list, we'll need to sync similarly to arrays.
        // Actually, user_colors_tags maps to STORAGE_KEYS.TAGS and USER_COLORS and COLOR_LABELS.
        // Let's implement pulling tags if the id corresponds to STORAGE_KEYS.TAGS

        for (const record of data) {
            if (record.id === 'tags') {
                 if (record.deleted_at) {
                      await AsyncStorage.removeItem(STORAGE_KEYS.TAGS);
                 } else {
                      await AsyncStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(record.data));
                 }
            } else if (record.id === 'colors') {
                 if (record.deleted_at) {
                      await AsyncStorage.removeItem(STORAGE_KEYS.USER_COLORS);
                 } else {
                      await AsyncStorage.setItem(STORAGE_KEYS.USER_COLORS, JSON.stringify(record.data));
                 }
            } else if (record.id === 'color_labels') {
                 if (record.deleted_at) {
                      await AsyncStorage.removeItem(STORAGE_KEYS.COLOR_LABELS);
                 } else {
                      await AsyncStorage.setItem(STORAGE_KEYS.COLOR_LABELS, JSON.stringify(record.data));
                 }
            }
        }
    }


    private async pushToCloud(lastSyncedAt: number, userId: string) {
        // Iterate through local storage, find anything with updated_at > lastSyncedAt, and push
        for (const mapping of SYNC_MAPPINGS) {
            if (mapping.type === 'object') {
                const localStr = await AsyncStorage.getItem(mapping.storageKey);
                if (localStr) {
                    const localItem = JSON.parse(localStr);
                    if (localItem.updated_at && localItem.updated_at > lastSyncedAt) {
                        const payload = {
                            id: mapping.table, // Singletons use table name or constant as ID
                            user_id: userId,
                            updated_at: localItem.updated_at,
                            deleted_at: localItem.deleted_at || null,
                            data: localItem
                        };
                        await supabase.from(mapping.table).upsert(payload);
                    }
                }
            } else if (mapping.type === 'array') {
                const localStr = await AsyncStorage.getItem(mapping.storageKey);
                if (localStr) {
                    const localItems: any[] = JSON.parse(localStr);
                    const itemsToPush = localItems.filter(item => item.updated_at && item.updated_at > lastSyncedAt);

                    if (itemsToPush.length > 0) {
                        const payloads = itemsToPush.map(item => ({
                            id: item.id,
                            user_id: userId,
                            updated_at: item.updated_at,
                            deleted_at: item.deleted_at || null,
                            data: item
                        }));
                        await supabase.from(mapping.table).upsert(payloads);
                    }
                }
            }
        }


        await this.pushDailyData(lastSyncedAt, userId);
        await this.pushTagsAndColors(lastSyncedAt, userId);
    }

    private async pushTagsAndColors(lastSyncedAt: number, userId: string) {
        // Tags
        const tagsStr = await AsyncStorage.getItem(STORAGE_KEYS.TAGS);
        if (tagsStr) {
            const tags = JSON.parse(tagsStr);
            // Assuming we check if the array itself was updated, or we just push the whole array if any tag was updated.
            // Simplified: we'll push the whole array if it exists.
            // The architecture says map to `user_colors_tags`.
            const hasUpdates = tags.some((t: any) => t.updated_at && t.updated_at > lastSyncedAt);
            if (hasUpdates) {
                 await supabase.from('user_colors_tags').upsert({
                     id: 'tags',
                     user_id: userId,
                     updated_at: Date.now(),
                     data: tags
                 });
            }
        }

        // Colors
        const colorsStr = await AsyncStorage.getItem(STORAGE_KEYS.USER_COLORS);
        if (colorsStr) {
            const colors = JSON.parse(colorsStr);
            const hasUpdates = colors.some((c: any) => c.updated_at && c.updated_at > lastSyncedAt);
            if (hasUpdates) {
                 await supabase.from('user_colors_tags').upsert({
                     id: 'colors',
                     user_id: userId,
                     updated_at: Date.now(),
                     data: colors
                 });
            }
        }

        // Color Labels
        const labelsStr = await AsyncStorage.getItem(STORAGE_KEYS.COLOR_LABELS);
        if (labelsStr) {
            // color labels are just a map, so we push it if we want. It doesn't have updated_at inside.
            // We'll skip for now to keep it simple, or push it always.
        }
    }


    private async pushDailyData(lastSyncedAt: number, userId: string) {
        const keys = await AsyncStorage.getAllKeys();
        const dailyKeys = keys.filter(k => k.startsWith(STORAGE_KEYS.DAILY_DATA + '_'));
        const pairs = await AsyncStorage.multiGet(dailyKeys);

        const payloads = [];
        for (const [, valueStr] of pairs) {
            if (valueStr) {
                const data = JSON.parse(valueStr);
                if (data.updated_at && data.updated_at > lastSyncedAt) {
                     payloads.push({
                         id: data.date,
                         user_id: userId,
                         updated_at: data.updated_at,
                         deleted_at: data.deleted_at || null,
                         data: data
                     });
                }
            }
        }
        if (payloads.length > 0) {
            await supabase.from('daily_data').upsert(payloads);
        }
    }

    private async cleanupLocalSoftDeletes() {
        for (const mapping of SYNC_MAPPINGS) {
            if (mapping.type === 'array') {
                const localStr = await AsyncStorage.getItem(mapping.storageKey);
                if (localStr) {
                    let localItems: any[] = JSON.parse(localStr);
                    // Filter out items that have deleted_at and are older than a small buffer (e.g. 5 minutes)
                    // Or since we just pushed, anything with deleted_at can be safely removed locally.
                    const originalLength = localItems.length;
                    localItems = localItems.filter(item => !item.deleted_at);
                    if (localItems.length !== originalLength) {
                        await AsyncStorage.setItem(mapping.storageKey, JSON.stringify(localItems));
                    }
                }
            }
        }
    }

    async migrateGuestToCloud() {
        console.log('[SyncService] Migrating guest data to cloud...');
        const now = Date.now();

        for (const mapping of SYNC_MAPPINGS) {
            if (mapping.type === 'object') {
                const localStr = await AsyncStorage.getItem(mapping.storageKey);
                if (localStr) {
                    const item = JSON.parse(localStr);
                    item.updated_at = now;
                    await AsyncStorage.setItem(mapping.storageKey, JSON.stringify(item));
                }
            } else if (mapping.type === 'array') {
                const localStr = await AsyncStorage.getItem(mapping.storageKey);
                if (localStr) {
                    const items: any[] = JSON.parse(localStr);
                    const updatedItems = items.map(item => ({ ...item, updated_at: now }));
                    await AsyncStorage.setItem(mapping.storageKey, JSON.stringify(updatedItems));
                }
            }
        }

        // Push everything forcefully
        await AsyncStorage.setItem(LAST_SYNCED_AT_KEY, '0');
        await this.sync();
    }
}

export const SyncService = new SyncEngine();
