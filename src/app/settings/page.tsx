'use client'

import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchAllPages } from '@/lib/supabase/fetchAllPages'
import { Save, Target, ChevronDown, CalendarOff, Filter, Calendar, LayoutGrid } from 'lucide-react'
import { format, startOfWeek, addWeeks, getWeek, getMonth } from 'date-fns'
import DashboardLayout from '@/components/DashboardLayout'
import { CREATIVE_POINT_CONFIG, WORKING_DAYS_PER_WEEK, isTargetDeductionDay } from '@/lib/constants'

interface DayOffDetail {
    date: string
    is_half_day: boolean
}

interface AssigneeTarget {
    assignee_name: string
    targets: Record<number, number>
    actualPoints: Record<number, number>
    dayOffDeductions: Record<number, number>
    companyHolidayDeductions: Record<number, number>
    dayOffDetails: Record<number, DayOffDetail[]>
}

interface DayOffRecord {
    user_email?: string | null
    member_name: string | null
    date: string
    is_half_day: boolean
}

// Months in 2026
const MONTHS_2026 = [
    { value: 0, label: 'Tháng 1' },
    { value: 1, label: 'Tháng 2' },
    { value: 2, label: 'Tháng 3' },
    { value: 3, label: 'Tháng 4' },
    { value: 4, label: 'Tháng 5' },
    { value: 5, label: 'Tháng 6' },
    { value: 6, label: 'Tháng 7' },
    { value: 7, label: 'Tháng 8' },
    { value: 8, label: 'Tháng 9' },
    { value: 9, label: 'Tháng 10' },
    { value: 10, label: 'Tháng 11' },
    { value: 11, label: 'Tháng 12' },
]

