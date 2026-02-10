import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// All Vietnamese national holidays 2026 (working days only, no Sat/Sun)
const HOLIDAYS_2026 = [
    // Tết Nguyên Đán: 13/02 - 22/02/2026
    { date: '2026-02-13', reason: 'Nghỉ Tết Nguyên Đán' },  // Fri
    { date: '2026-02-16', reason: 'Nghỉ Tết Nguyên Đán' },  // Mon
    { date: '2026-02-17', reason: 'Nghỉ Tết Nguyên Đán' },  // Tue
    { date: '2026-02-18', reason: 'Nghỉ Tết Nguyên Đán' },  // Wed
    { date: '2026-02-19', reason: 'Nghỉ Tết Nguyên Đán' },  // Thu
    { date: '2026-02-20', reason: 'Nghỉ Tết Nguyên Đán' },  // Fri
    // Giỗ Tổ Hùng Vương 10/3 âm lịch = 06/04/2026 (Mon)
    { date: '2026-04-06', reason: 'Giỗ Tổ Hùng Vương' },    // Mon
    // 30/4 - 1/5: 30/04 (Thu) - 03/05 (Sun)
    { date: '2026-04-30', reason: 'Nghỉ lễ 30/4' },          // Thu
    { date: '2026-05-01', reason: 'Nghỉ lễ Quốc tế Lao động' }, // Fri
    // Quốc khánh 2/9: 02/09 (Wed)
    { date: '2026-09-02', reason: 'Nghỉ lễ Quốc khánh 2/9' }, // Wed
]

export async function POST() {
    try {
        // Get all unique member names from tasks (both creative and graphic)
        const { data: tasks, error: tasksError } = await supabase
            .from('tasks')
            .select('assignee_name')

        if (tasksError) {
            return NextResponse.json({ error: tasksError.message }, { status: 500 })
        }

        const uniqueMembers = [...new Set(
            (tasks || []).map(t => t.assignee_name).filter(Boolean)
        )] as string[]

        if (uniqueMembers.length === 0) {
            return NextResponse.json({ error: 'No members found' }, { status: 400 })
        }

        let totalInserted = 0
        let totalSkipped = 0

        for (const member of uniqueMembers) {
            for (const holiday of HOLIDAYS_2026) {
                // Check if day-off already exists for this member + date
                const { data: existing } = await supabase
                    .from('day_offs')
                    .select('id')
                    .eq('member_name', member)
                    .eq('date', holiday.date)
                    .maybeSingle()

                if (existing) {
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
