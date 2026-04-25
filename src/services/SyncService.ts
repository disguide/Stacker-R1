import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { STORAGE_KEYS } from './storage.types';
import { DailyData } from '../core/types';
import { SyncBus } from './SyncBus';
import { ImageUploadService } from './ImageUploadService';

const SYNC_INTERVAL = 2000; // 2 seconds debounce
const LAST_SYNCED_AT_KEY = '@stacker_last_synced_at';
const MIGRATION_PENDING_KEY = '@stacker_migration_pending';

/**
 * Universal timestamp converter to safely compare mixed types (ISO strings vs Epoch numbers)
 */
const getTimestamp = (val: string | number | undefined | null): number => {
    if (!val || val === 'NaN') return 0;
    const time = typeof val === 'number' ? val : new Date(val).getTime();
    return isNaN(time) ? 0 : time;
};

/**
 * Helper to ensure we send standard ISO strings to Supabase
 */
const toIso = (val: string | number | undefined | null): string | null => {
    if (!val || val === 'NaN') return null;
    try {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d.toISOString();
    } catch {
        return null;
    }
};

/**
 * SyncEngine — Server-Anchored Dirty-Flag Sync Engine.
 * 
 * DESIGN PATTERNS:
 * 1. Server-Anchored Time: Sync discovery is based on Supabase DB time, not local clock.
 * 2. Snapshot-Clearing: Protects against race conditions during Push.
 * 3. Dirty-Protection Merge: Pull never overwrites un-synced local changes.
 * 4. Loop Prevention: Uses repository 'saveFromSync' to bypass dirty flagging.
 * 5. Pending Queue: Sync triggers during an active sync are queued, not dropped.
 */

interface SyncMapping {
    key: string;           // AsyncStorage key
    table: string;         // Supabase table name
    type: 'array' | 'singleton';
}

const SYNC_TABLES: SyncMapping[] = [
    { key: STORAGE_KEYS.ACTIVE_TASKS,    table: 'tasks',           type: 'array' },
    { key: STORAGE_KEYS.HISTORY,         table: 'task_history',    type: 'array' },
    { key: STORAGE_KEYS.SAVED_SPRINTS,   table: 'saved_sprints',   type: 'array' },
    { key: STORAGE_KEYS.SPRINT_HISTORY,  table: 'sprint_history',  type: 'array' },
    { key: STORAGE_KEYS.USER_PROFILE,    table: 'profiles',        type: 'singleton' },
    { key: STORAGE_KEYS.SPRINT_SETTINGS, table: 'sprint_settings', type: 'singleton' },
    { key: STORAGE_KEYS.TAGS,            table: 'tags',            type: 'singleton' },
    { key: STORAGE_KEYS.COLOR_LABELS,    table: 'color_labels',    type: 'singleton' },
    { key: STORAGE_KEYS.USER_COLORS,     table: 'user_colors',     type: 'singleton' },
    { key: STORAGE_KEYS.MAIL,            table: 'mail',            type: 'singleton' },
    { key: STORAGE_KEYS.COLOR_SETTINGS,  table: 'color_settings',  type: 'singleton' },
    { key: STORAGE_KEYS.ACTION_LOGS,     table: 'action_logs',     type: 'array' },
];

let syncTimeout: NodeJS.Timeout | null = null;
let isSyncing = false;
let syncPending = false; // BUG FIX #1: Queue instead of drop

// Subscribe to the SyncBus to break circular dependencies
SyncBus.subscribe(() => {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => sync(), SYNC_INTERVAL);
});

/**
 * Trigger a debounced sync via the Bus
 */
export const triggerSync = () => {
    SyncBus.emit();
};

/**
 * Force an immediate sync (Sync Flush)
 * Returns a promise that resolves when sync finishes.
 */
export const flushSync = async (): Promise<void> => {
    if (syncTimeout) clearTimeout(syncTimeout);
    return sync();
};

/**
 * Internal helper to log sync events without circular dependencies
 */
