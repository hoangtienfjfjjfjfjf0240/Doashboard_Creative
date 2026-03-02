// ──────────────────────────────────────────────────
// Shared types — single source of truth
// ──────────────────────────────────────────────────

export interface Task {
    id: string
    asana_id: string
    name: string
    description?: string | null
    assignee_name: string | null
    assignee_email: string | null
    status: 'done' | 'not_done'
    completed_at: string | null
    due_date: string | null
    video_type: string | null
    video_count: number
    points: number
    ctst: string | null
    tags: string[]
    project_gid?: string | null
    project_type?: 'creative' | 'graphic'
    created_at?: string
    updated_at?: string
    // raw_data intentionally excluded — only used server-side
}

export interface Target {
    id?: string
    user_gid: string
    week_start_date: string
    target_points: number
    project_type?: 'creative' | 'graphic'
}

export interface DayOffEntry {
    member_name: string | null
    date: string
    is_half_day: boolean
    reason?: string | null
}

export interface DueDateChange {
    task_id: string
    task_name?: string | null
    assignee_name?: string | null
    old_due_date: string | null
    new_due_date: string | null
    changed_at: string
    changed_by?: string
    reason?: string | null
    project_type?: string
}

export interface Profile {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
    role: 'admin' | 'lead' | 'manager' | 'member' | 'none'
    asana_email?: string | null
    asana_name?: string | null
    role_creative?: string
    role_graphic?: string
    created_at: string
}

export interface SyncLog {
    id: string
    started_at: string
    ended_at: string | null
    status: 'running' | 'success' | 'error'
    tasks_processed: number
    tasks_updated: number
    error_message: string | null
}

export interface UserInfo {
    email: string
    role: string
    fullName: string
    asanaEmail: string
    asanaName: string
}
