# Architecture Plan: Friendships and Task Sharing

This document outlines the schema, sync integration, and architecture for the new 'friendships' table and 'Task Sharing' feature.

## 1. Friendships Table Schema (JSONB Envelope)

We will create a new `friendships` table adhering strictly to the JSONB envelope pattern to fit the existing sync engine.

### Table Structure
*   `id`: `TEXT` (Composite ID: `min(uid1,uid2)_max(uid1,uid2)` to prevent duplicate relationships).
*   `user_id`: `UUID` (The initiator of the friend request).
*   `data`: `JSONB` containing `{ friend_id: "uuid", status: "pending" | "accepted" | "blocked", initiator_id: "uuid" }`.
*   `updated_at`, `deleted_at`: Standard timestamp columns.

### RLS Policies
*   **Select**: `USING (auth.uid() = user_id OR auth.uid()::text = data->>'friend_id')`
*   **Insert**: `WITH CHECK (auth.uid() = user_id)` (Only the initiator can create).
*   **Update**: `USING (auth.uid() = user_id OR auth.uid()::text = data->>'friend_id')`
*   **Delete**: `USING (auth.uid() = user_id OR auth.uid()::text = data->>'friend_id')`

### Sync Integration
*   Added to `SYNC_TABLES` as an 'array' type mapping.
*   `pullFromCloud` will fetch rows where `user_id = myId OR data->>friend_id = myId`.
*   **CRITICAL FIX for Split-Brain:** In `SyncService.pushToCloud`, when syncing `friendships`, we must preserve the original `user_id` (the initiator) instead of blindly using the syncing user's ID. We will extract `initiator_id` from the `data` payload and fall back to `userId` only if it doesn't exist: `user_id: data.owner_id || data.initiator_id || userId`.

## 2. Task Sharing Architecture

### How are tasks shared?
Sharing metadata is added directly to the existing `tasks` JSONB data.
*   `owner_id`: `string` (Identifies the creator/owner).
*   `shared_users`: `string[]` (Array of UUIDs, optimized for PostgREST `.cs` "contains" queries).
*   `shared_permissions`: `Record<string, 'view' | 'edit'>` (Maps a user's UUID to their permission level).

### How does the sync engine handle updates?
*   **Pull (`pullFromCloud`)**: Modify the query for `tasks` to pull both owned and shared tasks: `.or('user_id.eq.${userId},data->shared_users.cs.["${userId}"]')`
*   **Push (`pushToCloud`)**: Use `user_id: data.owner_id || userId` to push the update to the host's original database row.

### Permissions Management
*   **Database (RLS)**:
    *   **CRITICAL FIX for Upsert Failure**: The `tasks` table `INSERT` policy must be expanded: `WITH CHECK (auth.uid() = user_id OR (data->'shared_permissions'->>auth.uid()::text) = 'edit')`. This allows guests to successfully `upsert` their edits back to the host's row.
    *   The `tasks` `UPDATE` policy remains: `USING (auth.uid() = user_id OR (data->'shared_permissions'->>auth.uid()::text) = 'edit')`.
*   **Client**: The UI will read `shared_permissions[myUserId]` and disable mutating actions if 'view'.