async function logSyncAction(action: string, metadata?: any) {
    try {
        const rawJson = await AsyncStorage.getItem(STORAGE_KEYS.ACTION_LOGS);
        const allLogs: any[] = rawJson ? JSON.parse(rawJson) : [];
        const newEntry = {
            action,
            metadata,
            id: Math.random().toString(36).substring(7),
            updated_at: Date.now(),
            _isDirty: true
        };
        await AsyncStorage.setItem(STORAGE_KEYS.ACTION_LOGS, JSON.stringify([newEntry, ...allLogs].slice(0, 500)));
    } catch (e) { /* ignore */ }
}

/**
 * The Main Sync Loop
 * 
 * BUG FIX #1: Instead of silently returning when isSyncing is true,
 * we now set syncPending=true so the current cycle will re-run when it finishes.
 * This prevents data from staying dirty forever if a save happens mid-sync.
 */
export const sync = async () => {
    if (isSyncing) {
        syncPending = true; // Queue a follow-up instead of dropping
        if (__DEV__) console.log('[SyncService] Sync already active — queued a follow-up.');
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return; 

    isSyncing = true;
    syncPending = false; // Clear the queue flag — we're handling it now
    
    try {
        // 0. CHECK PENDING MIGRATION: Ensure failsafe robust guest-to-cloud transfers
        const pendingMigration = await AsyncStorage.getItem(MIGRATION_PENDING_KEY);
        if (pendingMigration === 'true') {
            if (__DEV__) console.log('[SyncService] Detected pending migration, resuming...');
            await markAllLocalDataDirty();
            await AsyncStorage.removeItem(LAST_SYNCED_AT_KEY); // Force full pull
            await AsyncStorage.removeItem(MIGRATION_PENDING_KEY);
        }

        // 1. ANCHOR: Get official server time (Safe Fallback)
        let serverTimeIso: string;
        const { data: serverTime, error: timeError } = await supabase.rpc('get_server_time');
        
        if (timeError || !serverTime) {
            console.warn('[SyncService] get_server_time RPC missing/failed, using local time fallback');
            serverTimeIso = new Date().toISOString();
        } else {
            serverTimeIso = serverTime;
        }
        
        const lastSyncedAtRaw = await AsyncStorage.getItem(LAST_SYNCED_AT_KEY);
        // Standardize: ensure we have an ISO string, fallback to Epoch 0
        let lastSyncedAtIso = lastSyncedAtRaw || new Date(0).toISOString();
        if (lastSyncedAtIso === 'NaN' || isNaN(new Date(lastSyncedAtIso).getTime())) {
            lastSyncedAtIso = new Date(0).toISOString();
        }

        // 2. STAGES: Pull changes then Push local updates
        await pullFromCloud(lastSyncedAtIso, session.user.id);
        await pullDailyData(lastSyncedAtIso, session.user.id);
        
        await pushToCloud(session.user.id);
        await pushDailyData(session.user.id);

        // 3. FINALIZE: Update anchor ONLY on success
        await AsyncStorage.setItem(LAST_SYNCED_AT_KEY, serverTimeIso);
        
        if (__DEV__) console.log('[SyncService] Sync complete. Anchor set to:', serverTimeIso);
    } catch (error) {
        console.error('[SyncService] Sync loop failed:', error);
    } finally {
        isSyncing = false;
        
        // BUG FIX #1 continued: If something triggered sync while we were busy, run again
        if (syncPending) {
            syncPending = false;
            if (__DEV__) console.log('[SyncService] Processing queued sync...');
            // Use setTimeout(0) to release the call stack and prevent deep recursion
            setTimeout(() => sync(), 100);
        }
    }
};

/**
 * INTERNAL: Loops through all synced tables and marking all existing items as _isDirty = true.
 * This ensures that local "Guest" data is correctly prioritized for PUSH after login.
 */
async function markAllLocalDataDirty() {
    if (__DEV__) console.log('[SyncService] Marking all local data as dirty for migration...');
    
    // 1. Regular Tables
    for (const mapping of SYNC_TABLES) {
        try {
            const json = await AsyncStorage.getItem(mapping.key);
            if (!json) continue;

            if (mapping.type === 'array') {
                const items = JSON.parse(json);
                const updated = items.map((item: any) => ({ ...item, _isDirty: true }));
                await AsyncStorage.setItem(mapping.key, JSON.stringify(updated));
            } else {
                const data = JSON.parse(json);
                await AsyncStorage.setItem(mapping.key, JSON.stringify({ ...data, _isDirty: true }));
            }
        } catch (err) {
            console.warn(`[SyncService] Failed to mark table ${mapping.table} as dirty:`, err);
        }
    }

    // 2. Daily Data (Special time-series keys)
    try {
        const keys = await AsyncStorage.getAllKeys();
        const dailyKeys = keys.filter(k => k.startsWith(STORAGE_KEYS.DAILY_DATA + '_'));
        if (dailyKeys.length > 0) {
            const pairs = await AsyncStorage.multiGet(dailyKeys);
            const updates: [string, string][] = pairs
                .filter(([_, v]) => !!v)
                .map(([k, v]) => {
                    const data = JSON.parse(v!);
                    return [k, JSON.stringify({ ...data, _isDirty: true })];
                });
            if (updates.length > 0) {
                await AsyncStorage.multiSet(updates);
            }
        }
    } catch (err) {
        console.warn(`[SyncService] Failed to mark daily data as dirty:`, err);
    }
}

/**
 * MIGRATION HELPER: Re-uploads local file:// avatar/banner images to Supabase Storage.
 * Replaces the local URIs in the profile data with public URLs so images sync across devices.
 */
async function uploadLocalProfileImages() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        const userId = session.user.id;
        const profileJson = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
        if (!profileJson) return;

        const profileEnvelope = JSON.parse(profileJson);
        const profileData = profileEnvelope.data || profileEnvelope;

        let changed = false;

        // Re-upload avatar if it's a local file URI
        if (ImageUploadService.isLocalUri(profileData.avatar)) {
            if (__DEV__) console.log('[SyncService] Re-uploading local avatar for migration...');
            const publicUrl = await ImageUploadService.upload(profileData.avatar, userId, 'avatar');
            if (publicUrl) {
                profileData.avatar = publicUrl;
                changed = true;
            }
        }

        // Re-upload banner if it's a local file URI
        if (ImageUploadService.isLocalUri(profileData.banner)) {
            if (__DEV__) console.log('[SyncService] Re-uploading local banner for migration...');
            const publicUrl = await ImageUploadService.upload(profileData.banner, userId, 'banner');
            if (publicUrl) {
                profileData.banner = publicUrl;
                changed = true;
            }
        }

        if (changed) {
            // Write back the updated profile with remote URLs
            const updatedEnvelope = profileEnvelope.data !== undefined
                ? { ...profileEnvelope, data: profileData, _isDirty: true, updated_at: Date.now() }
                : { ...profileData, _isDirty: true, updated_at: Date.now() };
            
            await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(updatedEnvelope));
            if (__DEV__) console.log('[SyncService] Profile images re-uploaded and URIs updated.');
        }
    } catch (err) {
        console.warn('[SyncService] Failed to re-upload profile images during migration:', err);
        // Non-fatal — the rest of the migration can still proceed
    }
}