function formatPoint(value: number): string {
    const rounded = Math.round(value * 10) / 10
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function getWeeksOf2026() {
    const weeks: { weekNum: number; actualWeekNum: number; start: Date; label: string; month: number }[] = []
    // Start from Feb 2, 2026 (first Monday of February)
    const feb2 = new Date(2026, 1, 2) // February 2, 2026 (Monday)
    const startActualWeek = getWeek(feb2, { weekStartsOn: 1 })


    const numWeeks = 24
    for (let i = 0; i < numWeeks; i++) {
        const actualWeek = startActualWeek + i
        const weekStart = addWeeks(startOfWeek(new Date(2026, 0, 1), { weekStartsOn: 1 }), actualWeek - 1)
        weeks.push({
            weekNum: i + 1,         // Display as W1, W2, ..., W24
            actualWeekNum: actualWeek, // Actual week of year for calculations
            start: weekStart,
            label: `W${i + 1}`,
            month: getMonth(weekStart)
        })
    }
    return weeks
}


export default function SettingsPage() {
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [user, setUser] = useState<{ role: string; fullName: string; asanaName: string; email: string } | null>(null)
    const [assignees, setAssignees] = useState<string[]>([])
    const [targets, setTargets] = useState<AssigneeTarget[]>([])
    const [defaultTarget, setDefaultTarget] = useState('160')
    const [selectedMonth, setSelectedMonth] = useState(getMonth(new Date()))
    const [showMonthDropdown, setShowMonthDropdown] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [selectedMember, setSelectedMember] = useState<string>('all')
    const [viewMode, setViewMode] = useState<'month' | 'all'>('month')
    const [dayOffTooltip, setDayOffTooltip] = useState<{
        memberName: string
        weekNum: number
        details: DayOffDetail[]
        deduction: number
        x: number
        y: number
    } | null>(null)
    const defaultTargetRef = useRef(defaultTarget)
    defaultTargetRef.current = defaultTarget
    const initialLoadDone = useRef(false)
    const syncRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const fetchDataRef = useRef<() => Promise<void>>(async () => { })

    const weeks2026 = useMemo(() => getWeeksOf2026(), [])
    const currentWeekNum = getWeek(new Date(), { weekStartsOn: 1 })

    // Get weeks in selected month
    const weeksInMonth = useMemo(() => {
        return weeks2026.filter(w => w.month === selectedMonth)
    }, [weeks2026, selectedMonth])

    // Display weeks based on view mode
    const displayWeeks = useMemo(() => {
        return viewMode === 'month' ? weeksInMonth : weeks2026
    }, [viewMode, weeksInMonth, weeks2026])

    useEffect(() => {
        const checkAccess = async () => {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            if (!authUser) {
                router.push('/login')
                return
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('role, full_name, asana_name')
                .eq('id', authUser.id)
                .single()

            const role = profile?.role || 'member'
            setUser({
                role,
                fullName: profile?.full_name || '',
                asanaName: profile?.asana_name || profile?.full_name || '',
                email: authUser.email || '',
            })
        }
        checkAccess()
    }, [])

    const fetchData = useCallback(async () => {
        if (!user) return

        // Only show loading spinner on initial load
        if (!initialLoadDone.current) {
            setLoading(true)
        }
        let skippedForRunningSync = false
        try {
            const { data: latestSync } = await supabase
                .from('sync_logs')
                .select('status')
                .order('started_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (latestSync?.status === 'running') {
                skippedForRunningSync = true
                if (syncRetryTimeoutRef.current) clearTimeout(syncRetryTimeoutRef.current)
                syncRetryTimeoutRef.current = setTimeout(() => {
                    fetchDataRef.current()
                }, 2500)
                return
            }

            // Fetch ALL profiles to build member list (not from tasks)
            // Include role_creative to filter only creative team members
            const { data: allProfiles } = await supabase
                .from('profiles')
                .select('full_name, asana_name, role, role_creative, email')

            // Build member list from profiles — use asana_name as the display/match key
            // Only include members who belong to creative team (role_creative != 'none')
            let memberNames: string[] = []
            const profileNameMap: Record<string, string> = {} // asana_name -> display name
            const profileNameByEmail: Record<string, string> = {}

            if (allProfiles) {
                allProfiles.forEach(p => {
                    const displayName = p.asana_name || p.full_name
                    if (!displayName) return
                    if (p.email) {
                        profileNameByEmail[p.email.toLowerCase()] = displayName
                    }
                    // Skip admin accounts that don't have tasks (like tienhv)
                    if (p.role === 'admin' && !p.asana_name) return
                    // Only include creative team members
                    if (p.role_creative === 'none') return
                    memberNames.push(displayName)
                    profileNameMap[displayName] = displayName
                })
            }

            // Role-based filtering: Member chỉ thấy bản thân
            if (user.role === 'member') {
                memberNames = memberNames.filter(name =>
                    name === user.asanaName || name === user.fullName
                )
                // Ensure the member always sees themselves
                if (memberNames.length === 0) {
                    const selfName = user.asanaName || user.fullName
                    if (selfName) memberNames = [selfName]
                }
            }

            memberNames = [...new Set(memberNames)].sort()

            setAssignees(memberNames)

            // Fetch all tasks
            const tasks = await fetchAllPages<{
                id: string
                assignee_name: string | null
                assignee_email: string | null
                video_type: string | null
                video_count: number
                points: number
                due_date: string | null
                completed_at: string | null
                status: string
                project_type: string | null
            }>((from, to) =>
                supabase
                    .from('tasks')
                    .select('id, assignee_name, assignee_email, video_type, video_count, points, due_date, completed_at, status, project_type')
                    .eq('project_type', 'creative')
                    .order('id', { ascending: true })
                    .range(from, to)
            )



            // Fetch existing targets
            const { data: existingTargets } = await supabase
                .from('targets')
                .select('id, user_gid, week_start_date, target_points, project_type')
                .eq('project_type', 'creative')

            // Fetch day offs for all members.
            const dayOffsData = await fetchAllPages<DayOffRecord>((from, to) =>
                supabase
                    .from('day_offs')
                    .select('user_email, member_name, date, is_half_day')
                    .order('date', { ascending: true })
                    .range(from, to)
            )

            const targetsMap: Record<string, Record<number, number>> = {}
            const actualPointsMap: Record<string, Record<number, number>> = {}
            const dayOffDeductionsMap: Record<string, Record<number, number>> = {}
            const companyHolidayDeductionsMap: Record<string, Record<number, number>> = {}
            const dayOffDetailsMap: Record<string, Record<number, DayOffDetail[]>> = {}

            memberNames.forEach(name => {
                targetsMap[name] = {}
                actualPointsMap[name] = {}
                dayOffDeductionsMap[name] = {}
                companyHolidayDeductionsMap[name] = {}
                dayOffDetailsMap[name] = {}
            })

            // Process existing targets
            if (existingTargets) {
                existingTargets.forEach(t => {
                    const weekStart = new Date(t.week_start_date)
                    const weekNum = getWeek(weekStart, { weekStartsOn: 1 })
                    if (!targetsMap[t.user_gid]) {
                        targetsMap[t.user_gid] = {}
                    }
                    targetsMap[t.user_gid][weekNum] = t.target_points
                })
            }

            // Process day offs: calculate deductions per member per week
            {
                const dayOffsByMemberDate = new Map<string, DayOffRecord>()
                dayOffsData.forEach((dayOff: DayOffRecord) => {
                    if (!dayOff.member_name || !dayOff.date) return
                    const key = `${dayOff.member_name}|${dayOff.date}`
                    const existing = dayOffsByMemberDate.get(key)
                    if (!existing || dayOff.user_email === 'system@holiday') {
                        dayOffsByMemberDate.set(key, dayOff)
                    }
                })

                dayOffsByMemberDate.forEach((dayOff) => {
                    const memberName = dayOff.member_name
                    if (!memberName) return
                    const date = new Date(dayOff.date + 'T00:00:00')
                    if (date.getFullYear() !== 2026) return

                    // Weekly targets are distributed across working days Mon-Thu.
                    if (!isTargetDeductionDay(date)) return

                    const weekNum = getWeek(date, { weekStartsOn: 1 })

                    const weeklyTarget = targetsMap[memberName]?.[weekNum] || parseInt(defaultTargetRef.current) || 160
                    const ptsPerDay = weeklyTarget / WORKING_DAYS_PER_WEEK
                    const deduction = dayOff.is_half_day ? ptsPerDay / 2 : ptsPerDay

                    if (!dayOffDeductionsMap[memberName]) {
                        dayOffDeductionsMap[memberName] = {}
                    }
                    if (!companyHolidayDeductionsMap[memberName]) {
                        companyHolidayDeductionsMap[memberName] = {}
                    }
                    if (!dayOffDetailsMap[memberName]) {
                        dayOffDetailsMap[memberName] = {}
                    }
                    if (!dayOffDetailsMap[memberName][weekNum]) {
                        dayOffDetailsMap[memberName][weekNum] = []
                    }
                    dayOffDetailsMap[memberName][weekNum].push({
                        date: dayOff.date,
                        is_half_day: dayOff.is_half_day
                    })
                    const currentDeduction = dayOffDeductionsMap[memberName][weekNum] || 0
                    // Cap deduction at the weekly target (can't deduct more than target)
                    dayOffDeductionsMap[memberName][weekNum] = Math.min(currentDeduction + deduction, weeklyTarget)
                    if (dayOff.user_email === 'system@holiday') {
                        const currentHolidayDeduction = companyHolidayDeductionsMap[memberName][weekNum] || 0
                        companyHolidayDeductionsMap[memberName][weekNum] = Math.min(currentHolidayDeduction + deduction, weeklyTarget)
                    }
                })
            }

            // Calculate actual points from completed tasks
            // Use due_date for week grouping (consistent with dashboard overview)
            tasks.forEach(task => {
                const profileName = task.assignee_email
                    ? profileNameByEmail[task.assignee_email.toLowerCase()]
                    : undefined
                const assigneeName = profileName || task.assignee_name

                if (!assigneeName) return
                if (task.status !== 'done') return
                if (user.role === 'member') {
                    const taskEmail = task.assignee_email?.toLowerCase()
                    const userEmail = user.email.toLowerCase()
                    const isOwnTask =
                        assigneeName === user.asanaName ||
                        assigneeName === user.fullName ||
                        task.assignee_name === user.asanaName ||
                        task.assignee_name === user.fullName ||
                        (Boolean(taskEmail) && taskEmail === userEmail)
                    if (!isOwnTask) return
                }

                // Use due_date to determine which week the task belongs to
                // This matches the dashboard overview logic
                const taskDate = task.due_date ? new Date(task.due_date) : null

                if (!taskDate) return

                const year = taskDate.getFullYear()
                const month = taskDate.getMonth()

                if (year !== 2026) return
                if (month < 1) return

                const weekNum = getWeek(taskDate, { weekStartsOn: 1 })
                const points = task.points || 0

                if (!actualPointsMap[assigneeName]) {
                    actualPointsMap[assigneeName] = {}
                }
                actualPointsMap[assigneeName][weekNum] =
                    (actualPointsMap[assigneeName][weekNum] || 0) + points
            })

            const targetsArray = memberNames.map(name => ({
                assignee_name: name,
                targets: targetsMap[name] || {},
                actualPoints: actualPointsMap[name] || {},
                dayOffDeductions: dayOffDeductionsMap[name] || {},
                companyHolidayDeductions: companyHolidayDeductionsMap[name] || {},
                dayOffDetails: dayOffDetailsMap[name] || {}
            }))

            setTargets(targetsArray)
        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            if (!skippedForRunningSync) {
                setLoading(false)
                initialLoadDone.current = true
            }
        }
    }, [user, supabase])

    fetchDataRef.current = fetchData

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Realtime subscription to auto-refresh when tasks are updated
    useEffect(() => {
        if (!user) return

        // Debounce refetch to avoid rapid reloading
        let timeoutId: NodeJS.Timeout | null = null

        const channel = supabase
            .channel('tasks-realtime')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'tasks' },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (payload: any) => {

                    // Debounce: wait 2 seconds before refetching
                    if (timeoutId) clearTimeout(timeoutId)
                    timeoutId = setTimeout(() => {
                        fetchData()
                    }, 2000)
                }
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'sync_logs' },
                () => {
                    if (timeoutId) clearTimeout(timeoutId)
                    timeoutId = setTimeout(() => {
                        fetchDataRef.current()
                    }, 1000)
                }
            )
            .subscribe()

        return () => {
            if (timeoutId) clearTimeout(timeoutId)
            if (syncRetryTimeoutRef.current) clearTimeout(syncRetryTimeoutRef.current)
            supabase.removeChannel(channel)
        }
    }, [supabase, user, fetchData])

    const updateTarget = (assigneeName: string, weekNum: number, value: number) => {
        setTargets(prev => prev.map(t => {
            if (t.assignee_name === assigneeName) {
                return {
                    ...t,
                    targets: { ...t.targets, [weekNum]: value }
                }
            }
            return t
        }))
    }

    // Apply to weeks in selected month — respects member filter
    const applyToMonth = () => {
        setTargets(prev => prev.map(t => {
            // If a specific member is selected, only update that member
            if (selectedMember !== 'all' && t.assignee_name !== selectedMember) return t
            const newTargets = { ...t.targets }
            weeksInMonth.forEach(w => {
                newTargets[w.actualWeekNum] = parseInt(defaultTarget) || 160
            })
            return { ...t, targets: newTargets }
        }))
        const memberLabel = selectedMember === 'all' ? 'tất cả thành viên' : selectedMember
        setMessage({ type: 'success', text: `✅ Đã áp dụng ${parseInt(defaultTarget) || 160} điểm cho ${memberLabel} trong ${MONTHS_2026[selectedMonth].label}` })
        setTimeout(() => setMessage(null), 5000)
    }

    const saveTargets = async () => {
        setSaving(true)
        try {
            const records: { user_gid: string; week_start_date: string; target_points: number; project_type: string }[] = []

            targets.forEach(t => {
                Object.entries(t.targets).forEach(([weekNumStr, points]) => {
                    if (points <= 0) return // Skip zero/negative targets
                    const weekNum = parseInt(weekNumStr)
                    // Map actual week number back to correct date
                    const weekInfo = weeks2026.find(w => w.actualWeekNum === weekNum)
                    const weekStart = weekInfo
                        ? weekInfo.start
                        : addWeeks(startOfWeek(new Date(2026, 0, 1), { weekStartsOn: 1 }), weekNum - 1)
                    records.push({
                        user_gid: t.assignee_name,
                        week_start_date: format(weekStart, 'yyyy-MM-dd'),
                        target_points: points,
                        project_type: 'creative'
                    })
                })
            })

            // Delete existing targets for visible members only
            for (const t of targets) {
                await supabase.from('targets').delete().eq('user_gid', t.assignee_name)
            }

            if (records.length > 0) {
                const { error } = await supabase.from('targets').insert(records)
                if (error) throw error
            }

            setMessage({ type: 'success', text: 'Đã lưu mục tiêu thành công!' })
            setTimeout(() => setMessage(null), 3000)
        } catch (error) {
            console.error('Error saving targets:', error)
            setMessage({ type: 'error', text: 'Lỗi khi lưu mục tiêu' })
        } finally {
            setSaving(false)
        }
    }

    if (loading || !user) {
        return (
            <DashboardLayout>
                <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-slate-400">Loading settings...</p>
                    </div>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-slate-950">
                {/* Header */}
                <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Target className="w-6 h-6 text-purple-400" />
                            <div>
                                <h2 className="text-xl font-bold text-white">Mục Tiêu Target</h2>
                                <p className="text-sm text-slate-400">
                                    {user.role === 'member'
                                        ? `Cấu hình mục tiêu điểm cho ${user.asanaName || user.fullName}`
                                        : 'Cấu hình mục tiêu điểm cho từng thành viên theo tuần'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={saveTargets}
                            disabled={saving}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 shadow-lg shadow-green-900/30"
                        >
                            <Save className={`w-4 h-4 ${saving ? 'animate-pulse' : ''}`} />
                            {saving ? 'Đang lưu...' : 'Lưu tất cả'}
                        </button>
                    </div>
                </header>

                {/* Message */}
                {message && (
                    <div className="px-6 mt-4">
                        <div className={`p-3 rounded-xl ${message.type === 'success'
                            ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                            : 'bg-red-500/10 border border-red-500/20 text-red-400'
                            }`}>
                            {message.text}
                        </div>
                    </div>
                )}

                <main className="p-6">
                    {/* Quick Actions - all users can set targets */}
                    <div className="flex flex-wrap items-center gap-4 mb-6 bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                        <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-purple-400" />
                            <span className="text-sm text-slate-300">Mục tiêu mặc định:</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={defaultTarget}
                                onChange={(e) => setDefaultTarget(e.target.value.replace(/[^0-9]/g, ''))}
                                className="w-24 px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <span className="text-sm text-slate-500">điểm/tuần</span>
                        </div>

                        {/* Month Selector */}
                        <div className="relative">
                            <button
                                onClick={() => setShowMonthDropdown(!showMonthDropdown)}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white hover:bg-slate-600 transition-colors"
                            >
                                {MONTHS_2026[selectedMonth].label} / 2026
                                <ChevronDown className="w-4 h-4" />
                            </button>
                            {showMonthDropdown && (
                                <div className="absolute top-full mt-1 left-0 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1 max-h-60 overflow-y-auto">
                                    {MONTHS_2026.map(month => (
                                        <button
                                            key={month.value}
                                            onClick={() => {
                                                setSelectedMonth(month.value)
                                                setShowMonthDropdown(false)
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition-colors ${selectedMonth === month.value ? 'text-purple-400 bg-slate-700/50' : 'text-slate-300'
                                                }`}
                                        >
                                            {month.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={applyToMonth}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-sm text-purple-300 transition-colors"
                        >
                            + Áp dụng cho {MONTHS_2026[selectedMonth].label}
                        </button>

                        {/* View Mode Toggle */}
                        <div className="flex items-center bg-slate-700/50 rounded-lg p-0.5 border border-slate-600/50">
                            <button
                                onClick={() => setViewMode('month')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    viewMode === 'month'
                                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <Calendar className="w-3.5 h-3.5" />
                                Theo tháng
                            </button>
                            <button
                                onClick={() => setViewMode('all')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    viewMode === 'all'
                                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                                Tất cả tuần
                            </button>
                        </div>

                        {/* Member Filter */}
                        <div className="flex items-center gap-2 ml-auto">
                            <Filter className="w-4 h-4 text-slate-400" />
                            <select
                                value={selectedMember}
                                onChange={(e) => setSelectedMember(e.target.value)}
                                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="all">Tất cả thành viên</option>
                                {assignees.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Targets Table */}
                    <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                                <thead className="bg-slate-700/30 sticky top-0 z-10">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap sticky left-0 bg-slate-800 z-20 min-w-[120px]">
                                            👤 Thành viên
                                        </th>
                                        {displayWeeks.map(week => {
                                            const isCurrentWeek = week.actualWeekNum === currentWeekNum
                                            return (
                                                <th
                                                    key={week.weekNum}
                                                    className={`px-2 py-3 text-xs font-medium text-center whitespace-nowrap ${viewMode === 'month' ? 'min-w-[120px]' : 'min-w-[80px]'} ${isCurrentWeek
                                                        ? 'bg-purple-600/30 text-purple-300'
                                                        : week.month === selectedMonth
                                                            ? 'bg-blue-600/20 text-blue-300'
                                                            : 'text-slate-400'
                                                        }`}
                                                    style={isCurrentWeek ? {
                                                        borderLeft: '2px solid rgb(168, 85, 247)',
                                                        borderRight: '2px solid rgb(168, 85, 247)',
                                                        borderTop: '2px solid rgb(168, 85, 247)',
                                                        boxShadow: 'inset 0 0 12px rgba(168, 85, 247, 0.3), 0 0 8px rgba(168, 85, 247, 0.2)'
                                                    } : undefined}
                                                >
                                                    {week.label}
                                                </th>
                                            )
                                        })}

                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {targets.filter(m => selectedMember === 'all' || m.assignee_name === selectedMember).map((member, memberIdx, filteredArr) => (
                                        <tr key={member.assignee_name} className="hover:bg-slate-700/20">
                                            <td className="px-4 py-3 text-sm font-medium text-white whitespace-nowrap sticky left-0 bg-slate-800/95 z-10">
                                                {member.assignee_name}
                                            </td>
                                            {displayWeeks.map(week => {
                                                const target = member.targets[week.actualWeekNum]
                                                const deduction = member.dayOffDeductions[week.actualWeekNum] || 0
                                                const adjustedTarget = target !== undefined && target > 0 ? Math.max(0, Math.round((target - deduction) * 10) / 10) : undefined
                                                const actual = member.actualPoints[week.actualWeekNum] || 0
                                                const hasTarget = adjustedTarget !== undefined && adjustedTarget > 0
                                                const hasOriginalTarget = target !== undefined && target > 0
                                                const hasActual = actual > 0
                                                const hasDayOff = deduction > 0
                                                const percentage = hasTarget ? (actual / adjustedTarget) * 100 : 0
                                                const isAchieved = percentage >= 100
                                                const isUnderTarget = hasTarget && hasActual && !isAchieved

                                                // Background color based on achievement
                                                let cellBg = ''
                                                if (hasActual && hasTarget) {
                                                    cellBg = isAchieved ? 'bg-green-500/20' : 'bg-red-500/20'
                                                }

                                                const isCurrentWeek = week.actualWeekNum === currentWeekNum
                                                const isLastRow = memberIdx === filteredArr.length - 1

                                                return (
                                                    <td
                                                        key={week.weekNum}
                                                        className={`px-1 py-2 text-center ${isCurrentWeek
                                                            ? 'bg-purple-600/20'
                                                            : week.month === selectedMonth
                                                                ? 'bg-blue-600/10'
                                                                : ''
                                                            } ${cellBg}`}
                                                        style={isCurrentWeek ? {
                                                            borderLeft: '2px solid rgb(168, 85, 247)',
                                                            borderRight: '2px solid rgb(168, 85, 247)',
                                                            ...(isLastRow ? { borderBottom: '2px solid rgb(168, 85, 247)' } : {}),
                                                            boxShadow: 'inset 0 0 12px rgba(168, 85, 247, 0.15)'
                                                        } : undefined}
                                                    >
                                                        <div className="flex flex-col items-center gap-1">
                                                            {/* Points display: actual/adjusted target */}
                                                            <div className={`text-sm font-bold px-2 py-0.5 rounded ${!hasActual && !hasTarget
                                                                ? 'text-slate-500'
                                                                : isAchieved
                                                                    ? 'text-green-400 bg-green-500/30'
                                                                    : isUnderTarget
                                                                        ? 'text-red-400 bg-red-500/30'
                                                                        : 'text-slate-400'
                                                                }`}>
                                                                {hasActual ? (Number.isInteger(actual) ? actual : actual.toFixed(1)) : '-'}/{hasTarget ? adjustedTarget : hasOriginalTarget ? adjustedTarget : '-'}
                                                            </div>
                                                            {/* Day off indicator with tooltip */}
                                                            {hasDayOff && (
                                                                <div
                                                                    className="text-[10px] text-orange-400 flex items-center gap-0.5 cursor-pointer hover:text-orange-300 transition-colors"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                                                                        setDayOffTooltip(prev =>
                                                                            prev?.memberName === member.assignee_name && prev?.weekNum === week.actualWeekNum
                                                                                ? null
                                                                                : {
                                                                                    memberName: member.assignee_name,
                                                                                    weekNum: week.actualWeekNum,
                                                                                    details: member.dayOffDetails[week.actualWeekNum] || [],
                                                                                    deduction,
                                                                                    x: rect.left + rect.width / 2,
                                                                                    y: rect.top
                                                                                }
                                                                        )
                                                                    }}
                                                                >
                                                                    <CalendarOff className="w-3 h-3" />
                                                                    -{deduction.toFixed(0)}
                                                                </div>
                                                            )}
                                                            {/* Target input - all users can edit their own targets */}
                                                            <input
                                                                type="text"
                                                                inputMode="numeric"
                                                                pattern="[0-9]*"
                                                                value={target ? target : ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value.replace(/[^0-9]/g, '')
                                                                    updateTarget(
                                                                        member.assignee_name,
                                                                        week.actualWeekNum,
                                                                        val === '' ? 0 : parseInt(val)
                                                                    )
                                                                }}
                                                                placeholder="0"
                                                                className={`w-14 px-1 py-1 rounded text-center text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 ${hasOriginalTarget
                                                                    ? 'bg-slate-700 text-white'
                                                                    : 'bg-slate-800/50 text-slate-500'
                                                                    }`}
                                                            />
                                                        </div>
                                                    </td>
                                                )
                                            })}

                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Total Summary */}
                    <div className="mt-4 bg-slate-800/50 backdrop-blur-xl border border-yellow-600/30 rounded-2xl p-4">
                        <h3 className="text-sm font-semibold text-yellow-400 mb-3">📊 Tổng kết điểm</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {targets.filter(m => selectedMember === 'all' || m.assignee_name === selectedMember).map((member) => {
                                let totalActual = 0
                                let totalTarget = 0
                                let totalOriginalTarget = 0
                                let totalDayOffDeduction = 0
                                weeks2026.forEach(week => {
                                    const t = member.targets[week.actualWeekNum]
                                    const d = member.dayOffDeductions[week.actualWeekNum] || 0
                                    const h = member.companyHolidayDeductions[week.actualWeekNum] || 0
                                    const hasTarget = t !== undefined && t > 0
                                    const cappedDeduction = hasTarget ? Math.min(d, t) : 0
                                    const cappedHolidayDeduction = hasTarget ? Math.min(h, t) : 0
                                    const adj = hasTarget ? Math.max(0, Math.round((t - cappedDeduction) * 10) / 10) : 0
                                    const targetAfterCompanyHoliday = hasTarget ? Math.max(0, t - cappedHolidayDeduction) : 0
                                    totalOriginalTarget += targetAfterCompanyHoliday
                                    totalDayOffDeduction += Math.max(0, cappedDeduction - cappedHolidayDeduction)
                                    totalTarget += adj
                                    totalActual += member.actualPoints[week.actualWeekNum] || 0
                                })
                                totalTarget = Math.round(totalTarget * 10) / 10
                                totalOriginalTarget = Math.round(totalOriginalTarget * 10) / 10
                                totalDayOffDeduction = Math.round(totalDayOffDeduction * 10) / 10
                                const pct = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0
                                const isAchieved = pct >= 100
                                return (
                                    <div key={member.assignee_name} className={`p-3 rounded-xl border ${isAchieved ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'
                                        }`}>
                                        <div className="text-xs text-slate-400 mb-1 truncate" title={member.assignee_name}>{member.assignee_name}</div>
                                        <div className={`text-lg font-bold ${isAchieved ? 'text-green-400' : 'text-yellow-400'}`}>
                                            {totalActual > 0 ? formatPoint(totalActual) : '0'}
                                            <span className="text-xs font-normal text-slate-500"> / {totalTarget > 0 ? formatPoint(totalTarget) : '0'}</span>
                                        </div>
                                        {totalOriginalTarget > 0 && (
                                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] leading-tight text-slate-500">
                                                <span>Gốc: {formatPoint(totalOriginalTarget)}</span>
                                                {totalDayOffDeduction > 0 && (
                                                    <span className="text-orange-400">Nghỉ cá nhân: -{formatPoint(totalDayOffDeduction)}</span>
                                                )}
                                            </div>
                                        )}
                                        {totalTarget > 0 && (
                                            <div className="mt-1">
                                                <div className="w-full bg-slate-700 rounded-full h-1.5">
                                                    <div className={`h-1.5 rounded-full ${isAchieved ? 'bg-green-500' : 'bg-yellow-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                                </div>
                                                <div className={`text-[10px] mt-0.5 ${isAchieved ? 'text-green-400' : 'text-yellow-400'}`}>{pct.toFixed(1)}%</div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-purple-600/30 rounded" />
                            <span>Tuần hiện tại (W{currentWeekNum})</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-blue-600/20 rounded" />
                            <span>{MONTHS_2026[selectedMonth].label} (đang chọn)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-green-400">●</span>
                            <span>Đạt mục tiêu</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-orange-400">●</span>
                            <span>Chưa đạt mục tiêu</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CalendarOff className="w-4 h-4 text-orange-400" />
                            <span>Có ngày nghỉ (target tự động giảm: target ÷ {WORKING_DAYS_PER_WEEK} ngày)</span>
                        </div>
                    </div>

                    {/* Fixed-position Day Off Tooltip */}
                    {dayOffTooltip && (
                        <>
                            <div className="fixed inset-0 z-[60]" onClick={() => setDayOffTooltip(null)} />
                            <div
                                className="fixed z-[70]"
                                style={{
                                    left: dayOffTooltip.x,
                                    top: dayOffTooltip.y,
                                    transform: 'translate(-50%, -100%) translateY(-8px)'
                                }}
                            >
                                <div className="bg-slate-900 border border-orange-500/40 rounded-lg px-3 py-2 shadow-xl shadow-black/50 min-w-[170px]">
                                    <div className="text-[11px] font-semibold text-orange-400 mb-1.5 flex items-center gap-1">
                                        <CalendarOff className="w-3 h-3" />
                                        Ngày nghỉ — {dayOffTooltip.memberName}
                                    </div>
                                    {dayOffTooltip.details.map((d, i) => {
                                        const dateObj = new Date(d.date + 'T00:00:00')
                                        const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
                                        return (
                                            <div key={i} className="text-[11px] text-slate-300 flex items-center justify-between gap-3 py-0.5">
                                                <span>{dayNames[dateObj.getDay()]} {dateObj.getDate()}/{dateObj.getMonth() + 1}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${d.is_half_day ? 'bg-yellow-500/20 text-yellow-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                                    {d.is_half_day ? '½ ngày' : 'Cả ngày'}
                                                </span>
                                            </div>
                                        )
                                    })}
                                    <div className="mt-1 pt-1 border-t border-slate-700 text-[10px] text-slate-500">
                                        Trừ: -{dayOffTooltip.deduction.toFixed(1)} điểm
                                    </div>
                                </div>
                                {/* Arrow */}
                                <div className="flex justify-center">
                                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-orange-500/40" />
                                </div>
                            </div>
                        </>
                    )}
                </main>
            </div>
        </DashboardLayout>
    )
}
