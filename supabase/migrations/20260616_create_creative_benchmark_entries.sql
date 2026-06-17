CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
    win BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by UUID DEFAULT auth.uid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creative_benchmark_entries_app_week
    ON creative_benchmark_entries(app_id, week_start_date, sort_order);

ALTER TABLE creative_benchmark_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view creative benchmarks" ON creative_benchmark_entries;
CREATE POLICY "Authenticated users can view creative benchmarks"
    ON creative_benchmark_entries
    FOR SELECT
    TO authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can insert creative benchmarks" ON creative_benchmark_entries;
CREATE POLICY "Authenticated users can insert creative benchmarks"
    ON creative_benchmark_entries
    FOR INSERT
    TO authenticated
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Authenticated users can update creative benchmarks" ON creative_benchmark_entries;
CREATE POLICY "Authenticated users can update creative benchmarks"
    ON creative_benchmark_entries
    FOR UPDATE
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Authenticated users can delete creative benchmarks" ON creative_benchmark_entries;
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
    benchmark_market TEXT NOT NULL DEFAULT 'US/Global',
    benchmark_ctr NUMERIC DEFAULT 1.50,
    benchmark_cvr NUMERIC DEFAULT 20,
    benchmark_cpi NUMERIC DEFAULT 4,
    benchmark_cpm NUMERIC DEFAULT 12,
    created_by UUID DEFAULT auth.uid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (app_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_creative_benchmark_weekly_stats_app_week
    ON creative_benchmark_weekly_stats(app_id, week_start_date);

ALTER TABLE creative_benchmark_weekly_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view benchmark weekly stats" ON creative_benchmark_weekly_stats;
CREATE POLICY "Authenticated users can view benchmark weekly stats"
    ON creative_benchmark_weekly_stats
    FOR SELECT
    TO authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can insert benchmark weekly stats" ON creative_benchmark_weekly_stats;
CREATE POLICY "Authenticated users can insert benchmark weekly stats"
    ON creative_benchmark_weekly_stats
    FOR INSERT
    TO authenticated
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Authenticated users can update benchmark weekly stats" ON creative_benchmark_weekly_stats;
CREATE POLICY "Authenticated users can update benchmark weekly stats"
    ON creative_benchmark_weekly_stats
    FOR UPDATE
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Authenticated users can delete benchmark weekly stats" ON creative_benchmark_weekly_stats;
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

DROP POLICY IF EXISTS "Authenticated users can view benchmark apps" ON creative_benchmark_apps;
CREATE POLICY "Authenticated users can view benchmark apps"
    ON creative_benchmark_apps
    FOR SELECT
    TO authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users can insert benchmark apps" ON creative_benchmark_apps;
CREATE POLICY "Authenticated users can insert benchmark apps"
    ON creative_benchmark_apps
    FOR INSERT
    TO authenticated
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Authenticated users can update benchmark apps" ON creative_benchmark_apps;
CREATE POLICY "Authenticated users can update benchmark apps"
    ON creative_benchmark_apps
    FOR UPDATE
    TO authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Authenticated users can delete benchmark apps" ON creative_benchmark_apps;
CREATE POLICY "Authenticated users can delete benchmark apps"
    ON creative_benchmark_apps
    FOR DELETE
    TO authenticated
    USING (TRUE);

ALTER TABLE creative_benchmark_entries
    ADD COLUMN IF NOT EXISTS win BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE creative_benchmark_weekly_stats
    ADD COLUMN IF NOT EXISTS benchmark_market TEXT NOT NULL DEFAULT 'US/Global';

ALTER TABLE creative_benchmark_weekly_stats
    ADD COLUMN IF NOT EXISTS benchmark_ctr NUMERIC DEFAULT 1.50;

ALTER TABLE creative_benchmark_weekly_stats
    ADD COLUMN IF NOT EXISTS benchmark_cvr NUMERIC DEFAULT 20;

ALTER TABLE creative_benchmark_weekly_stats
    ADD COLUMN IF NOT EXISTS benchmark_cpi NUMERIC DEFAULT 4;

ALTER TABLE creative_benchmark_weekly_stats
    ADD COLUMN IF NOT EXISTS benchmark_cpm NUMERIC DEFAULT 12;
