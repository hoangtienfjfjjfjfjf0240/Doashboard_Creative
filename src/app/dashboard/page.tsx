'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { startOfWeek, format, addDays, subMonths, subDays, getWeek } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { LogOut } from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import {
    FilterBar,
    KPICards,
    VideoTypeMixChart,
    StatusDonut,
    Leaderboard,
    TaskTable,
    DueDateStats,
    DailyPointsChart,
    CTSTChart,
} from '@/components/dashboard'

interface Task {
    id: string
    asana_id: string
    name: string
    assignee_name: string | null
    assignee_email: string | null
    video_type: string | null
    video_count: number
    points: number
    due_date: string | null
    completed_at: string | null
    status: 'done' | 'not_done'
    tags: string[]
    ctst: string | null
}

interface Target {
    user_gid: string
    week_start_date: string
    target_points: number
}

const POINT_CONFIG: Record<string, number> = {
    S1: 3, S2A: 2, S2B: 2.5, S3A: 2,
    S3B: 5, S4: 5, S5: 6, S6: 7,
    S7: 10, S8: 48, S9A: 2.5, S9B: 4, S9C: 7, S10A: 1,
}

interface DayOffEntry {
    member_name: string | null
    date: string
    is_half_day: boolean
}

const WORKING_DAYS_PER_WEEK = 4

