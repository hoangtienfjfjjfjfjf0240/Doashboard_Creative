import type { SupabaseClient } from '@supabase/supabase-js'
import type { Task } from '@/lib/types'

const TASK_COLUMNS = 'id, asana_id, name, description, assignee_name, assignee_email, video_type, video_count, points, due_date, completed_at, status, tags, ctst, project_type, updated_at'
const PAGE_SIZE = 1000

export async function fetchProjectTasks(
    supabase: SupabaseClient,
    projectType: 'creative' | 'graphic'
): Promise<{ data: Task[]; error: Error | null }> {
    const allTasks: Task[] = []
    let from = 0

    while (true) {
        const { data, error } = await supabase
            .from('tasks')
            .select(TASK_COLUMNS)
            .eq('project_type', projectType)
            .order('updated_at', { ascending: false })
            .range(from, from + PAGE_SIZE - 1)

        if (error) {
            return { data: allTasks, error: error as Error }
        }

        const page = (data || []) as Task[]
        allTasks.push(...page)

        if (page.length < PAGE_SIZE) break
        from += PAGE_SIZE
    }

    return { data: allTasks, error: null }
}
