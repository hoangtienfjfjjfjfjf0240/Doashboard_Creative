ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS role_dashboard TEXT;

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS role_benchmark TEXT;

UPDATE profiles
SET
    role_dashboard = COALESCE(NULLIF(role_dashboard, ''), NULLIF(role_creative, ''), NULLIF(role, ''), 'member'),
    role_benchmark = COALESCE(NULLIF(role_benchmark, ''), NULLIF(role_creative, ''), NULLIF(role, ''), 'member')
WHERE role_dashboard IS NULL
   OR role_dashboard = ''
   OR role_benchmark IS NULL
   OR role_benchmark = '';

ALTER TABLE profiles
    ALTER COLUMN role_dashboard SET DEFAULT 'member';

ALTER TABLE profiles
    ALTER COLUMN role_benchmark SET DEFAULT 'member';

DROP POLICY IF EXISTS "Authenticated users can view creative benchmarks" ON creative_benchmark_entries;
DROP POLICY IF EXISTS "Authenticated users can insert creative benchmarks" ON creative_benchmark_entries;
DROP POLICY IF EXISTS "Authenticated users can update creative benchmarks" ON creative_benchmark_entries;
DROP POLICY IF EXISTS "Authenticated users can delete creative benchmarks" ON creative_benchmark_entries;
DROP POLICY IF EXISTS "Benchmark users can view creative benchmarks" ON creative_benchmark_entries;
DROP POLICY IF EXISTS "Benchmark users can insert creative benchmarks" ON creative_benchmark_entries;
DROP POLICY IF EXISTS "Benchmark users can update creative benchmarks" ON creative_benchmark_entries;
DROP POLICY IF EXISTS "Benchmark users can delete creative benchmarks" ON creative_benchmark_entries;

CREATE POLICY "Benchmark users can view creative benchmarks"
    ON creative_benchmark_entries
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND (
                  profiles.role = 'admin'
                  OR COALESCE(profiles.role_benchmark, profiles.role_creative, profiles.role) <> 'none'
              )
        )
    );

CREATE POLICY "Benchmark users can insert creative benchmarks"
    ON creative_benchmark_entries
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND (
                  profiles.role = 'admin'
                  OR COALESCE(profiles.role_benchmark, profiles.role_creative, profiles.role) <> 'none'
              )
        )
    );

CREATE POLICY "Benchmark users can update creative benchmarks"
    ON creative_benchmark_entries
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND (
                  profiles.role = 'admin'
                  OR COALESCE(profiles.role_benchmark, profiles.role_creative, profiles.role) <> 'none'
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND (
                  profiles.role = 'admin'
                  OR COALESCE(profiles.role_benchmark, profiles.role_creative, profiles.role) <> 'none'
              )
        )
    );

CREATE POLICY "Benchmark users can delete creative benchmarks"
    ON creative_benchmark_entries
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND (
                  profiles.role = 'admin'
                  OR COALESCE(profiles.role_benchmark, profiles.role_creative, profiles.role) <> 'none'
              )
        )
    );

DROP POLICY IF EXISTS "Authenticated users can view benchmark weekly stats" ON creative_benchmark_weekly_stats;
DROP POLICY IF EXISTS "Authenticated users can insert benchmark weekly stats" ON creative_benchmark_weekly_stats;
DROP POLICY IF EXISTS "Authenticated users can update benchmark weekly stats" ON creative_benchmark_weekly_stats;
DROP POLICY IF EXISTS "Authenticated users can delete benchmark weekly stats" ON creative_benchmark_weekly_stats;
DROP POLICY IF EXISTS "Benchmark users can view weekly stats" ON creative_benchmark_weekly_stats;
DROP POLICY IF EXISTS "Benchmark users can insert weekly stats" ON creative_benchmark_weekly_stats;
DROP POLICY IF EXISTS "Benchmark users can update weekly stats" ON creative_benchmark_weekly_stats;
DROP POLICY IF EXISTS "Benchmark users can delete weekly stats" ON creative_benchmark_weekly_stats;

CREATE POLICY "Benchmark users can view weekly stats"
    ON creative_benchmark_weekly_stats
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND (
                  profiles.role = 'admin'
                  OR COALESCE(profiles.role_benchmark, profiles.role_creative, profiles.role) <> 'none'
              )
        )
    );

CREATE POLICY "Benchmark users can insert weekly stats"
    ON creative_benchmark_weekly_stats
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND (
                  profiles.role = 'admin'
                  OR COALESCE(profiles.role_benchmark, profiles.role_creative, profiles.role) <> 'none'
              )
        )
    );

CREATE POLICY "Benchmark users can update weekly stats"
    ON creative_benchmark_weekly_stats
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND (
                  profiles.role = 'admin'
                  OR COALESCE(profiles.role_benchmark, profiles.role_creative, profiles.role) <> 'none'
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND (
                  profiles.role = 'admin'
                  OR COALESCE(profiles.role_benchmark, profiles.role_creative, profiles.role) <> 'none'
              )
        )
    );

CREATE POLICY "Benchmark users can delete weekly stats"
    ON creative_benchmark_weekly_stats
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND (
                  profiles.role = 'admin'
                  OR COALESCE(profiles.role_benchmark, profiles.role_creative, profiles.role) <> 'none'
              )
        )
    );

DROP POLICY IF EXISTS "Authenticated users can view benchmark apps" ON creative_benchmark_apps;
DROP POLICY IF EXISTS "Authenticated users can insert benchmark apps" ON creative_benchmark_apps;
DROP POLICY IF EXISTS "Authenticated users can update benchmark apps" ON creative_benchmark_apps;
DROP POLICY IF EXISTS "Authenticated users can delete benchmark apps" ON creative_benchmark_apps;
DROP POLICY IF EXISTS "Benchmark users can view apps" ON creative_benchmark_apps;
DROP POLICY IF EXISTS "Benchmark managers can insert apps" ON creative_benchmark_apps;
DROP POLICY IF EXISTS "Benchmark managers can update apps" ON creative_benchmark_apps;
DROP POLICY IF EXISTS "Benchmark managers can delete apps" ON creative_benchmark_apps;

CREATE POLICY "Benchmark users can view apps"
    ON creative_benchmark_apps
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND (
                  profiles.role = 'admin'
                  OR COALESCE(profiles.role_benchmark, profiles.role_creative, profiles.role) <> 'none'
              )
        )
    );

CREATE POLICY "Benchmark managers can insert apps"
    ON creative_benchmark_apps
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND (
                  profiles.role = 'admin'
                  OR COALESCE(profiles.role_benchmark, profiles.role_creative, profiles.role) IN ('admin', 'manager')
              )
        )
    );

CREATE POLICY "Benchmark managers can update apps"
    ON creative_benchmark_apps
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND (
                  profiles.role = 'admin'
                  OR COALESCE(profiles.role_benchmark, profiles.role_creative, profiles.role) IN ('admin', 'manager')
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND (
                  profiles.role = 'admin'
                  OR COALESCE(profiles.role_benchmark, profiles.role_creative, profiles.role) IN ('admin', 'manager')
              )
        )
    );

CREATE POLICY "Benchmark managers can delete apps"
    ON creative_benchmark_apps
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND (
                  profiles.role = 'admin'
                  OR COALESCE(profiles.role_benchmark, profiles.role_creative, profiles.role) IN ('admin', 'manager')
              )
        )
    );

NOTIFY pgrst, 'reload schema';