export default function DashboardPage() {
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])

    // State
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const initialLoadDone = useRef(false)
    const [lastSync, setLastSync] = useState<string>()
    const [user, setUser] = useState<{ email: string; role: string; fullName: string; asanaEmail: string; asanaName: string } | null>(null)

    // Filter state
    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
    const [selectedAssignees, setSelectedAssignees] = useState<string[]>([])
    const [status, setStatus] = useState<'all' | 'done' | 'not_done'>('all')
    const [selectedVideoTypes, setSelectedVideoTypes] = useState<string[]>([])
    const [dateRange, setDateRange] = useState(() => ({
        start: subDays(new Date(), 6),
        end: new Date()
    }))
    // Lift filter state from FilterBar to prevent reset on re-render
    const [selectedPreset, setSelectedPreset] = useState<'week' | '7days' | '14days' | '28days' | '30days' | 'custom'>('7days')
    const [selectedWeeks, setSelectedWeeks] = useState<Set<string>>(new Set())

    // Data state
    const [allTasks, setAllTasks] = useState<Task[]>([])
    const [assignees, setAssignees] = useState<string[]>([])
    const [targets, setTargets] = useState<Target[]>([])
    const [dayOffs, setDayOffs] = useState<DayOffEntry[]>([])

    // Get current user
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role, full_name, asana_email, asana_name')
                    .eq('id', user.id)
                    .single()

                // Use asana_email from profile, or fallback to login email
                const asanaEmail = profile?.asana_email || user.email || ''
                const asanaName = profile?.asana_name || profile?.full_name || ''

                setUser({
                    email: user.email || '',
                    role: profile?.role || 'member',
                    fullName: profile?.full_name || '',
                    asanaEmail: asanaEmail,
                    asanaName: asanaName,
                })
            }
        }
        getUser()
    }, [supabase])

    // Fetch data
    const fetchData = useCallback(async (isRealtimeRefresh = false) => {
        // Only show loading spinner on initial load, not on realtime refreshes
        if (!isRealtimeRefresh && !initialLoadDone.current) {
            setLoading(true)
        }
        try {
            const { data: tasks } = await supabase
                .from('tasks')
                .select('*')
                .eq('project_type', 'creative')
                .order('updated_at', { ascending: false })

            if (tasks) {
                setAllTasks(tasks)
                const uniqueAssignees = [...new Set(tasks.map(t => t.assignee_name).filter(Boolean))] as string[]
                setAssignees(uniqueAssignees.sort())
            }

            const weekStartStr = format(weekStart, 'yyyy-MM-dd')
            // Get targets for the selected date range
            // Expand start by 7 days to catch weeks that overlap (week_start_date is Monday, may be before dateRange.start)
            const expandedStartStr = format(subDays(dateRange.start, 7), 'yyyy-MM-dd')
            const endDateStr = format(dateRange.end, 'yyyy-MM-dd')

            const { data: targetsData } = await supabase
                .from('targets')
                .select('*')
                .eq('project_type', 'creative')
                .gte('week_start_date', expandedStartStr)
                .lte('week_start_date', endDateStr)

            if (targetsData) {
                setTargets(targetsData)
            }

            // Fetch day offs
            const { data: dayOffsData } = await supabase
                .from('day_offs')
                .select('member_name, date, is_half_day')

            if (dayOffsData) {
                setDayOffs(dayOffsData)
            }

            const { data: syncLogs } = await supabase
                .from('sync_logs')
                .select('*')
                .order('started_at', { ascending: false })
                .limit(1)

            if (syncLogs?.[0]) {
                setLastSync(syncLogs[0].started_at)
            }
        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setLoading(false)
            initialLoadDone.current = true
        }
    }, [supabase, weekStart, dateRange]) // Added dateRange dependency

    useEffect(() => {
        fetchData()
    }, [fetchData])

    useEffect(() => {
        const autoSync = async () => {
            if (!loading && allTasks.length === 0 && !syncing) {
                console.log('No tasks found, auto-syncing from Asana...')
                await handleSync()
            }
        }
        autoSync()
    }, [loading, allTasks.length])

    // Auto-sync every 2 minutes
    const syncingRef = useRef(syncing)
    syncingRef.current = syncing
    useEffect(() => {
        const AUTO_SYNC_INTERVAL = 2 * 60 * 1000 // 2 minutes
        const intervalId = setInterval(async () => {
            if (!syncingRef.current) {
                console.log('[Auto-Sync] Syncing all projects from Asana...', new Date().toLocaleTimeString())
                try {
                    const response = await fetch('/api/asana/sync?project=all', {
                        method: 'POST',
                        cache: 'no-store',
                    })
                    if (response.ok) {
                        console.log('[Auto-Sync] Sync complete, refreshing data...')
                        await fetchData(true)
                    }
                } catch (error) {
                    console.error('[Auto-Sync] Error:', error)
                }
            }
        }, AUTO_SYNC_INTERVAL)
        return () => clearInterval(intervalId)
    }, [fetchData])

    // Supabase Realtime: auto-refresh dashboard when tasks table changes
    useEffect(() => {
        let timeoutId: NodeJS.Timeout | null = null

        const channel = supabase
            .channel('dashboard-tasks-realtime')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'tasks' },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (payload: any) => {
                    console.log('[Realtime] Tasks table changed:', payload.eventType)
                    // Debounce: wait 1.5s to batch multiple rapid changes
                    if (timeoutId) clearTimeout(timeoutId)
                    timeoutId = setTimeout(() => {
                        console.log('[Realtime] Refreshing dashboard data...')
                        fetchData(true)
                    }, 1500)
                }
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'targets' },
                () => {
                    console.log('[Realtime] Targets table changed')
                    if (timeoutId) clearTimeout(timeoutId)
                    timeoutId = setTimeout(() => fetchData(true), 1500)
                }
            )
            .subscribe((status) => {
                console.log('[Realtime] Subscription status:', status)
            })

        return () => {
            if (timeoutId) clearTimeout(timeoutId)
            supabase.removeChannel(channel)
        }
    }, [supabase, fetchData])

    const handleSync = async () => {
        setSyncing(true)
        try {
            const response = await fetch('/api/asana/sync?project=creative', { method: 'POST', cache: 'no-store' })
            if (response.ok) {
                await fetchData()
            }
        } catch (error) {
            console.error('Sync error:', error)
        } finally {
            setSyncing(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    // Filter tasks using dateRange
    const dateRangeStartStr = format(dateRange.start, 'yyyy-MM-dd')
    const dateRangeEndStr = format(dateRange.end, 'yyyy-MM-dd')



    const baseFilteredTasks = allTasks.filter(task => {
        // Role-based filtering: member only sees their own tasks
        // Match by assignee_email (from Asana) against user's email
        if (user?.role === 'member') {
            const taskEmail = (task.assignee_email || '').toLowerCase().trim()
            const userLoginEmail = (user.email || '').toLowerCase().trim()
            const userAsanaEmail = (user.asanaEmail || '').toLowerCase().trim()
            const taskAssigneeName = (task.assignee_name || '').toLowerCase().trim()
            const userAsanaName = (user.asanaName || '').toLowerCase().trim()
            const userFullName = (user.fullName || '').toLowerCase().trim()
            // Match by email first, then by name as fallback
            const emailMatch = (taskEmail && (taskEmail === userLoginEmail || taskEmail === userAsanaEmail))
            const nameMatch = (taskAssigneeName && (taskAssigneeName === userAsanaName || taskAssigneeName === userFullName))
            if (!emailMatch && !nameMatch) return false
        }
        if (selectedAssignees.length > 0 && !selectedAssignees.includes(task.assignee_name || '')) return false
        if (selectedVideoTypes.length > 0 && !selectedVideoTypes.includes(task.video_type || '')) return false
        if (status === 'done' && task.status !== 'done') return false
        if (status === 'not_done' && task.status !== 'not_done') return false
        return true
    })

    const displayTasks = baseFilteredTasks.filter(task => {
        const dueDate = task.due_date
        if (task.status === 'done') {
            if (!dueDate) return false
            return dueDate >= dateRangeStartStr && dueDate <= dateRangeEndStr
        }
        // not_done tasks: filter by due_date if available, otherwise include
        if (dueDate) {
            return dueDate >= dateRangeStartStr && dueDate <= dateRangeEndStr
        }
        return true
    })

    const doneTasks = displayTasks.filter(t => t.status === 'done')
    const notDoneTasks = displayTasks.filter(t => t.status === 'not_done')

    const totalPoints = doneTasks.reduce((sum, t) => sum + (t.points || 0), 0)
    const notDonePoints = notDoneTasks.reduce((sum, t) => sum + (t.points || 0), 0)
    const totalVideos = doneTasks.reduce((sum, t) => sum + (t.video_count || 0), 0)
    const activeAssignees = new Set(doneTasks.map(t => t.assignee_name).filter(Boolean)).size
    const avgPointsPerVideo = totalVideos > 0 ? totalPoints / totalVideos : 0

    // Calculate target for selected date range
    // Read target from the targets table per member per week, fallback to 160 if not set
    const FALLBACK_TARGET = 160

    // Get distinct calendar week start dates (Monday) in the date range
    const daysDiff = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const numWeeks = Math.max(1, Math.ceil(daysDiff / 7))
    const allWeekStarts: string[] = []
    let weekCursor = startOfWeek(dateRange.start, { weekStartsOn: 1 })
    while (weekCursor <= dateRange.end) {
        allWeekStarts.push(format(weekCursor, 'yyyy-MM-dd'))
        weekCursor = addDays(weekCursor, 7)
    }
    // Cap to numWeeks most recent week starts to avoid over-counting
    const distinctWeekStarts = allWeekStarts.length > numWeeks ? allWeekStarts.slice(-numWeeks) : allWeekStarts

    // Get target for a specific member for a specific week
    const getTargetForMemberWeek = (memberName: string, weekStartStr: string): number => {
        const target = targets.find(t => t.user_gid === memberName && t.week_start_date === weekStartStr)
        if (target) return Number(target.target_points) || FALLBACK_TARGET
        return FALLBACK_TARGET
    }

    // Get target for a member (first found, for display/fallback purposes)
    const getTargetForMember = (memberName: string): number => {
        const memberTarget = targets.find(t => t.user_gid === memberName)
        if (memberTarget) return Number(memberTarget.target_points) || FALLBACK_TARGET
        return FALLBACK_TARGET
    }

    // Determine which members are active for target calculation
    const targetMembers: string[] = user?.role === 'member'
        ? [user.asanaName || user.fullName || '']
        : selectedAssignees.length > 0
            ? selectedAssignees
            : [...new Set(doneTasks.map(t => t.assignee_name).filter(Boolean))] as string[]

    // Calculate day off deductions per member
    const currentUserDayOffs = dayOffs.filter(d => {
        if (!d.member_name || !d.date) return false
        const dateStr = d.date
        if (dateStr < dateRangeStartStr || dateStr > dateRangeEndStr) return false
        if (selectedAssignees.length > 0) return selectedAssignees.includes(d.member_name)
        if (user?.role === 'member' && user.fullName) return d.member_name.toLowerCase().trim() === user.fullName.toLowerCase().trim()
        return true
    })

    // Group day off deductions by week, using each member's own target for per-day calculation
    const dayOffDeductionsByWeek: Record<number, number> = {}
    let totalDayOffDeduction = 0
    currentUserDayOffs.forEach(d => {
        const date = new Date(d.date + 'T00:00:00')
        // Skip weekends (Sat=6, Sun=0)
        const dow = date.getDay()
        if (dow === 0 || dow === 6) return
        const weekNum = getWeek(date, { weekStartsOn: 1 })
        const weekStart = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        const memberTarget = getTargetForMemberWeek(d.member_name || '', weekStart)
        const ptsPerDay = memberTarget / WORKING_DAYS_PER_WEEK
        const deduction = d.is_half_day ? ptsPerDay / 2 : ptsPerDay
        const currentDed = dayOffDeductionsByWeek[weekNum] || 0
        dayOffDeductionsByWeek[weekNum] = Math.min(currentDed + deduction, memberTarget)
        totalDayOffDeduction += deduction
    })

    // Calculate total team target: sum per member per distinct week (no overlap)
    let teamTargetPoints = 0
    if (targetMembers.length > 0) {
        targetMembers.forEach(member => {
            distinctWeekStarts.forEach(ws => {
                teamTargetPoints += getTargetForMemberWeek(member, ws)
            })
        })
    } else {
        teamTargetPoints = FALLBACK_TARGET * numWeeks
    }
    teamTargetPoints = Math.max(0, teamTargetPoints - totalDayOffDeduction)

    // For per-week calculations, use the selected member's target
    const DEFAULT_TARGET_PER_MEMBER_PER_WEEK = targetMembers.length === 1
        ? getTargetForMember(targetMembers[0])
        : targetMembers.length > 0
            ? targetMembers.reduce((sum, m) => sum + getTargetForMember(m), 0) / targetMembers.length
            : FALLBACK_TARGET

    const teamAchievedPercent = teamTargetPoints > 0 ? (totalPoints / teamTargetPoints) * 100 : 0

    // Calculate weeks achieved (weeks where points >= adjusted target for that week)
    const pointsByWeek: Record<number, number> = {}
    doneTasks.forEach(task => {
        const dueDate = task.due_date
        if (dueDate) {
            const d = new Date(dueDate)
            const weekNum = getWeek(d, { weekStartsOn: 1 })
            pointsByWeek[weekNum] = (pointsByWeek[weekNum] || 0) + (task.points || 0)
        }
    })
    // Per-week target comparison: deduct day offs for each specific week
    const weeksAchieved = Object.entries(pointsByWeek).filter(([weekNumStr, weekPoints]) => {
        const wk = parseInt(weekNumStr)
        const weekDeduction = dayOffDeductionsByWeek[wk] || 0
        const adjustedWeekTarget = Math.max(0, DEFAULT_TARGET_PER_MEMBER_PER_WEEK - weekDeduction)
        return weekPoints >= adjustedWeekTarget
    }).length
    console.log('Points by week:', pointsByWeek, 'Target per week:', teamTargetPoints, 'Weeks achieved:', weeksAchieved)

    // Get all unique assignees from ALL tasks (not filtered) for the leaderboard
    const allAssigneeNames = [...new Set(allTasks.map(t => t.assignee_name).filter(Boolean))] as string[]

    const assigneeStats = assignees.map(name => {
        const userTasks = doneTasks.filter(t => t.assignee_name === name)
        // Sum targets for this user across all selected weeks
        const userTargetPoints = targets
            .filter(t => t.user_gid === name)
            .reduce((sum, t) => sum + t.target_points, 0)

        const points = userTasks.reduce((sum, t) => sum + (t.points || 0), 0)
        const videos = userTasks.reduce((sum, t) => sum + (t.video_count || 0), 0)

        const videoTypeMix: Record<string, number> = {}
        userTasks.forEach(t => {
            if (t.video_type) {
                videoTypeMix[t.video_type] = (videoTypeMix[t.video_type] || 0) + (t.video_count || 0)
            }
        })

        return {
            name,
            points,
            videos,
            target: userTargetPoints,
            percent: userTargetPoints > 0 ? (points / userTargetPoints) * 100 : 0,
            ...videoTypeMix,
        }
    }).filter(a => a.points > 0 || a.videos > 0 || a.target > 0)

    const dailyData = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekStart, i)
        const dayStr = format(date, 'yyyy-MM-dd')
        const dayTasks = doneTasks.filter(t => {
            return t.due_date === dayStr
        })
        return {
            day: format(date, 'EEE'),
            points: dayTasks.reduce((sum, t) => sum + (t.points || 0), 0),
            tasks: dayTasks.length,
        }
    })

    // Leaderboard: Calculate from ALL tasks (not date-filtered) to show total weeks achieved
    // This way the leaderboard always shows the big picture for ALL members
    const allDoneTasks = allTasks.filter(t => t.status === 'done')
    const leaderboardData = allAssigneeNames.map(name => {
        const memberAllDone = allDoneTasks.filter(t => t.assignee_name === name)
        const totalPoints = memberAllDone.reduce((sum, t) => sum + (t.points || 0), 0)

        // Group by week using due_date
        const memberPointsByWeek: Record<number, number> = {}
        memberAllDone.forEach(task => {
            const dueDate = task.due_date
            if (dueDate) {
                const d = new Date(dueDate)
                // Only count 2026 weeks
                if (d.getFullYear() === 2026 && d.getMonth() >= 1) {
                    const weekNum = getWeek(d, { weekStartsOn: 1 })
                    memberPointsByWeek[weekNum] = (memberPointsByWeek[weekNum] || 0) + (task.points || 0)
                }
            }
        })

        // Calculate day off deductions per week for this member
        const memberDayOffsByWeek: Record<number, number> = {}
        dayOffs.forEach(d => {
            if (d.member_name === name) {
                const date = new Date(d.date)
                if (date.getFullYear() === 2026 && date.getMonth() >= 1) {
                    const weekNum = getWeek(date, { weekStartsOn: 1 })
                    const ptsPerDay = DEFAULT_TARGET_PER_MEMBER_PER_WEEK / WORKING_DAYS_PER_WEEK
                    const deduction = d.is_half_day ? ptsPerDay / 2 : ptsPerDay
                    memberDayOffsByWeek[weekNum] = (memberDayOffsByWeek[weekNum] || 0) + deduction
                }
            }
        })

        // Check weeks achieved with adjusted targets
        const memberWeeksAchieved = Object.entries(memberPointsByWeek)
            .filter(([weekNum, pts]) => {
                const wk = parseInt(weekNum)
                const deduction = memberDayOffsByWeek[wk] || 0
                const adjustedTarget = Math.max(0, DEFAULT_TARGET_PER_MEMBER_PER_WEEK - deduction)
                return pts >= adjustedTarget
            }).length

        return {
            name,
            points: totalPoints,
            target: DEFAULT_TARGET_PER_MEMBER_PER_WEEK,
            weeksAchieved: memberWeeksAchieved,
            totalWeeks: 24,
        }
    })

    if (loading) {
        return (
            <DashboardLayout>
                <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-slate-400">Loading dashboard...</p>
                    </div>
                </div>
            </DashboardLayout>
        )
    }

    // Role-based filtering: only filter if user is explicitly a 'member' with a valid fullName
    // If profile is not set or fullName is empty, show all data (manager behavior)
    const isManager = !user?.role || user?.role === 'admin' || user?.role === 'lead' || !user?.fullName

    // For TaskTable: filter by user if member
    const filteredTasks = isManager ? displayTasks : displayTasks.filter(t => t.assignee_name === user?.fullName)
    const filteredDoneTasks = filteredTasks.filter(t => t.status === 'done')
    const filteredNotDoneTasks = filteredTasks.filter(t => t.status === 'not_done')

    // For Leaderboard and DueDateStats: always show all team data
    const filteredLeaderboardData = leaderboardData // Always show full team
    const filteredAssigneeStats = assigneeStats // Always show full team (not used anymore)

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-slate-950">
                {/* Top User Bar */}
                <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-white">Overview Video Creative</h2>
                            <p className="text-sm text-slate-400">{format(dateRange.start, 'MMM d')} - {format(dateRange.end, 'MMM d, yyyy')}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium text-white">{user?.email}</p>
                                <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="p-2 hover:bg-slate-800 rounded-lg transition-colors group"
                                title="Logout"
                            >
                                <LogOut className="w-5 h-5 text-slate-400 group-hover:text-red-400 transition-colors" />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="px-6 py-6">
                    {/* Filter Bar */}
                    <FilterBar
                        weekStart={weekStart}
                        onWeekChange={setWeekStart}
                        assignees={assignees}
                        selectedAssignees={selectedAssignees}
                        onAssigneesChange={setSelectedAssignees}
                        status={status}
                        onStatusChange={setStatus}
                        videoTypes={Object.keys(POINT_CONFIG)}
                        selectedVideoTypes={selectedVideoTypes}
                        onVideoTypesChange={setSelectedVideoTypes}
                        onSync={handleSync}
                        syncing={syncing}
                        lastSync={lastSync}
                        dateRange={dateRange}
                        onDateRangeChange={setDateRange}
                        selectedPreset={selectedPreset}
                        onPresetChange={setSelectedPreset}
                        selectedWeeks={selectedWeeks}
                        onWeeksChange={setSelectedWeeks}
                    />

                    {/* Row 1: KPI Cards */}
                    <KPICards
                        totalPoints={totalPoints}
                        totalVideos={totalVideos}
                        doneTasks={doneTasks.length}
                        notDoneTasks={notDoneTasks.length}
                        notDonePoints={notDonePoints}
                        activeAssignees={activeAssignees}
                        avgPointsPerVideo={avgPointsPerVideo}
                        teamTargetPoints={teamTargetPoints}
                        teamAchievedPercent={teamAchievedPercent}
                        weeksAchieved={weeksAchieved}
                        totalWeeks={24}
                    />

                    {/* Row 2: Charts (smaller) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                        <VideoTypeMixChart data={doneTasks} />
                        <DailyPointsChart tasks={doneTasks} dateRange={dateRange} dateField="due_date" />
                    </div>



                    {/* Row 3: Leaderboard + Due Date Stats + CTST */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                        <Leaderboard data={filteredLeaderboardData} />
                        <DueDateStats tasks={displayTasks} />
                        <CTSTChart tasks={displayTasks} />
                    </div>

                    {/* Row 4: Task Tables */}
                    <TaskTable doneTasks={filteredDoneTasks} notDoneTasks={filteredNotDoneTasks} />
                </main>
            </div>
        </DashboardLayout>
    )
}
