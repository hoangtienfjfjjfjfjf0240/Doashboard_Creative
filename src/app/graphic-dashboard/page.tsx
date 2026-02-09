'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
    target_points: number
}

// Design point config — keys match Asana "Asset" enum values
const DESIGN_POINT_CONFIG: Record<string, number> = {
    'Research Doc': 12,           // S1
    'ScreenShot': 24,             // S2
    'Icon': 2,                    // S3
    'Cover, Promotional Content': 12,  // S4
    'Localize Screenshot': 6,     // S5
    'Localize': 6,                // S5 alt
    'Deep Localize': 24,          // S6
    'Deep Localization': 24,      // S6 alt
}

interface DayOffEntry {
    member_name: string | null
    date: string
    is_half_day: boolean
}

const WORKING_DAYS_PER_WEEK = 4

export default function GraphicDashboardPage() {
    const router = useRouter()
    const supabase = createClient()

    // State
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const [lastSync, setLastSync] = useState<string>()
    const [user, setUser] = useState<{ email: string; role: string; roleGraphic: string; fullName: string; asanaEmail: string; asanaName: string } | null>(null)

    // Filter state
    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
    const [selectedAssignees, setSelectedAssignees] = useState<string[]>([])
    const [status, setStatus] = useState<'all' | 'done' | 'not_done'>('all')
    const [selectedVideoTypes, setSelectedVideoTypes] = useState<string[]>([])
    const [dateRange, setDateRange] = useState(() => ({
        start: subDays(new Date(), 6),
        end: new Date()
    }))
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
                    .select('role, full_name, asana_email, asana_name, role_graphic')
                    .eq('id', user.id)
                    .single()

                const asanaEmail = profile?.asana_email || user.email || ''
                const asanaName = profile?.asana_name || profile?.full_name || ''

                setUser({
                    email: user.email || '',
                    role: profile?.role || 'member',
                    roleGraphic: profile?.role_graphic || 'none',
                    fullName: profile?.full_name || '',
                    asanaEmail: asanaEmail,
                    asanaName: asanaName,
                })
            }
        }
        getUser()
    }, [supabase])

    // Fetch data — only graphic tasks
    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const { data: tasks } = await supabase
                .from('tasks')
                .select('*')
                .eq('project_type', 'graphic')
                .order('updated_at', { ascending: false })

            if (tasks) {
                setAllTasks(tasks)
                const uniqueAssignees = [...new Set(tasks.map(t => t.assignee_name).filter(Boolean))] as string[]
                setAssignees(uniqueAssignees.sort())
            }

            const startDateStr = format(dateRange.start, 'yyyy-MM-dd')
            const endDateStr = format(dateRange.end, 'yyyy-MM-dd')

            const { data: targetsData } = await supabase
                .from('targets')
                .select('*')
                .eq('project_type', 'graphic')
                .gte('week_start_date', startDateStr)
                .lte('week_start_date', endDateStr)

            if (targetsData) {
                setTargets(targetsData)
            }

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
        }
    }, [supabase, dateRange])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    useEffect(() => {
        const autoSync = async () => {
            if (!loading && allTasks.length === 0 && !syncing) {
                console.log('No graphic tasks found, auto-syncing from Asana...')
                await handleSync()
            }
        }
        autoSync()
    }, [loading, allTasks.length])

    // Auto-sync every 5 minutes
    const syncingRef = useRef(syncing)
    syncingRef.current = syncing
    useEffect(() => {
        const AUTO_SYNC_INTERVAL = 5 * 60 * 1000 // 5 minutes
        const intervalId = setInterval(async () => {
            if (!syncingRef.current) {
                console.log('[Auto-Sync Graphic] Syncing from Asana...', new Date().toLocaleTimeString())
                try {
                    const response = await fetch('/api/asana/sync?project=graphic', {
                        method: 'POST',
                        cache: 'no-store',
                    })
                    if (response.ok) {
                        console.log('[Auto-Sync Graphic] Sync complete, refreshing data...')
                        await fetchData()
                    }
                } catch (error) {
                    console.error('[Auto-Sync Graphic] Error:', error)
                }
            }
        }, AUTO_SYNC_INTERVAL)
        return () => clearInterval(intervalId)
    }, [fetchData])

    const handleSync = async () => {
        setSyncing(true)
        try {
            const response = await fetch('/api/asana/sync?project=graphic', { method: 'POST', cache: 'no-store' })
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
        // Role-based filtering: only graphic 'member' sees their own tasks; manager/admin/lead sees all
        if (user?.roleGraphic === 'member' && user?.role !== 'admin') {
            const taskEmail = (task.assignee_email || '').toLowerCase().trim()
            const userLoginEmail = (user.email || '').toLowerCase().trim()
            const userAsanaEmail = (user.asanaEmail || '').toLowerCase().trim()
            const taskAssigneeName = (task.assignee_name || '').toLowerCase().trim()
            const userAsanaName = (user.asanaName || '').toLowerCase().trim()
            const userFullName = (user.fullName || '').toLowerCase().trim()
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

    // Use due_date to determine which date range a done task belongs to
    const displayTasks = baseFilteredTasks.filter(task => {
        if (task.status === 'done') {
            const dueDate = task.due_date || (task.completed_at ? task.completed_at.substring(0, 10) : null)
            if (!dueDate) return false
            return dueDate >= dateRangeStartStr && dueDate <= dateRangeEndStr
        }
        return task.status === 'not_done'
    })

    const doneTasks = displayTasks.filter(t => t.status === 'done')
    const notDoneTasks = displayTasks.filter(t => t.status === 'not_done')

    const totalPoints = doneTasks.reduce((sum, t) => sum + (t.points || 0), 0)
    const notDonePoints = notDoneTasks.reduce((sum, t) => sum + (t.points || 0), 0)
    const totalVideos = doneTasks.reduce((sum, t) => sum + (t.video_count || 0), 0)
    const activeAssignees = new Set(doneTasks.map(t => t.assignee_name).filter(Boolean)).size
    const avgPointsPerVideo = totalVideos > 0 ? totalPoints / totalVideos : 0

    const DEFAULT_TARGET_PER_MEMBER_PER_WEEK = 160

    const daysDiff = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const numWeeks = Math.max(1, Math.ceil(daysDiff / 7))

    const currentUserDayOffs = dayOffs.filter(d => {
        if (!d.member_name || !d.date) return false
        const dateStr = d.date
        if (dateStr < dateRangeStartStr || dateStr > dateRangeEndStr) return false
        if (selectedAssignees.length > 0) return selectedAssignees.includes(d.member_name)
        if ((user?.roleGraphic === 'member' || user?.role === 'member') && user.fullName) return d.member_name.toLowerCase().trim() === user.fullName.toLowerCase().trim()
        return true
    })

    const dayOffDeductionsByWeek: Record<number, number> = {}
    let totalDayOffDeduction = 0
    currentUserDayOffs.forEach(d => {
        const date = new Date(d.date)
        const weekNum = getWeek(date, { weekStartsOn: 1 })
        const ptsPerDay = DEFAULT_TARGET_PER_MEMBER_PER_WEEK / WORKING_DAYS_PER_WEEK
        const deduction = d.is_half_day ? ptsPerDay / 2 : ptsPerDay
        dayOffDeductionsByWeek[weekNum] = (dayOffDeductionsByWeek[weekNum] || 0) + deduction
        totalDayOffDeduction += deduction
    })

    const teamTargetPoints = Math.max(0, (DEFAULT_TARGET_PER_MEMBER_PER_WEEK * numWeeks) - totalDayOffDeduction)
    const teamAchievedPercent = teamTargetPoints > 0 ? (totalPoints / teamTargetPoints) * 100 : 0

    const pointsByWeek: Record<number, number> = {}
    doneTasks.forEach(task => {
        const dueDate = task.due_date || (task.completed_at ? task.completed_at.substring(0, 10) : null)
        if (dueDate) {
            const d = new Date(dueDate)
            const weekNum = getWeek(d, { weekStartsOn: 1 })
            pointsByWeek[weekNum] = (pointsByWeek[weekNum] || 0) + (task.points || 0)
        }
    })

    const allAssigneeNames = [...new Set(allTasks.map(t => t.assignee_name).filter(Boolean))] as string[]

    const allDoneTasks = allTasks.filter(t => t.status === 'done')
    const leaderboardData = allAssigneeNames.map(name => {
        const memberAllDone = allDoneTasks.filter(t => t.assignee_name === name)
        const totalPoints = memberAllDone.reduce((sum, t) => sum + (t.points || 0), 0)

        const memberPointsByWeek: Record<number, number> = {}
        memberAllDone.forEach(task => {
            const dueDate = task.due_date || (task.completed_at ? task.completed_at.split('T')[0] : null)
            if (dueDate) {
                const d = new Date(dueDate)
                if (d.getFullYear() === 2026 && d.getMonth() >= 1) {
                    const weekNum = getWeek(d, { weekStartsOn: 1 })
                    memberPointsByWeek[weekNum] = (memberPointsByWeek[weekNum] || 0) + (task.points || 0)
                }
            }
        })

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

        const memberWeeksAchieved = Object.entries(memberPointsByWeek)
            .filter(([weekNum]) => {
                const wk = parseInt(weekNum)
                const deduction = memberDayOffsByWeek[wk] || 0
                const adjustedTarget = Math.max(0, DEFAULT_TARGET_PER_MEMBER_PER_WEEK - deduction)
                return (memberPointsByWeek[wk] || 0) >= adjustedTarget
            }).length

        return {
            name,
            points: totalPoints,
            target: DEFAULT_TARGET_PER_MEMBER_PER_WEEK,
            weeksAchieved: memberWeeksAchieved,
            totalWeeks: 24,
        }
    })

    // Derive team weeksAchieved from leaderboard (max across members)
    const weeksAchieved = leaderboardData.reduce((max, m) => Math.max(max, m.weeksAchieved), 0)

    if (loading) {
        return (
            <DashboardLayout>
                <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-slate-400">Loading Graphic Design dashboard...</p>
                    </div>
                </div>
            </DashboardLayout>
        )
    }

    const canSeeAll = ['admin', 'lead', 'manager'].includes(user?.roleGraphic || '') || ['admin', 'lead'].includes(user?.role || '') || !user?.fullName

    const filteredTasks = canSeeAll ? displayTasks : displayTasks.filter(t => t.assignee_name === user?.fullName)
    const filteredDoneTasks = filteredTasks.filter(t => t.status === 'done')
    const filteredNotDoneTasks = filteredTasks.filter(t => t.status === 'not_done')

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-slate-950">
                {/* Top User Bar */}
                <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-white">Overview Graphic Design</h2>
                            <p className="text-sm text-slate-400">{format(dateRange.start, 'MMM d')} - {format(dateRange.end, 'MMM d, yyyy')}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium text-white">{user?.email}</p>
                                <p className="text-xs text-slate-500 capitalize">{user?.roleGraphic || user?.role}</p>
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
                        videoTypes={Object.keys(DESIGN_POINT_CONFIG)}
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

                    {/* Row 2: Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                        <VideoTypeMixChart data={doneTasks} unit="image" />
                        <DailyPointsChart tasks={doneTasks} dateRange={dateRange} dateField="due_date" />
                    </div>



                    {/* Row 3: Leaderboard + Due Date Stats (NO CTST for Graphic) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                        <Leaderboard data={leaderboardData} />
                        <DueDateStats tasks={displayTasks} />
                    </div>

                    {/* Row 4: Task Tables */}
                    <TaskTable doneTasks={filteredDoneTasks} notDoneTasks={filteredNotDoneTasks} />
                </main>
            </div>
        </DashboardLayout>
    )
}