/**
 * MIGRATION: Resets sync anchor and marks all data dirty to force a full merge 
 * between local "Guest" data and the Cloud account.
 * 
 * BUG FIX #2: Removed `if (isSyncing) return` — migration setup MUST always happen.
 * If a sync is already running, we set the MIGRATION_PENDING flag and queue a follow-up.
 * The running sync will finish harmlessly, and the next cycle will detect the flag
 * and execute the migration properly.
 */
export const migrateGuestToCloud = async () => {
    try {
        if (__DEV__) console.log('[SyncService] Starting guest-to-cloud migration...');
        
        // 1. Set the atomic flag FIRST — if we crash after this, the next boot will resume
        await AsyncStorage.setItem(MIGRATION_PENDING_KEY, 'true');

        // 2. Mark everything as dirty so pushToCloud picks it up
        await markAllLocalDataDirty();
        
        // 2b. Re-upload local profile images to Supabase Storage
        await uploadLocalProfileImages();
        
        // 3. Reset anchor so pullFromCloud gets everything from the cloud
        await AsyncStorage.removeItem(LAST_SYNCED_AT_KEY);
        
        // 4. Record migration start for audit
        await logSyncAction('guest_migration_started', { timestamp: Date.now() });

        // 5. Clear the flag since we've done the setup successfully
        await AsyncStorage.removeItem(MIGRATION_PENDING_KEY);

        // 6. Trigger the actual sync
        // If a sync is already running, this will queue. The pending flag is already cleared
        // because we completed setup. If we crashed before step 5, the flag would remain
        // and the next sync() call would re-do the setup via the pendingMigration check.
        if (isSyncing) {
            syncPending = true;
            if (__DEV__) console.log('[SyncService] Sync in progress — migration queued.');
        } else {
            await sync();
        }

        if (__DEV__) console.log('[SyncService] Migration triggered successfully.');
    } catch (error) {
        console.error('[SyncService] Migration setup failed:', error);
        // The MIGRATION_PENDING flag may still be set, so next boot will retry
    }
};

