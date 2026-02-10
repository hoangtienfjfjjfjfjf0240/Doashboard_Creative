import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Use service role for server-side operations
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ASANA_API_BASE = 'https://app.asana.com/api/1.0'

// Video Creative point config
const CREATIVE_POINT_CONFIG: Record<string, number> = {
    S1: 3, S2A: 2, S2B: 2.5, S3A: 2,
    S3B: 5, S4: 5, S5: 6, S6: 7,
    S7: 10, S8: 48, S9A: 2.5, S9B: 4, S9C: 7, S10A: 1,
}

// Graphic Design point config — keys must match Asana "Asset" enum values exactly
const DESIGN_POINT_CONFIG: Record<string, number> = {
    'Research Doc': 12,           // S1
    'ScreenShot': 24,             // S2
    'Icon': 2,                    // S3
    'Cover, Promotional Content': 12,  // S4
    'Localize Screenshot': 6,     // S5
    'Localize': 6,                // S5 alternate name
    'Deep Localize': 24,          // S6 (Deep Localization)
    'Deep Localization': 24,      // S6 alternate name
}

interface AsanaTask {
    gid: string
    name: string
    completed: boolean
    completed_at: string | null
    due_on: string | null
    notes: string | null
    assignee: { gid: string; name: string; email?: string } | null
    custom_fields: Array<{
        name: string
        display_value: string | null
        number_value: number | null
        enum_value: { name: string } | null
    }>
    tags: Array<{ name: string }>
}

type ProjectType = 'creative' | 'graphic'

function getProjectConfig(projectType: ProjectType) {
    if (projectType === 'graphic') {
        return {
            projectId: process.env.ASANA_GRAPHIC_PROJECT_ID,
            pointConfig: DESIGN_POINT_CONFIG,
            // Graphic Design uses 'Asset' as the type field, 'Số lượng' as quantity
            typeFieldNames: ['asset', 'asset type', 'loại asset'],
            quantityFieldNames: ['số lượng', 'quantity', 'count', 'qty', 'so luong'],
            // No CTST for graphic
            hasCTST: false,
        }
    }
    return {
        projectId: process.env.ASANA_PROJECT_ID,
        pointConfig: CREATIVE_POINT_CONFIG,
        typeFieldNames: ['video type', 'videotype', 'type'],
        quantityFieldNames: ['quantity', 'count', 'qty'],
        hasCTST: true,
    }
}

