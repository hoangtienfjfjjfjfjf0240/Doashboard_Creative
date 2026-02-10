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

export async function POST() {
    const members = [
        'Anh Tu Nguyen', 'DangNguyen', 'datpham', 'Đỗ Ngọc Tú', 'Hiệp MV',
        'Hoàng Tiến', 'Nguyễn Thành Trung', 'Nguyễn Vân Anh', 'Phong Dang Trung', 'Viet Pham'
    ]
    const holidays = [
        { date: '2026-02-13', reason: 'Nghỉ Tết Nguyên Đán' },
        { date: '2026-02-20', reason: 'Nghỉ Tết Nguyên Đán' },
    ]

    const rows = members.flatMap(member =>
        holidays.map(h => ({
            user_email: 'system@holiday',
            member_name: member,
            date: h.date,
            reason: h.reason,
            is_half_day: false,
        }))
    )

    const { data, error } = await supabase
        .from('day_offs')
        .upsert(rows, { onConflict: 'member_name,date' })
        .select('id')

    return NextResponse.json({
        inserted: data?.length || 0,
        error: error?.message,
    })
}
