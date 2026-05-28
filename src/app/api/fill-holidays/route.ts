import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchAllPages } from '@/lib/supabase/fetchAllPages'

export const dynamic = 'force-dynamic'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Company holidays 2026. Weekend dates are inserted for visibility,
// while target deduction code only subtracts configured working days.
const HOLIDAYS_2026 = [
    // Tết Nguyên Đán: 13/02 - 22/02/2026
    { date: '2026-02-13', reason: 'Nghỉ Tết Nguyên Đán' },  // Fri
    { date: '2026-02-16', reason: 'Nghỉ Tết Nguyên Đán' },  // Mon
    { date: '2026-02-17', reason: 'Nghỉ Tết Nguyên Đán' },  // Tue
    { date: '2026-02-18', reason: 'Nghỉ Tết Nguyên Đán' },  // Wed
    { date: '2026-02-19', reason: 'Nghỉ Tết Nguyên Đán' },  // Thu
    { date: '2026-02-20', reason: 'Nghi Tet Nguyen Dan' }, // Fri
    // Gio To Hung Vuong & 30/04-01/05 company holiday schedule
    { date: '2026-04-25', reason: 'Nghi le Gio To Hung Vuong' }, // Sat
    { date: '2026-04-26', reason: 'Nghi le Gio To Hung Vuong' }, // Sun
    { date: '2026-04-27', reason: 'Nghi bu Gio To Hung Vuong' }, // Mon
    { date: '2026-04-30', reason: 'Nghi le 30/4' }, // Thu
    { date: '2026-05-01', reason: 'Nghi le Quoc te Lao dong' }, // Fri
    { date: '2026-05-02', reason: 'Nghi le 30/4 - 1/5' }, // Sat
    { date: '2026-05-03', reason: 'Nghi le 30/4 - 1/5' }, // Sun
    // Quốc khánh 2/9: 02/09 (Wed)
    { date: '2026-09-02', reason: 'Nghỉ lễ Quốc khánh 2/9' }, // Wed
]

interface ProfileMember {
    full_name: string | null
    asana_name: string | null
    role: string | null
    role_creative: string | null
    role_graphic: string | null
}

const hasProjectAccess = (role: string | null) => Boolean(role && role !== 'none')

export async function POST() {
    try {
        // Read every page and every current roster source for both project types.
        const [tasks, targets, profiles] = await Promise.all([
            fetchAllPages<{ assignee_name: string | null }>((from, to) =>
                supabase
                    .from('tasks')
                    .select('assignee_name')
                    .order('id', { ascending: true })
                    .range(from, to)
            ),
            fetchAllPages<{ user_gid: string | null }>((from, to) =>
                supabase
                    .from('targets')
                    .select('user_gid')
                    .order('user_gid', { ascending: true })
                    .range(from, to)
            ),
            fetchAllPages<ProfileMember>((from, to) =>
                supabase
                    .from('profiles')
                    .select('full_name, asana_name, role, role_creative, role_graphic')
                    .order('full_name', { ascending: true })
                    .range(from, to)
            ),
        ])

        const activeProfileNames = profiles
            .filter(profile =>
                !(profile.role === 'admin' && !profile.asana_name) &&
                (hasProjectAccess(profile.role_creative) || hasProjectAccess(profile.role_graphic))
            )
            .map(profile => profile.asana_name || profile.full_name)

        const uniqueMembers = [...new Set(
            [
                ...tasks.map(t => t.assignee_name),
                ...targets.map(t => t.user_gid),
                ...activeProfileNames,
            ].filter(Boolean)
        )] as string[]

        if (uniqueMembers.length === 0) {
            return NextResponse.json({ error: 'No members found' }, { status: 400 })
        }

        let totalInserted = 0
        let totalSkipped = 0

        for (const member of uniqueMembers) {
            for (const holiday of HOLIDAYS_2026) {
                // Check if day-off already exists for this member + date.
                // If a user manually added a company holiday, convert it to a system holiday
                // so it does not count as personal leave and does not double-deduct target.
                const { data: existing } = await supabase
                    .from('day_offs')
                    .select('id, user_email')
                    .eq('member_name', member)
                    .eq('date', holiday.date)
                    .maybeSingle()

                if (existing) {
                    if (existing.user_email !== 'system@holiday') {
                        const { error: updateError } = await supabase
                            .from('day_offs')
                            .update({
                                user_email: 'system@holiday',
                                reason: holiday.reason,
                                is_half_day: false,
                            })
                            .eq('id', existing.id)

                        if (updateError) {
                            console.error(`Error converting day-off for ${member} on ${holiday.date}:`, updateError.message)
                        }
                    }
                    totalSkipped++
                    continue
                }

                // Insert day-off
                const { error: insertError } = await supabase
                    .from('day_offs')
                    .insert({
                        user_email: 'system@holiday',
                        member_name: member,
                        date: holiday.date,
                        reason: holiday.reason,
                        is_half_day: false,
                    })

                if (insertError) {
                    console.error(`Error inserting day-off for ${member} on ${holiday.date}:`, insertError.message)
                } else {
                    totalInserted++
                }
            }
        }

        return NextResponse.json({
            success: true,
            members: uniqueMembers.length,
            holidays: HOLIDAYS_2026.length,
            inserted: totalInserted,
            skipped: totalSkipped,
            details: uniqueMembers.map(m => ({ member: m })),
        })
    } catch (error) {
        console.error('Fill holidays error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
