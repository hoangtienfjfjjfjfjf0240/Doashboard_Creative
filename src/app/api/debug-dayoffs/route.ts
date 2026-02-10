import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
    const { data, error } = await supabase
        .from('day_offs')
        .select('id, member_name, date, reason, user_email')
        .gte('date', '2026-02-13')
        .lte('date', '2026-02-20')
        .order('member_name')
        .order('date')
        .limit(30)

    return NextResponse.json({ data, error: error?.message })
}
