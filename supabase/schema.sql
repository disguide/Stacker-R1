-- ============================================================
-- STACKER R1 — Complete Supabase Schema
-- ============================================================
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--
-- Architecture: "JSONB envelope" pattern
--   Each row stores the full local object in a `data` JSONB column.
--   Top-level columns (id, user_id, updated_at, deleted_at) exist
--   solely for querying/filtering — Supabase never needs to parse
--   the internal shape of your app data.
--
-- Tables Created:
--   1. tasks              — Active tasks (array, one row per task)
--   2. task_history        — Completed/archived tasks (array)
--   3. saved_sprints       — Saved sprint configurations (array)
--   4. sprint_history      — All sprint session records (array)
--   5. sprint_settings     — Timer/break preferences (singleton per user)
--   6. profiles            — User profile, goals, identity (singleton)
--   7. tags                — Tag definitions (singleton, stores array in data)
--   8. color_labels        — Color meaning mappings (singleton)
--   9. user_colors         — Color palette config (singleton)
--  10. daily_data          — Journal entries (array, one row per date)
--  11. mail                — In-app mail messages (singleton, stores array)
-- ============================================================


-- ============================================================
-- AUTO-UPDATED_AT TRIGGER FUNCTION (shared by all tables)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- HELPER: Creates a standard sync table with RLS
-- We'll call this pattern for each table below.
-- ============================================================