/**
 * PUSH: Robust Sync with Snapshot Clearing
 */
async function pushToCloud(userId: string) {
    for (const mapping of SYNC_TABLES) {
        try {
            const json = await AsyncStorage.getItem(mapping.key);
            if (!json) continue;

            if (mapping.type === 'array') {
                const localItems: any[] = JSON.parse(json);
                const dirtyItems = localItems.filter(item => item._isDirty);
                
                if (dirtyItems.length === 0) continue;

                if (__DEV__) console.log(`[SyncService] Pushing ${dirtyItems.length} items to ${mapping.table}...`);

                // A. Snapshot: Capture 'updated_at' before network request
                const snapshots = new Map(dirtyItems.map(item => [item.id, item.updated_at]));

                // B. Transport: Send to Supabase (JSONB Envelope)
                const payload = dirtyItems.map(item => {
                    const { id, updated_at, deleted_at, _isDirty, ...data } = item;
                    return {
                        id,
                        user_id: userId,
                        data, // The core object goes inside the 'data' column
                        updated_at: toIso(updated_at) || new Date().toISOString(),
                        deleted_at: toIso(deleted_at),
                    };
                });

                const { error } = await supabase
                    .from(mapping.table)
                    .upsert(payload, { onConflict: 'id,user_id' });

                if (error) {
                    console.error(`[SyncService] Supabase Error (Push ${mapping.table}):`, error.message);
                    // BUG FIX #3: Don't throw on individual table errors — continue with other tables
                    continue;
                }

                // C. Concurrency Shield: Re-read and clear flag ONLY if record hasn't changed since snapshot
                const currentJson = await AsyncStorage.getItem(mapping.key);
                const currentItems: any[] = currentJson ? JSON.parse(currentJson) : [];
                
                const updated = currentItems.map(item => {
                    if (snapshots.has(item.id) && getTimestamp(item.updated_at) === getTimestamp(snapshots.get(item.id))) {
                        return { ...item, _isDirty: false };
                    }
                    return item;
                });

                await AsyncStorage.setItem(mapping.key, JSON.stringify(updated));
            } else {
                // Singletons: Pure overwrite with concurrency shield
                const data = JSON.parse(json);
                if (data._isDirty) {
                    if (__DEV__) console.log(`[SyncService] Pushing singleton to ${mapping.table}...`);
                    
                    // BUG FIX #4: Correct singleton unwrapping.
                    // StorageService wraps singletons as { data: <payload>, updated_at, _isDirty }
                    // We need to send `data.data` (the actual payload) to Supabase's `data` column.
                    // If the object has a `.data` property, use that as the payload.
                    // Otherwise, strip sync metadata and send the rest.
                    const singletonUpdatedAt = data.updated_at;
                    let payloadContent: any;
                    
                    if (data.data !== undefined) {
                        // Standard envelope: { data: [...], updated_at, _isDirty }
                        payloadContent = data.data;
                    } else {
                        // Legacy/flat format: strip sync metadata, send rest
                        const { id: _id, updated_at: _u, deleted_at: _d, _isDirty: _dirty, ...rest } = data;
                        payloadContent = rest;
                    }
                    
                    const payload = { 
                        id: data.id || 'singleton',
                        user_id: userId, 
                        data: payloadContent, 
                        updated_at: toIso(singletonUpdatedAt) || new Date().toISOString(),
                        deleted_at: toIso(data.deleted_at),
                    };

                    const { error } = await supabase
                        .from(mapping.table)
                        .upsert(payload, { onConflict: 'id,user_id' });
                    
                    if (error) {
                        console.error(`[SyncService] Supabase Error (Push Singleton ${mapping.table}):`, error.message);
                        // BUG FIX #3: Don't throw — continue with other tables
                        continue;
                    }

                    // C. Concurrency Shield: Re-read and clear flag ONLY if record hasn't changed
                    const currentJson = await AsyncStorage.getItem(mapping.key);
                    if (currentJson) {
                        const currentData = JSON.parse(currentJson);
                        if (getTimestamp(currentData.updated_at) === getTimestamp(singletonUpdatedAt)) {
                            await AsyncStorage.setItem(mapping.key, JSON.stringify({ ...currentData, _isDirty: false }));
                        }
                    }
                }
            }
        } catch (err: any) {
            console.warn(`[SyncService] Failed to push table ${mapping.table}:`, err.message || err);
        }
    }
}

