import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type ProfileRow = {
    id: string
    email: string | null
    full_name: string | null
    role: string | null
    role_creative: string | null
}

type WeeklyStatsRow = {
    created_by: string | null
    created_at: string | null
}

const bangkokDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
})

function isDateKey(value: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function getCreativeRole(profile: ProfileRow) {
    return profile.role_creative || profile.role || 'none'
}

function toBangkokDateKey(value: string) {
    const date = new Date(value)
    const parts = bangkokDateFormatter.formatToParts(date)
    const year = parts.find(part => part.type === 'year')?.value
    const month = parts.find(part => part.type === 'month')?.value
    const day = parts.find(part => part.type === 'day')?.value

    if (!year || !month || !day) {
        return ''
    }

    return `${year}-${month}-${day}`
}

export async function GET(request: Request) {
    const authClient = await createServerClient()
    const { data: { user } } = await authClient.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const weekStartDate = searchParams.get('weekStartDate')

    if (!weekStartDate || !isDateKey(weekStartDate)) {
        return NextResponse.json({ error: 'Invalid weekStartDate' }, { status: 400 })
    }

    try {
        const [profilesResult, weeklyStatsResult] = await Promise.all([
            supabase
                .from('profiles')
                .select('id, email, full_name, role, role_creative')
                .order('full_name', { ascending: true }),
            supabase
                .from('creative_benchmark_weekly_stats')
                .select('created_by, created_at')
                .eq('week_start_date', weekStartDate),
        ])

        if (profilesResult.error || weeklyStatsResult.error) {
            const errorMessage = profilesResult.error?.message || weeklyStatsResult.error?.message || 'Unknown error'
            return NextResponse.json({ error: errorMessage }, { status: 500 })
        }

        const profiles = (profilesResult.data as ProfileRow[] | null) || []
        const weeklyStats = (weeklyStatsResult.data as WeeklyStatsRow[] | null) || []
        const ideaCreators = profiles.filter(profile => getCreativeRole(profile) === 'idea_creator')
        const firstSubmissionByUser = new Map<string, string>()

        for (const row of weeklyStats) {
            if (!row.created_by || !row.created_at) {
                continue
            }

            const previousSubmittedAt = firstSubmissionByUser.get(row.created_by)
            if (!previousSubmittedAt || new Date(row.created_at).getTime() < new Date(previousSubmittedAt).getTime()) {
                firstSubmissionByUser.set(row.created_by, row.created_at)
            }
        }

        let submittedCount = 0
        let onTimeCount = 0

        for (const member of ideaCreators) {
            const submittedAt = firstSubmissionByUser.get(member.id)
            if (!submittedAt) {
                continue
            }

            submittedCount += 1

            if (toBangkokDateKey(submittedAt) <= weekStartDate) {
                onTimeCount += 1
            }
        }

        const totalIdeaCreators = ideaCreators.length
        const lateCount = submittedCount - onTimeCount
        const pendingCount = Math.max(totalIdeaCreators - submittedCount, 0)

        return NextResponse.json({
            weekStartDate,
            totalIdeaCreators,
            submittedCount,
            onTimeCount,
            lateCount,
            pendingCount,
        })
    } catch (error) {
        console.error('Creative benchmark deadline stats error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
