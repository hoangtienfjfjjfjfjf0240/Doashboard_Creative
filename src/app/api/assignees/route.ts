import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get unique assignees from tasks
    const { data, error } = await supabase
        .from('tasks')
        .select('assignee_name')
        .not('assignee_name', 'is', null)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get unique assignees
    const uniqueAssignees = [...new Set(data.map(t => t.assignee_name))].filter(Boolean).sort()

    return NextResponse.json({ assignees: uniqueAssignees })
}