-- 1. TASKS
CREATE TABLE IF NOT EXISTS public.tasks (
    id          TEXT        NOT NULL,
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    data        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    PRIMARY KEY (id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tasks_sync ON public.tasks (user_id, updated_at);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "tasks_select" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE OR REPLACE TRIGGER trg_tasks_updated_at BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 2. TASK HISTORY (completed/archived tasks)
CREATE TABLE IF NOT EXISTS public.task_history (
    id          TEXT        NOT NULL,
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    data        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    PRIMARY KEY (id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_task_history_sync ON public.task_history (user_id, updated_at);
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "task_history_select" ON public.task_history FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "task_history_insert" ON public.task_history FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "task_history_update" ON public.task_history FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "task_history_delete" ON public.task_history FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE OR REPLACE TRIGGER trg_task_history_updated_at BEFORE INSERT OR UPDATE ON public.task_history FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 3. SAVED SPRINTS
CREATE TABLE IF NOT EXISTS public.saved_sprints (
    id          TEXT        NOT NULL,
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    data        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    PRIMARY KEY (id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_sprints_sync ON public.saved_sprints (user_id, updated_at);
ALTER TABLE public.saved_sprints ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "saved_sprints_select" ON public.saved_sprints FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "saved_sprints_insert" ON public.saved_sprints FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "saved_sprints_update" ON public.saved_sprints FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "saved_sprints_delete" ON public.saved_sprints FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE OR REPLACE TRIGGER trg_saved_sprints_updated_at BEFORE INSERT OR UPDATE ON public.saved_sprints FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 4. SPRINT HISTORY (all session records)
CREATE TABLE IF NOT EXISTS public.sprint_history (
    id          TEXT        NOT NULL,
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    data        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    PRIMARY KEY (id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_sprint_history_sync ON public.sprint_history (user_id, updated_at);
ALTER TABLE public.sprint_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "sprint_history_select" ON public.sprint_history FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "sprint_history_insert" ON public.sprint_history FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "sprint_history_update" ON public.sprint_history FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "sprint_history_delete" ON public.sprint_history FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE OR REPLACE TRIGGER trg_sprint_history_updated_at BEFORE INSERT OR UPDATE ON public.sprint_history FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 5. SPRINT SETTINGS (singleton per user)
CREATE TABLE IF NOT EXISTS public.sprint_settings (
    id          TEXT        NOT NULL,
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    data        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    PRIMARY KEY (id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_sprint_settings_sync ON public.sprint_settings (user_id, updated_at);
ALTER TABLE public.sprint_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "sprint_settings_select" ON public.sprint_settings FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "sprint_settings_insert" ON public.sprint_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "sprint_settings_update" ON public.sprint_settings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "sprint_settings_delete" ON public.sprint_settings FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE OR REPLACE TRIGGER trg_sprint_settings_updated_at BEFORE INSERT OR UPDATE ON public.sprint_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 6. PROFILES (singleton per user)
CREATE TABLE IF NOT EXISTS public.profiles (
    id          TEXT        NOT NULL,
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    data        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    PRIMARY KEY (id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_profiles_sync ON public.profiles (user_id, updated_at);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE OR REPLACE TRIGGER trg_profiles_updated_at BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 7. TAGS (singleton per user — stores full array in `data`)
CREATE TABLE IF NOT EXISTS public.tags (
    id          TEXT        NOT NULL,
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    data        JSONB       NOT NULL DEFAULT '[]'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    PRIMARY KEY (id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tags_sync ON public.tags (user_id, updated_at);
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "tags_select" ON public.tags FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "tags_insert" ON public.tags FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "tags_update" ON public.tags FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "tags_delete" ON public.tags FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE OR REPLACE TRIGGER trg_tags_updated_at BEFORE INSERT OR UPDATE ON public.tags FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 8. COLOR LABELS (singleton per user)
CREATE TABLE IF NOT EXISTS public.color_labels (
    id          TEXT        NOT NULL,
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    data        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    PRIMARY KEY (id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_color_labels_sync ON public.color_labels (user_id, updated_at);
ALTER TABLE public.color_labels ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "color_labels_select" ON public.color_labels FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "color_labels_insert" ON public.color_labels FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "color_labels_update" ON public.color_labels FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "color_labels_delete" ON public.color_labels FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE OR REPLACE TRIGGER trg_color_labels_updated_at BEFORE INSERT OR UPDATE ON public.color_labels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 9. USER COLORS (singleton per user — color palette)
CREATE TABLE IF NOT EXISTS public.user_colors (
    id          TEXT        NOT NULL,
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    data        JSONB       NOT NULL DEFAULT '[]'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    PRIMARY KEY (id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_user_colors_sync ON public.user_colors (user_id, updated_at);
ALTER TABLE public.user_colors ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "user_colors_select" ON public.user_colors FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "user_colors_insert" ON public.user_colors FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "user_colors_update" ON public.user_colors FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "user_colors_delete" ON public.user_colors FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE OR REPLACE TRIGGER trg_user_colors_updated_at BEFORE INSERT OR UPDATE ON public.user_colors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 10. DAILY DATA (journal entries — one row per date)
CREATE TABLE IF NOT EXISTS public.daily_data (
    id          TEXT        NOT NULL,
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    data        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    PRIMARY KEY (id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_daily_data_sync ON public.daily_data (user_id, updated_at);
ALTER TABLE public.daily_data ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "daily_data_select" ON public.daily_data FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "daily_data_insert" ON public.daily_data FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "daily_data_update" ON public.daily_data FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "daily_data_delete" ON public.daily_data FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE OR REPLACE TRIGGER trg_daily_data_updated_at BEFORE INSERT OR UPDATE ON public.daily_data FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 11. MAIL (singleton per user — stores message array in `data`)
CREATE TABLE IF NOT EXISTS public.mail (
    id          TEXT        NOT NULL,
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    data        JSONB       NOT NULL DEFAULT '[]'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    PRIMARY KEY (id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_mail_sync ON public.mail (user_id, updated_at);
ALTER TABLE public.mail ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
    CREATE POLICY "mail_select" ON public.mail FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "mail_insert" ON public.mail FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "mail_update" ON public.mail FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE POLICY "mail_delete" ON public.mail FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE OR REPLACE TRIGGER trg_mail_updated_at BEFORE INSERT OR UPDATE ON public.mail FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- DELETE USER RPC
-- ============================================================
-- Called by supabase.rpc('delete_user') from the app.
-- ON DELETE CASCADE ensures all user data is wiped.

CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS VOID AS $$
BEGIN
    DELETE FROM auth.users WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- DONE! All 11 tables created with RLS and auto-timestamps.
-- ============================================================
