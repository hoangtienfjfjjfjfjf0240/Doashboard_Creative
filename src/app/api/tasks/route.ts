import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { startOfWeek, endOfWeek, parseISO, format } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const supabase = await createClient()

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const weekStartStr = searchParams.get('weekStart')
    const assignees = searchParams.get('assignees')?.split(',').filter(Boolean) || []
    const status = searchParams.get('status') || 'all'
    const videoTypes = searchParams.get('videoTypes')?.split(',').filter(Boolean) || []

    // Build query
    let query = supabase.from('tasks').select('*')

    // Filter by status
    if (status === 'done') {
        query = query.eq('status', 'done')
    } else if (status === 'not_done') {
        query = query.eq('status', 'not_done')
    }

    // Filter by week (for done tasks, use completed_at; for not done, use due_date)
    if (weekStartStr) {
        const weekStart = parseISO(weekStartStr)
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
        const weekStartFormatted = format(weekStart, 'yyyy-MM-dd')
        const weekEndFormatted = format(weekEnd, 'yyyy-MM-dd')

        if (status === 'done') {
            query = query
                .gte('completed_at', `${weekStartFormatted}T00:00:00`)
                .lte('completed_at', `${weekEndFormatted}T23:59:59`)
        } else if (status === 'not_done') {
            query = query
                .gte('due_date', weekStartFormatted)
                .lte('due_date', weekEndFormatted)
        }
        // For 'all', we don't filter by date to show everything
    }

    // Filter by assignees
    if (assignees.length > 0) {
        query = query.in('assignee_name', assignees)
    }

    // Filter by video types
    if (videoTypes.length > 0) {
        query = query.in('video_type', videoTypes)
    }

    // Execute query
    const { data, error } = await query.order('updated_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tasks: data })
}
