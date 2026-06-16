CREATE TABLE IF NOT EXISTS creative_benchmark_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id TEXT NOT NULL,
    week_start_date DATE NOT NULL,
    idea_name TEXT NOT NULL DEFAULT '',
    market TEXT NOT NULL DEFAULT '',
    ctr NUMERIC,
    cvr NUMERIC,
    cpi NUMERIC,
    cpm NUMERIC,
    passed BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by UUID DEFAULT auth.uid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creative_benchmark_entries_app_week
    ON creative_benchmark_entries(app_id, week_start_date, sort_order);

ALTER TABLE creative_benchmark_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view creative benchmarks"
    ON creative_benchmark_entries
    FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated users can insert creative benchmarks"
    ON creative_benchmark_entries
    FOR INSERT
    TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can update creative benchmarks"
    ON creative_benchmark_entries
    FOR UPDATE
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can delete creative benchmarks"
    ON creative_benchmark_entries
    FOR DELETE
    TO authenticated
    USING (TRUE);

CREATE TABLE IF NOT EXISTS creative_benchmark_weekly_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id TEXT NOT NULL,
    week_start_date DATE NOT NULL,
    videos_created INTEGER NOT NULL DEFAULT 0,
    funnel_one_count INTEGER NOT NULL DEFAULT 0,
    win_count INTEGER NOT NULL DEFAULT 0,
    created_by UUID DEFAULT auth.uid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (app_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_creative_benchmark_weekly_stats_app_week
    ON creative_benchmark_weekly_stats(app_id, week_start_date);

ALTER TABLE creative_benchmark_weekly_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view benchmark weekly stats"
    ON creative_benchmark_weekly_stats
    FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated users can insert benchmark weekly stats"
    ON creative_benchmark_weekly_stats
    FOR INSERT
    TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can update benchmark weekly stats"
    ON creative_benchmark_weekly_stats
    FOR UPDATE
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can delete benchmark weekly stats"
    ON creative_benchmark_weekly_stats
    FOR DELETE
    TO authenticated
    USING (TRUE);

CREATE TABLE IF NOT EXISTS creative_benchmark_apps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Tiện ích',
    meta TEXT NOT NULL DEFAULT 'App mới',
    icon_url TEXT,
    store_url TEXT,
    play_url TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    external_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by UUID DEFAULT auth.uid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE creative_benchmark_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view benchmark apps"
    ON creative_benchmark_apps
    FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Authenticated users can insert benchmark apps"
    ON creative_benchmark_apps
    FOR INSERT
    TO authenticated
    WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can update benchmark apps"
    ON creative_benchmark_apps
    FOR UPDATE
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

CREATE POLICY "Authenticated users can delete benchmark apps"
    ON creative_benchmark_apps
    FOR DELETE
    TO authenticated
    USING (TRUE);
