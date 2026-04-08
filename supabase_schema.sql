-- Supabase Schema for Stacker R1 Offline-First Sync Architecture

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Function to automatically update the 'updated_at' column (optional, but good practice)
-- Actually, the architecture specifies using milliseconds since epoch for easy JS comparison.
-- So we won't use traditional Postgres triggers for updated_at, we'll let the client push it or use BigInt.

-------------------------------------------------------------------------------
-- 1. PROFILES
-------------------------------------------------------------------------------
CREATE TABLE profiles (
    id VARCHAR PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    updated_at BIGINT NOT NULL,
    deleted_at BIGINT,
    data JSONB NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profiles" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profiles" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profiles" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own profiles" ON profiles FOR DELETE USING (auth.uid() = user_id);

-------------------------------------------------------------------------------
-- 2. TASKS (Active and History)
-------------------------------------------------------------------------------
CREATE TABLE tasks (
    id VARCHAR PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    updated_at BIGINT NOT NULL,
    deleted_at BIGINT,
    data JSONB NOT NULL
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON tasks FOR DELETE USING (auth.uid() = user_id);

-------------------------------------------------------------------------------
-- 3. DAILY DATA
-------------------------------------------------------------------------------
CREATE TABLE daily_data (
    id VARCHAR PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    updated_at BIGINT NOT NULL,
    deleted_at BIGINT,
    data JSONB NOT NULL
);

ALTER TABLE daily_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily_data" ON daily_data FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily_data" ON daily_data FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily_data" ON daily_data FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own daily_data" ON daily_data FOR DELETE USING (auth.uid() = user_id);

-------------------------------------------------------------------------------
-- 4. SPRINT SETTINGS
-------------------------------------------------------------------------------
CREATE TABLE sprint_settings (
    id VARCHAR PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    updated_at BIGINT NOT NULL,
    deleted_at BIGINT,
    data JSONB NOT NULL
);

ALTER TABLE sprint_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sprint_settings" ON sprint_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sprint_settings" ON sprint_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sprint_settings" ON sprint_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sprint_settings" ON sprint_settings FOR DELETE USING (auth.uid() = user_id);

-------------------------------------------------------------------------------
-- 5. SAVED SPRINTS
-------------------------------------------------------------------------------
CREATE TABLE saved_sprints (
    id VARCHAR PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    updated_at BIGINT NOT NULL,
    deleted_at BIGINT,
    data JSONB NOT NULL
);

ALTER TABLE saved_sprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved_sprints" ON saved_sprints FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own saved_sprints" ON saved_sprints FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own saved_sprints" ON saved_sprints FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved_sprints" ON saved_sprints FOR DELETE USING (auth.uid() = user_id);

-------------------------------------------------------------------------------
-- 6. SPRINT HISTORY
-------------------------------------------------------------------------------
CREATE TABLE sprint_history (
    id VARCHAR PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    updated_at BIGINT NOT NULL,
    deleted_at BIGINT,
    data JSONB NOT NULL
);

ALTER TABLE sprint_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sprint_history" ON sprint_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sprint_history" ON sprint_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sprint_history" ON sprint_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sprint_history" ON sprint_history FOR DELETE USING (auth.uid() = user_id);

-------------------------------------------------------------------------------
-- 7. USER COLORS & TAGS
-------------------------------------------------------------------------------
CREATE TABLE user_colors_tags (
    id VARCHAR PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    updated_at BIGINT NOT NULL,
    deleted_at BIGINT,
    data JSONB NOT NULL
);

ALTER TABLE user_colors_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own user_colors_tags" ON user_colors_tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own user_colors_tags" ON user_colors_tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own user_colors_tags" ON user_colors_tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own user_colors_tags" ON user_colors_tags FOR DELETE USING (auth.uid() = user_id);

-- Indexes for performance (especially querying by updated_at for sync)
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);
CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);
CREATE INDEX IF NOT EXISTS idx_daily_data_updated_at ON daily_data(updated_at);
CREATE INDEX IF NOT EXISTS idx_sprint_settings_updated_at ON sprint_settings(updated_at);
CREATE INDEX IF NOT EXISTS idx_saved_sprints_updated_at ON saved_sprints(updated_at);
CREATE INDEX IF NOT EXISTS idx_sprint_history_updated_at ON sprint_history(updated_at);
CREATE INDEX IF NOT EXISTS idx_user_colors_tags_updated_at ON user_colors_tags(updated_at);
