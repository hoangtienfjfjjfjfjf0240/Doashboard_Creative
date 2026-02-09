import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const weekStart = searchParams.get('weekStart')

    let query = supabase.from('targets').select('*')

    if (weekStart) {
        query = query.eq('week_start_date', weekStart)
    }

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ targets: data })
}

export async function POST(request: NextRequest) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin/lead
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || !['admin', 'lead'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { user_gid, week_start_date, target_points } = body

    if (!user_gid || !week_start_date || target_points === undefined) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Upsert target
    const { data, error } = await supabase
        .from('targets')
        .upsert({
            user_gid,
            week_start_date,
            target_points,
        }, {
            onConflict: 'user_gid,week_start_date'
        })
        .select()
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ target: data })
}