async function fetchAsanaTasks(projectId: string): Promise<AsanaTask[]> {
    const token = process.env.ASANA_ACCESS_TOKEN
    if (!token) throw new Error('ASANA_ACCESS_TOKEN is not configured')

    const allTasks: AsanaTask[] = []
    let offset: string | undefined

    do {
        const url = new URL(`${ASANA_API_BASE}/projects/${projectId}/tasks`)
        url.searchParams.set('opt_fields', 'gid,name,notes,completed,completed_at,due_on,assignee,assignee.name,assignee.email,custom_fields,custom_fields.name,custom_fields.display_value,custom_fields.number_value,custom_fields.enum_value,tags,tags.name')
        url.searchParams.set('limit', '100')
        // Include completed tasks from the last 30 days so we can detect done/undone changes
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        url.searchParams.set('completed_since', thirtyDaysAgo)
        if (offset) url.searchParams.set('offset', offset)

        const response = await fetch(url.toString(), {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
            },
            cache: 'no-store',
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Asana API error: ${response.status} - ${errorText}`)
        }

        const data = await response.json()
        allTasks.push(...data.data)
        offset = data.next_page?.offset
    } while (offset)

    return allTasks
}

async function syncProject(projectType: ProjectType): Promise<{ processed: number; updated: number }> {
    const config = getProjectConfig(projectType)

    if (!config.projectId) {
        throw new Error(`Missing Asana project ID for ${projectType}`)
    }

    const fetchStart = Date.now()
    const asanaTasks = await fetchAsanaTasks(config.projectId)
    console.log(`[Sync ${projectType}] Fetched ${asanaTasks.length} tasks from Asana in ${Date.now() - fetchStart}ms`)

    // ── Step 1: Fetch ALL existing tasks in ONE batch query ──
    const { data: existingTasksData } = await supabase
        .from('tasks')
        .select('asana_id, due_date, name, assignee_name')
        .eq('project_type', projectType)

    // Build a lookup map for O(1) access
    const existingMap = new Map<string, { due_date: string | null; name: string; assignee_name: string | null }>()
    if (existingTasksData) {
        existingTasksData.forEach(t => existingMap.set(t.asana_id, t))
    }

    // ── Step 2: Transform all Asana tasks in memory ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allTaskData: any[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dueDateChanges: any[] = []

    for (const task of asanaTasks) {
        const typeField = task.custom_fields?.find(f => {
            const name = f.name.toLowerCase()
            return config.typeFieldNames.some(tf => name.includes(tf) || name === tf)
        })
        const videoType = typeField?.enum_value?.name || typeField?.display_value || null

        const quantityField = task.custom_fields?.find(f => {
            const name = f.name.toLowerCase()
            return config.quantityFieldNames.some(qf => name.includes(qf) || name === qf)
        })
        const videoCount = Math.max(1, quantityField?.number_value || 1)

        let ctst: string | null = null
        if (config.hasCTST) {
            const ctstField = task.custom_fields?.find(
                f => f.name.toLowerCase() === 'ctst' ||
                    f.name.toLowerCase().includes('creative tool')
            )
            ctst = ctstField?.enum_value?.name || ctstField?.display_value || null
        }

        const progressField = task.custom_fields?.find(
            f => f.name.toLowerCase().trim() === 'progress' ||
                f.name.toLowerCase().trim() === 'status' ||
                f.name.toLowerCase().trim() === 'trạng thái'
        )
        const progressValue = progressField?.enum_value?.name?.toLowerCase() ||
            progressField?.display_value?.toLowerCase() || ''
        const isProgressDone = progressValue === 'done' || progressValue === 'hoàn thành'
        const isDone = task.completed || isProgressDone

        let completedAt = task.completed_at
        if (!completedAt && isDone) {
            const completedDateField = task.custom_fields?.find(
                f => f.name.toLowerCase().includes('completed date') ||
                    f.name.toLowerCase().includes('ngày hoàn thành')
            )
            completedAt = completedDateField?.display_value || new Date().toISOString()
        }

        const points = videoType ? (config.pointConfig[videoType] || 0) * videoCount : 0

        const taskData = {
            asana_id: task.gid,
            name: task.name,
            description: task.notes || null,
            assignee_name: task.assignee?.name || null,
            assignee_email: task.assignee?.email || null,
            status: isDone ? 'done' : 'not_done',
            completed_at: completedAt,
            due_date: task.due_on,
            video_type: videoType,
            video_count: videoCount,
            points: points,
            ctst: ctst,
            tags: task.tags?.map(t => t.name) || [],
            raw_data: task,
            project_type: projectType,
            updated_at: new Date().toISOString(),
        }

        allTaskData.push(taskData)

        // Track due date changes in memory (no DB call here)
        const existing = existingMap.get(task.gid)
        if (existing && existing.due_date !== taskData.due_date) {
            dueDateChanges.push({
                task_id: task.gid,
                task_name: taskData.name,
                assignee_name: taskData.assignee_name,
                old_due_date: existing.due_date,
                new_due_date: taskData.due_date,
                changed_by: 'Asana Sync',
                reason: `Due date changed in Asana (${projectType})`,
                project_type: projectType,
            })
        }
    }

    // ── Step 3: Batch insert due date changes (1 query) ──
    if (dueDateChanges.length > 0) {
        await supabase.from('due_date_changes').insert(dueDateChanges)
    }

    // ── Step 4: Batch upsert ALL tasks (in chunks of 500) ──
    let tasksUpdated = 0
    const CHUNK_SIZE = 500
    const dbStart = Date.now()
    for (let i = 0; i < allTaskData.length; i += CHUNK_SIZE) {
        const chunk = allTaskData.slice(i, i + CHUNK_SIZE)
        const { error } = await supabase
            .from('tasks')
            .upsert(chunk, { onConflict: 'asana_id' })

        if (error) {
            console.error(`[Sync] Batch upsert error (chunk ${i / CHUNK_SIZE}):`, error.message)
        } else {
            tasksUpdated += chunk.length
        }
    }

    // ── Step 5: Clean up stale tasks (1 query) ──
    const asanaGids = new Set(asanaTasks.map(t => t.gid))
    if (existingTasksData) {
        const staleIds = existingTasksData
            .filter(t => !asanaGids.has(t.asana_id))
            .map(t => t.asana_id)

        if (staleIds.length > 0) {
            await supabase.from('tasks').delete().in('asana_id', staleIds)
        }
    }

    console.log(`[Sync ${projectType}] DB operations completed in ${Date.now() - dbStart}ms (${tasksUpdated} tasks upserted)`)

    return { processed: asanaTasks.length, updated: tasksUpdated }
}

export async function POST(request: NextRequest) {
    const startTime = new Date()

    // Determine which project(s) to sync
    const { searchParams } = new URL(request.url)
    const projectParam = searchParams.get('project') as ProjectType | 'all' | null
    const projectsToSync: ProjectType[] = projectParam === 'graphic'
        ? ['graphic']
        : projectParam === 'creative'
            ? ['creative']
            : ['creative', 'graphic'] // default: sync both

    // Create sync log (optional - don't block sync if this fails)
    const { data: syncLog } = await supabase
        .from('sync_logs')
        .insert({
            started_at: startTime.toISOString(),
            status: 'running',
            tasks_processed: 0,
            tasks_updated: 0,
        })
        .select()
        .single()

    try {
        let totalProcessed = 0
        let totalUpdated = 0
        const results: Record<string, { processed: number; updated: number }> = {}
        const errors: string[] = []

        for (const projectType of projectsToSync) {
            try {
                const result = await syncProject(projectType)
                results[projectType] = result
                totalProcessed += result.processed
                totalUpdated += result.updated
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : 'Unknown error'
                console.error(`Error syncing ${projectType}:`, errMsg)
                errors.push(`${projectType}: ${errMsg}`)
                results[projectType] = { processed: 0, updated: 0 }
            }
        }

        const hasErrors = errors.length > 0
        const status = hasErrors && totalProcessed === 0 ? 'error' : hasErrors ? 'partial' : 'success'

        // Update sync log if it was created
        if (syncLog) {
            await supabase
                .from('sync_logs')
                .update({
                    ended_at: new Date().toISOString(),
                    status: status,
                    tasks_processed: totalProcessed,
                    tasks_updated: totalUpdated,
                    error_message: hasErrors ? errors.join('; ') : null,
                })
                .eq('id', syncLog.id)
        }

        return NextResponse.json({
            success: !hasErrors || totalProcessed > 0,
            projects: results,
            tasksProcessed: totalProcessed,
            tasksUpdated: totalUpdated,
            duration: Date.now() - startTime.getTime(),
            errors: hasErrors ? errors : undefined,
        })

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'

        if (syncLog) {
            await supabase
                .from('sync_logs')
                .update({
                    ended_at: new Date().toISOString(),
                    status: 'error',
                    error_message: message,
                })
                .eq('id', syncLog.id)
        }

        return NextResponse.json({ error: message }, { status: 500 })
    }
}

export async function GET() {
    // Get latest sync status
    const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(5)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ logs: data })
}
