-- ============================================
-- BENCHMARKS MODULE
-- Manual weekly benchmark tracking per app
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS benchmark_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT,
    platform_focus TEXT,
    icon_emoji TEXT,
    description TEXT,
    cpi_target DECIMAL(10,2),
    cpm_target DECIMAL(10,2),
    ctr_target DECIMAL(10,2),
    cvr_target DECIMAL(10,2),
    ipm_target DECIMAL(10,2),
    cpi_target_note TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_products_name
    ON benchmark_products(name);

CREATE INDEX IF NOT EXISTS idx_benchmark_products_active
    ON benchmark_products(is_active);

DROP TRIGGER IF EXISTS benchmark_products_set_updated_at ON benchmark_products;
CREATE TRIGGER benchmark_products_set_updated_at
    BEFORE UPDATE ON benchmark_products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS benchmark_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES benchmark_products(id) ON DELETE CASCADE,
    week_label TEXT NOT NULL,
    week_start_date DATE NOT NULL,
    checked_date DATE,
    platform TEXT,
    idea_name TEXT NOT NULL,
    market TEXT,
    ctr DECIMAL(10,2),
    cvr DECIMAL(10,2),
    ipm DECIMAL(10,2),
    cpi DECIMAL(10,2),
    cpm DECIMAL(10,2),
    spend DECIMAL(12,2),
    status_note TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_entries_product_week
    ON benchmark_entries(product_id, week_start_date DESC);

CREATE INDEX IF NOT EXISTS idx_benchmark_entries_platform
    ON benchmark_entries(platform);

CREATE INDEX IF NOT EXISTS idx_benchmark_entries_market
    ON benchmark_entries(market);

DROP TRIGGER IF EXISTS benchmark_entries_set_updated_at ON benchmark_entries;
CREATE TRIGGER benchmark_entries_set_updated_at
    BEFORE UPDATE ON benchmark_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE benchmark_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "benchmark_products_select_authenticated" ON benchmark_products;
CREATE POLICY "benchmark_products_select_authenticated"
    ON benchmark_products FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "benchmark_products_insert_authenticated" ON benchmark_products;
CREATE POLICY "benchmark_products_insert_authenticated"
    ON benchmark_products FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "benchmark_products_update_authenticated" ON benchmark_products;
CREATE POLICY "benchmark_products_update_authenticated"
    ON benchmark_products FOR UPDATE
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "benchmark_products_delete_authenticated" ON benchmark_products;
CREATE POLICY "benchmark_products_delete_authenticated"
    ON benchmark_products FOR DELETE
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "benchmark_entries_select_authenticated" ON benchmark_entries;
CREATE POLICY "benchmark_entries_select_authenticated"
    ON benchmark_entries FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "benchmark_entries_insert_authenticated" ON benchmark_entries;
CREATE POLICY "benchmark_entries_insert_authenticated"
    ON benchmark_entries FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "benchmark_entries_update_authenticated" ON benchmark_entries;
CREATE POLICY "benchmark_entries_update_authenticated"
    ON benchmark_entries FOR UPDATE
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "benchmark_entries_delete_authenticated" ON benchmark_entries;
CREATE POLICY "benchmark_entries_delete_authenticated"
    ON benchmark_entries FOR DELETE
    USING (auth.role() = 'authenticated');
