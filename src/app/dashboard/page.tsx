'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { startOfWeek, format, addDays, subDays, getWeek } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { fetchAllPages } from '@/lib/supabase/fetchAllPages'
import { LogOut } from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import {
    FilterBar,
    KPICards,
    VideoTypeMixChart,
    Leaderboard,
    TaskTable,
    DueDateStats,
    DailyPointsChart,
    CTSTChart,
} from '@/components/dashboard'
import type { Task, Target, DayOffEntry } from '@/lib/types'
import { CREATIVE_POINT_CONFIG, WORKING_DAYS_PER_WEEK, FALLBACK_TARGET, TOTAL_WEEKS, isTargetDeductionDay } from '@/lib/constants'

export default function DashboardPage() {
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])

    // State
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const initialLoadDone = useRef(false)
    const syncInFlightRef = useRef(false)
    const syncRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const [lastSync, setLastSync] = useState<string>()
    const [user, setUser] = useState<{ email: string; role: string; roleCreative: string; fullName: string; asanaEmail: string; asanaName: string } | null>(null)

    // Filter state
    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
    const [selectedAssignees, setSelectedAssignees] = useState<string[]>([])
    const [status, setStatus] = useState<'all' | 'done' | 'not_done'>('all')
    const [selectedVideoTypes, setSelectedVideoTypes] = useState<string[]>([])
    const [dateRange, setDateRange] = useState(() => {
        const today = new Date()
        const weekMon = startOfWeek(today, { weekStartsOn: 1 })
        const weekFri = addDays(weekMon, 4)
        return { start: weekMon, end: weekFri }
    })
    // Lift filter state from FilterBar to prevent reset on re-render
    const [selectedPreset, setSelectedPreset] = useState<'week' | '7days' | '14days' | '28days' | '30days' | 'month-1' | 'month-2' | 'month-3' | 'month-4' | 'month-5' | 'custom'>('week')
    const [selectedWeeks, setSelectedWeeks] = useState<Set<string>>(new Set())

    // Data state
    const [allTasks, setAllTasks] = useState<Task[]>([])
    const [assignees, setAssignees] = useState<string[]>([])
    const [targets, setTargets] = useState<Target[]>([])
    const [dayOffs, setDayOffs] = useState<DayOffEntry[]>([])
    const [dueDateChanges, setDueDateChanges] = useState<{ task_id: string; old_due_date: string | null; new_due_date: string | null; changed_at: string }[]>([])
    const fetchDataRef = useRef<(isRealtimeRefresh?: boolean) => Promise<void>>(async () => { })

    function normalizeName(name: string) {
        return name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[\s\u200B-\u200D\uFEFF]+/g, '')
            .toLowerCase()
            .trim()
    }

    // Get current user
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const profileResult = await supabase
                    .from('profiles')
                    .select('role, role_creative, role_graphic, full_name, asana_email, asana_name')
                    .eq('id', user.id)
                    .single()

                const profile = profileResult.data as {
                    role?: string | null
                    role_creative?: string | null
                    role_graphic?: string | null
                    full_name?: string | null
                    asana_email?: string | null
                    asana_name?: string | null
                } | null
                const hasProfile = Boolean(profile)
                const globalRole = profile?.role || 'member'
                const creativeRole = hasProfile ? (profile?.role_creative || globalRole) : 'none'
                const graphicRole = hasProfile ? (profile?.role_graphic || 'none') : 'none'
                const canAccessCreativeDashboard = globalRole === 'admin'
                    || (creativeRole !== 'none' && creativeRole !== 'idea_creator')
                const canAccessBenchmark = globalRole === 'admin'
                    || creativeRole !== 'none'
                    || graphicRole !== 'none'
                if (!canAccessCreativeDashboard) {
                    if (graphicRole !== 'none') {
                        router.push('/graphic-dashboard')
                    } else if (canAccessBenchmark) {
                        router.push('/creative-benchmark')
                    } else {
                        await supabase.auth.signOut()
                        router.push('/login?pending=1')
                    }
                    return
                }

                // Use asana_email from profile, or fallback to login email
                const asanaEmail = profile?.asana_email || user.email || ''
                const asanaName = profile?.asana_name || profile?.full_name || ''

                setUser({
                    email: user.email || '',
                    role: globalRole === 'admin' ? 'admin' : creativeRole,
                    roleCreative: creativeRole,
                    fullName: profile?.full_name || '',
                    asanaEmail: asanaEmail,
                    asanaName: asanaName,
                })
            }
        }
        getUser()
    }, [router, supabase])

    // Fetch data
    const fetchData = useCallback(async (isRealtimeRefresh = false) => {
        // Only show loading spinner on initial load, not on realtime refreshes
        if (!isRealtimeRefresh && !initialLoadDone.current) {
            setLoading(true)
        }
        let skippedForRunningSync = false
        try {
            const { data: latestSync } = await supabase
                .from('sync_logs')
                .select('started_at, status')
                .order('started_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (latestSync?.started_at) {
                setLastSync(latestSync.started_at)
            }

            if (latestSync?.status === 'running') {
                skippedForRunningSync = true
                if (syncRetryTimeoutRef.current) clearTimeout(syncRetryTimeoutRef.current)
                syncRetryTimeoutRef.current = setTimeout(() => {
                    fetchDataRef.current(true)
                }, 2500)
                return
            }
            // Select only needed columns — exclude raw_data to reduce payload ~10-20x
            const tasks = await fetchAllPages<Task>((from, to) =>
                supabase
                    .from('tasks')
                    .select('id, asana_id, name, description, assignee_name, assignee_email, video_type, video_count, points, due_date, completed_at, status, tags, ctst, project_type, updated_at')
                    .eq('project_type', 'creative')
                    .order('updated_at', { ascending: false })
                    .order('id', { ascending: false })
                    .range(from, to)
            )

            setAllTasks(tasks)
            const uniqueAssignees = [...new Set(tasks.map(t => t.assignee_name).filter(Boolean))] as string[]
            setAssignees(uniqueAssignees.sort())

            const { data: targetsData } = await supabase
                .from('targets')
                .select('user_gid, week_start_date, target_points')
                .eq('project_type', 'creative')

            if (targetsData) {
                setTargets(targetsData)
            }

            const dayOffsData = await fetchAllPages<DayOffEntry>((from, to) =>
                supabase
                    .from('day_offs')
                    .select('user_email, member_name, date, is_half_day')
                    .order('date', { ascending: true })
                    .range(from, to)
            )

            setDayOffs(dayOffsData)

            // Fetch due_date_changes for deadline rate calculation
            const { data: changesData } = await supabase
                .from('due_date_changes')
                .select('task_id, old_due_date, new_due_date, changed_at')
                .eq('project_type', 'creative')

            if (changesData) {
                setDueDateChanges(changesData)
            }

        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            if (!skippedForRunningSync) {
                setLoading(false)
                initialLoadDone.current = true
            }
        }
    }, [supabase, weekStart, dateRange])

    fetchDataRef.current = fetchData

    useEffect(() => {
        fetchData()
    }, [fetchData])

    useEffect(() => {
        if (selectedAssignees.length === 0 || assignees.length === 0) return
        setSelectedAssignees((prev) => {
            const remapped = prev
                .map((selected) => assignees.find((assignee) => normalizeName(assignee) === normalizeName(selected)))
                .filter((value): value is string => Boolean(value))
            const unique = [...new Set(remapped)]
            const unchanged = unique.length === prev.length && unique.every((value, index) => value === prev[index])
            return unchanged ? prev : unique
        })
    }, [assignees, selectedAssignees.length])

    // Auto-sync every 5 minutes (client-side, since Vercel Hobby cron is limited to 1x/day)
    useEffect(() => {
        const interval = setInterval(() => {
            if (!syncInFlightRef.current) {
                console.log('[Auto-sync] Triggering periodic sync...')
                handleSync()
            }
        }, 5 * 60 * 1000) // 5 minutes
        return () => clearInterval(interval)
    }, [])

    // Supabase Realtime: auto-refresh dashboard when tasks/targets change
    // Skip refresh if we just triggered a sync (to prevent double-fetch)
    const justSyncedRef = useRef(false)

    useEffect(() => {
        let timeoutId: NodeJS.Timeout | null = null

        const channel = supabase
            .channel('dashboard-tasks-realtime')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'tasks' },
                () => {
                    // Skip if we just synced — handleSync already calls fetchData
                    if (justSyncedRef.current) return
                    if (timeoutId) clearTimeout(timeoutId)
                    // 5s debounce to batch multiple rapid changes (e.g. during sync)
                    timeoutId = setTimeout(() => fetchDataRef.current(true), 5000)
                }
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'targets' },
                () => {
                    if (timeoutId) clearTimeout(timeoutId)
                    timeoutId = setTimeout(() => fetchDataRef.current(true), 5000)
                }
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'sync_logs' },
                () => {
                    if (timeoutId) clearTimeout(timeoutId)
                    timeoutId = setTimeout(() => fetchDataRef.current(true), 1000)
                }
            )
            .subscribe()

        return () => {
            if (timeoutId) clearTimeout(timeoutId)
            if (syncRetryTimeoutRef.current) clearTimeout(syncRetryTimeoutRef.current)
            supabase.removeChannel(channel)
        }
    }, [supabase]) // stable dependency — no fetchData here

    const handleSync = async () => {
        if (syncInFlightRef.current) return
        syncInFlightRef.current = true
        setSyncing(true)
        justSyncedRef.current = true
        try {
            const response = await fetch('/api/asana/sync?project=creative', { method: 'POST', cache: 'no-store' })
            if (response.ok) {
                await fetchData()
            }
        } finally {
            setSyncing(false)
            syncInFlightRef.current = false
            // Allow Realtime to work again after a short delay
            setTimeout(() => { justSyncedRef.current = false }, 5000)
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
        if (selectedAssignees.length > 0) {
            const selectedAssigneeNames = selectedAssignees.map(normalizeName)
            if (!selectedAssigneeNames.includes(normalizeName(task.assignee_name || ''))) return false
        }
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
    // FALLBACK_TARGET imported from constants

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
        const norm = normalizeName(memberName)
        const target = targets.find(t => normalizeName(t.user_gid) === norm && t.week_start_date === weekStartStr)
        if (target) return Number(target.target_points) || FALLBACK_TARGET
        return FALLBACK_TARGET
    }

    // Get target for a member (first found, for display/fallback purposes)
    const getTargetForMember = (memberName: string): number => {
        const norm = normalizeName(memberName)
        const memberTarget = targets.find(t => normalizeName(t.user_gid) === norm)
        if (memberTarget) return Number(memberTarget.target_points) || FALLBACK_TARGET
        return FALLBACK_TARGET
    }

    // Determine which members are active for target calculation
    // Use members from the targets table (same as settings page), not from doneTasks
    const targetTableMembers = [...new Set(targets.map(t => t.user_gid).filter(Boolean))] as string[]
    const targetMembers: string[] = user?.role === 'member'
        ? [user.asanaName || user.fullName || '']
        : selectedAssignees.length > 0
            ? selectedAssignees
            : targetTableMembers.length > 0
                ? targetTableMembers
                : [...new Set(doneTasks.map(t => t.assignee_name).filter(Boolean))] as string[]

    // Calculate day off deductions per member
    const dayOffsByMemberDate = new Map<string, DayOffEntry>()
    dayOffs.forEach(d => {
        if (!d.member_name || !d.date) return
        const key = `${d.member_name}|${d.date}`
        const existing = dayOffsByMemberDate.get(key)
        if (!existing || d.user_email === 'system@holiday') {
            dayOffsByMemberDate.set(key, d)
        }
    })

    const currentUserDayOffs = [...dayOffsByMemberDate.values()].filter(d => {
        if (!d.member_name || !d.date) return false
        const dateStr = d.date
        if (dateStr < dateRangeStartStr || dateStr > dateRangeEndStr) return false
        // Only include day offs for members in this project's target list
        if (selectedAssignees.length > 0) {
            const selectedAssigneeNames = selectedAssignees.map(normalizeName)
            return selectedAssigneeNames.includes(normalizeName(d.member_name))
        }
        if (user?.role === 'member') {
            const dayOffName = normalizeName(d.member_name)
            const userAsanaName = normalizeName(user.asanaName || '')
            const userFullName = normalizeName(user.fullName || '')
            return dayOffName === userAsanaName || dayOffName === userFullName
        }
        return targetMembers.includes(d.member_name)
    })

    // Group day off deductions by week, using each member's own target for per-day calculation
    const dayOffDeductionsByWeek: Record<number, number> = {}
    let totalDayOffDeduction = 0
    currentUserDayOffs.forEach(d => {
        const date = new Date(d.date + 'T00:00:00')
        if (!isTargetDeductionDay(date)) return
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


    // Get all unique assignees from ALL tasks (not filtered) for the leaderboard
    const allAssigneeNames = [...new Set(allTasks.map(t => t.assignee_name).filter(Boolean))] as string[]

    const assigneeStats = assignees.map(name => {
        const normalizedName = normalizeName(name)
        const userTasks = doneTasks.filter(t => normalizeName(t.assignee_name || '') === normalizedName)
        // Sum targets for this user across all selected weeks
        const userTargetPoints = targets
            .filter(t => normalizeName(t.user_gid) === normalizedName)
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
    const currentWeekNum = getWeek(new Date(), { weekStartsOn: 1 })
    const leaderboardData = allAssigneeNames.map(name => {
        const normalizedName = normalizeName(name)
        const memberAllDone = allDoneTasks.filter(t => normalizeName(t.assignee_name || '') === normalizedName)
        const totalPoints = memberAllDone.reduce((sum, t) => sum + (t.points || 0), 0)

        // Use this member's own target (not filter-dependent)
        const memberOwnTarget = getTargetForMember(name)

        // Group by week using due_date
        const memberPointsByWeek: Record<number, number> = {}
        memberAllDone.forEach(task => {
            const dueDate = task.due_date
            if (dueDate) {
                const d = new Date(dueDate)
                // Only count 2026 weeks from February onwards
                if (d.getFullYear() === 2026 && d.getMonth() >= 1) {
                    const weekNum = getWeek(d, { weekStartsOn: 1 })
                    memberPointsByWeek[weekNum] = (memberPointsByWeek[weekNum] || 0) + (task.points || 0)
                }
            }
        })

        // Calculate day off deductions per week for this member
        const memberDayOffsByWeek: Record<number, number> = {}
        dayOffs.forEach(d => {
            if (normalizeName(d.member_name || '') === normalizedName) {
                const date = new Date(d.date)
                if (date.getFullYear() === 2026 && date.getMonth() >= 1) {
                    if (!isTargetDeductionDay(date)) return
                    const weekNum = getWeek(date, { weekStartsOn: 1 })
                    const ptsPerDay = memberOwnTarget / WORKING_DAYS_PER_WEEK
                    const deduction = d.is_half_day ? ptsPerDay / 2 : ptsPerDay
                    memberDayOffsByWeek[weekNum] = (memberDayOffsByWeek[weekNum] || 0) + deduction
                }
            }
        })

        // Only count weeks that have elapsed (up to current week)
        const memberWeeksAchieved = Object.entries(memberPointsByWeek)
            .filter(([weekNum, pts]) => {
                const wk = parseInt(weekNum)
                if (wk > currentWeekNum) return false // skip future weeks
                const deduction = memberDayOffsByWeek[wk] || 0
                const adjustedTarget = Math.max(0, memberOwnTarget - deduction)
                return pts >= adjustedTarget
            }).length

        return {
            name,
            points: totalPoints,
            target: memberOwnTarget,
            weeksAchieved: memberWeeksAchieved,
            totalWeeks: TOTAL_WEEKS,
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
    // Match by email first (most reliable), then by asana_name, then by fullName
    const filteredTasks = isManager ? displayTasks : displayTasks.filter(t => {
        const taskEmail = (t.assignee_email || '').toLowerCase().trim()
        const userLoginEmail = (user?.email || '').toLowerCase().trim()
        const userAsanaEmail = (user?.asanaEmail || '').toLowerCase().trim()
        const taskName = (t.assignee_name || '').toLowerCase().trim()
        const userAsanaName = (user?.asanaName || '').toLowerCase().trim()
        const userFullName = (user?.fullName || '').toLowerCase().trim()
        const emailMatch = taskEmail && (taskEmail === userLoginEmail || taskEmail === userAsanaEmail)
        const nameMatch = taskName && (taskName === userAsanaName || taskName === userFullName)
        return emailMatch || nameMatch
    })
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
                        videoTypes={Object.keys(CREATIVE_POINT_CONFIG)}
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
                        totalWeeks={TOTAL_WEEKS}
                    />

                    {/* Row 2: Charts — Points chart bigger, Video chart smaller */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4 items-stretch">
                        <div className="lg:col-span-2 flex min-w-0 overflow-hidden">
                            <div className="flex-1 min-w-0">
                                <DailyPointsChart tasks={doneTasks} dateRange={dateRange} dateField="due_date" />
                            </div>
                        </div>
                        <div className="lg:col-span-1 flex">
                            <div className="flex-1">
                                <VideoTypeMixChart data={doneTasks} />
                            </div>
                        </div>
                    </div>

                    {/* Row 3: Leaderboard + Due Date Stats + CTST */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                        <Leaderboard data={filteredLeaderboardData} />
                        <DueDateStats tasks={allTasks} dueDateChanges={dueDateChanges} />
                        <CTSTChart tasks={displayTasks} />
                    </div>

                    {/* Row 4: Task Tables */}
                    <TaskTable doneTasks={filteredDoneTasks} notDoneTasks={filteredNotDoneTasks} />
                </main>
            </div>
        </DashboardLayout>
    )
}