/**
 * PULL: Robust Sync discovery (Dirty-Protection)
 * 
 * BUG FIX #5: Added user_id filter to pull queries. Without it, RLS protects us
 * but the query is less efficient and could behave unexpectedly in edge cases.
 */
async function pullFromCloud(lastSyncedAt: string, userId: string) {
    for (const mapping of SYNC_TABLES) {
        try {
            // 1. Discovery: Get changes since last anchor
            const { data: serverItems, error } = await supabase
                .from(mapping.table)
                .select('*')
                .eq('user_id', userId)
                .gt('updated_at', lastSyncedAt);

            if (error) {
                console.error(`[SyncService] Supabase Error (Pull ${mapping.table}):`, error.message);
                continue; // BUG FIX #3: Don't throw — skip this table
            }
            if (!serverItems || serverItems.length === 0) continue;

            if (__DEV__) console.log(`[SyncService] Pulling ${serverItems.length} items from ${mapping.table}...`);

            const localJson = await AsyncStorage.getItem(mapping.key);
            const localData = localJson ? JSON.parse(localJson) : (mapping.type === 'array' ? [] : null);

            if (mapping.type === 'array') {
                const localItems = (localData || []) as any[];
                // MERGE: Server version wins UNLESS local is dirty
                const merged = [...localItems];
                
                serverItems.forEach((remote: any) => {
                    const index = merged.findIndex(item => item.id === remote.id);
                    
                    // UNWRAP REMOTE DATA FROM ENVELOPE
                    const sanitizedRemote = {
                        ...(remote.data || {}),
                        id: remote.id,
                        updated_at: getTimestamp(remote.updated_at),
                        deleted_at: remote.deleted_at ? getTimestamp(remote.deleted_at) : null
                    };

                    if (index === -1) {
                        merged.push({ ...sanitizedRemote, _isDirty: false });
                    } else if (!merged[index]._isDirty) {
                        merged[index] = { ...sanitizedRemote, _isDirty: false };
                    }
                    // If local IS dirty, we skip — local changes win until they're pushed
                });

                await AsyncStorage.setItem(mapping.key, JSON.stringify(merged));
            } else {
                // Singletons: Pick the newest server row and reconstruct local envelope
                const remote = serverItems.reduce((latest: any, current: any) => 
                    getTimestamp(current.updated_at) > getTimestamp(latest.updated_at) ? current : latest, serverItems[0]);
                
                // BUG FIX #4: Reconstruct the standard local envelope format
                // StorageService expects: { data: <payload>, updated_at: <epoch>, _isDirty: <bool> }
                // The server stores the payload in `remote.data`
                const reconstructedEnvelope = {
                    data: remote.data, // Payload content (could be array, object, anything)
                    id: remote.id,
                    updated_at: getTimestamp(remote.updated_at),
                    _isDirty: false,
                };

                const local = localData as any;
                
                // Only overwrite if local isn't dirty, OR if server is strictly newer
                if (!local || !local._isDirty) {
                    await AsyncStorage.setItem(mapping.key, JSON.stringify(reconstructedEnvelope));
                } else if (getTimestamp(remote.updated_at) > getTimestamp(local.updated_at)) {
                    // Server is newer AND local is dirty — server wins, but mark dirty so local changes re-push
                    await AsyncStorage.setItem(mapping.key, JSON.stringify({ ...reconstructedEnvelope, _isDirty: true }));
                }
                // else: local is dirty and newer — keep local, it'll push on next cycle
            }
        } catch (err) {
            console.warn(`[SyncService] Failed to pull table ${mapping.table}:`, err);
        }
    }
}

