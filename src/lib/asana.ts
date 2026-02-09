// Asana API wrapper (server-side only)

const ASANA_API_BASE = 'https://app.asana.com/api/1.0'

interface AsanaTask {
    gid: string
    name: string
    completed: boolean
    completed_at: string | null
    due_on: string | null
    assignee: {
        gid: string
        name: string
    } | null
    custom_fields: Array<{
        gid: string
        name: string
        display_value: string | null
        number_value: number | null
        enum_value: {
            gid: string
            name: string
        } | null
    }>
    tags: Array<{
        gid: string
        name: string
    }>
}

interface AsanaResponse<T> {
    data: T
    next_page?: {
        offset: string
        path: string
        uri: string
    }
}

export async function fetchAsanaTasks(projectId: string): Promise<AsanaTask[]> {
    const token = process.env.ASANA_ACCESS_TOKEN
    if (!token) {
        throw new Error('ASANA_ACCESS_TOKEN is not configured')
    }

    const allTasks: AsanaTask[] = []
    let offset: string | undefined

    do {
        const url = new URL(`${ASANA_API_BASE}/projects/${projectId}/tasks`)
        url.searchParams.set('opt_fields', 'gid,name,completed,completed_at,due_on,assignee,assignee.name,custom_fields,custom_fields.name,custom_fields.display_value,custom_fields.number_value,custom_fields.enum_value,tags,tags.name')
        url.searchParams.set('limit', '100')
        if (offset) {
            url.searchParams.set('offset', offset)
        }

        const response = await fetch(url.toString(), {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
            },
        })

        if (!response.ok) {
            const error = await response.text()
            throw new Error(`Asana API error: ${response.status} - ${error}`)
        }

        const data: AsanaResponse<AsanaTask[]> = await response.json()
        allTasks.push(...data.data)
        offset = data.next_page?.offset
    } while (offset)

    return allTasks
}

export function mapAsanaTaskToDb(task: AsanaTask, projectGid: string) {
    // Find Video Type custom field
    const videoTypeField = task.custom_fields?.find(
        f => f.name.toLowerCase().includes('video type') ||
            f.name.toLowerCase().includes('videotype') ||
            f.name.toLowerCase() === 'type'
    )
    const videoType = videoTypeField?.enum_value?.name ||
        videoTypeField?.display_value ||
        null

    // Find Quantity custom field
    const quantityField = task.custom_fields?.find(
        f => f.name.toLowerCase().includes('quantity') ||
            f.name.toLowerCase().includes('count') ||
            f.name.toLowerCase() === 'qty'
    )
    const quantity = quantityField?.number_value || 1

    return {
        asana_gid: task.gid,
        name: task.name,
        assignee_gid: task.assignee?.gid || null,
        assignee_name: task.assignee?.name || null,
        status: task.completed ? 'done' : 'not_done',
        completed_at: task.completed_at,
        due_date: task.due_on,
        video_type: videoType,
        quantity: Math.max(1, quantity),
        tags: task.tags?.map(t => t.name) || [],
        project_gid: projectGid,
    }
}

export async function testAsanaConnection(): Promise<{ success: boolean; message: string }> {
    const token = process.env.ASANA_ACCESS_TOKEN
    const projectId = process.env.ASANA_PROJECT_ID

    if (!token) {
        return { success: false, message: 'ASANA_ACCESS_TOKEN is not configured' }
    }
    if (!projectId) {
        return { success: false, message: 'ASANA_PROJECT_ID is not configured' }
    }

    try {
        const response = await fetch(`${ASANA_API_BASE}/projects/${projectId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
            },
        })

        if (!response.ok) {
            return { success: false, message: `Cannot access project: ${response.status}` }
        }

        const data = await response.json()
        return { success: true, message: `Connected to project: ${data.data.name}` }
    } catch (error) {
        return { success: false, message: `Connection failed: ${error}` }
    }
}
