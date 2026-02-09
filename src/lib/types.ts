export interface Task {
    id: string
    asana_gid: string
    name: string
    assignee_gid: string | null
    assignee_name: string | null
    status: 'done' | 'not_done'
    completed_at: string | null
    due_date: string | null
    video_type: string | null
    quantity: number
    tags: string[]
    project_gid: string | null
    created_at: string
    updated_at: string
    // Computed
    points?: number
}

export interface Profile {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
    role: 'admin' | 'lead' | 'member'
    created_at: string
}

export interface Target {
    id: string
    user_gid: string
    week_start_date: string
    target_points: number
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

export interface PointConfig {
    video_type: string
    points: number
}

export interface DashboardFilters {
    weekStart: Date
    assignees: string[]
    status: 'all' | 'done' | 'not_done'
    videoTypes: string[]
}

export interface AssigneeStats {
    gid: string
    name: string
    totalPoints: number
    totalVideos: number
    doneTasks: number
    notDoneTasks: number
    targetPoints: number
    achievedPercent: number
    videoTypeMix: Record<string, number>
}

export interface WeeklyStats {
    totalPoints: number
    totalVideos: number
    doneTasks: number
    notDoneTasks: number
    activeAssignees: number
    avgPointsPerVideo: number
    teamTargetPoints: number
    teamAchievedPercent: number
}

export interface DailyActivity {
    date: string
    dayName: string
    points: number
    tasks: number
}