/**
 * DAILY DATA: Specialized sync for the time-series activity table (Individual keys)
 */
async function pushDailyData(userId: string) {
    const keys = await AsyncStorage.getAllKeys();
    const dailyKeys = keys.filter(k => k.startsWith(STORAGE_KEYS.DAILY_DATA + '_'));
    if (dailyKeys.length === 0) return;
    
    const pairs = await AsyncStorage.multiGet(dailyKeys);
    const dirtyData: DailyData[] = pairs
        .map(([_, v]) => v ? JSON.parse(v) : null)
        .filter(v => v !== null && v._isDirty);

    if (dirtyData.length === 0) return;

    if (__DEV__) console.log(`[SyncService] Pushing ${dirtyData.length} daily entries...`);

    // Snapshot current dirty state
    const snapshots = new Map(dirtyData.map(d => [d.date, d.updated_at]));

    const payload = dirtyData.map(d => {
        const { updated_at, deleted_at, _isDirty, ...data } = d;
        return {
            id: (d as any).id || d.date,
            user_id: userId,
            data, // Wrap daily data
            updated_at: toIso(updated_at) || new Date().toISOString(),
            deleted_at: toIso(deleted_at),
        };
    });

    // Deduplicate by id — keep the latest entry for each id to prevent
    // "ON CONFLICT DO UPDATE cannot affect row a second time" error
    const deduped = new Map<string, typeof payload[0]>();
    for (const item of payload) {
        deduped.set(item.id, item);
    }
    const uniquePayload = Array.from(deduped.values());

    const { error } = await supabase
        .from('daily_data')
        .upsert(uniquePayload, { onConflict: 'id,user_id' });

    if (error) {
        console.error(`[SyncService] Supabase Error (Push daily_data):`, error.message);
        return; // BUG FIX #3: Don't throw — let other sync stages complete
    }

    // Clear dirty flags locally with concurrency check
    for (const data of dirtyData) {
        const currentJson = await AsyncStorage.getItem(`${STORAGE_KEYS.DAILY_DATA}_${data.date}`);
        if (currentJson) {
            const current = JSON.parse(currentJson);
            if (getTimestamp(current.updated_at) === getTimestamp(snapshots.get(data.date))) {
                await AsyncStorage.setItem(
                    `${STORAGE_KEYS.DAILY_DATA}_${data.date}`, 
                    JSON.stringify({ ...current, _isDirty: false })
                );
            }
        }
    }
}

async function pullDailyData(lastSyncedAt: string, userId: string) {
    const { data: serverData, error } = await supabase
        .from('daily_data')
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', lastSyncedAt);

    if (error) {
        console.error(`[SyncService] Supabase Error (Pull daily_data):`, error.message);
        return;
    }
    if (!serverData || serverData.length === 0) return;

    if (__DEV__) console.log(`[SyncService] Pulling ${serverData.length} daily entries...`);

    for (const remote of serverData) {
        const key = `${STORAGE_KEYS.DAILY_DATA}_${remote.id}`;
        const localJson = await AsyncStorage.getItem(key);
        const local = localJson ? JSON.parse(localJson) : null;

        // UNWRAP REMOTE DATA
        const sanitizedRemote = {
            ...(remote.data || {}),
            id: remote.id,
            updated_at: getTimestamp(remote.updated_at),
            deleted_at: remote.deleted_at ? getTimestamp(remote.deleted_at) : null
        };

        // Server wins UNLESS local is dirty
        if (!local || !local._isDirty) {
            await AsyncStorage.setItem(key, JSON.stringify({ ...sanitizedRemote, _isDirty: false }));
        } else if (getTimestamp(sanitizedRemote.updated_at) > getTimestamp(local.updated_at)) {
            // Merge local changes onto the newer remote version
            const merged = { ...sanitizedRemote, ...local, _isDirty: true };
            await AsyncStorage.setItem(key, JSON.stringify(merged));
        }
    }
}
