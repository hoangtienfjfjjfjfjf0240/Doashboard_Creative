'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Save, Target, ChevronDown, CalendarOff, Filter } from 'lucide-react'
import { format, startOfWeek, addWeeks, getWeek, getMonth } from 'date-fns'
import DashboardLayout from '@/components/DashboardLayout'

interface AssigneeTarget {
    assignee_name: string
    targets: Record<number, number>
    actualPoints: Record<number, number> // Points from Asana tasks
    dayOffDeductions: Record<number, number> // Day off deductions per week
}

interface DayOffRecord {
    member_name: string | null
    date: string
    is_half_day: boolean
}

const WORKING_DAYS_PER_WEEK = 4

// Point configuration for video types - matching user's table
const POINT_CONFIG: Record<string, number> = {
    S1: 3,      // Bumper Ads (6s)
    S2A: 2,     // Gen Hook Prompt to video
    S2B: 2.5,   // Gen Hook Image to video
    S3A: 2,     // Json_Button
    S3B: 5,     // Json_Tutorial
    S4: 3,      // UGC
    S5: 6,      // Motion shot ads
    S6: 7,      // Source + Roto/Tracking
    S7: 10,     // Quay dựng + Roto/Tracking
    S8: 48,     // Video HomePage
    S9A: 2.5,   // Drama: Duration < 10 min
    S9B: 4,     // Drama: Duration 11 - 20 min
    S9C: 7,     // Drama: Duration > 21 min
    S10A: 1,    // Translate
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

function getWeeksOf2026() {
    const weeks: { weekNum: number; actualWeekNum: number; start: Date; label: string; month: number }[] = []
    // Start from Feb 2, 2026 (first Monday of February)
    const feb2 = new Date(2026, 1, 2) // February 2, 2026 (Monday)
    const startActualWeek = getWeek(feb2, { weekStartsOn: 1 })
    console.log('First week of Feb 2026:', startActualWeek, 'Feb 2 is:', feb2.toDateString())

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
    const [user, setUser] = useState<{ role: string; fullName: string; asanaName: string } | null>(null)
    const [assignees, setAssignees] = useState<string[]>([])
    const [targets, setTargets] = useState<AssigneeTarget[]>([])
    const [defaultTarget, setDefaultTarget] = useState('160')
    const [selectedMonth, setSelectedMonth] = useState(getMonth(new Date()))
    const [showMonthDropdown, setShowMonthDropdown] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [selectedMember, setSelectedMember] = useState<string>('all')
    const defaultTargetRef = useRef(defaultTarget)
    defaultTargetRef.current = defaultTarget
    const initialLoadDone = useRef(false)

    const weeks2026 = useMemo(() => getWeeksOf2026(), [])
    const currentWeekNum = getWeek(new Date(), { weekStartsOn: 1 })

    // Get weeks in selected month
    const weeksInMonth = useMemo(() => {
        return weeks2026.filter(w => w.month === selectedMonth)
    }, [weeks2026, selectedMonth])

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
        try {
            // Fetch ALL profiles to build member list (not from tasks)
            // Include role_creative to filter only creative team members
            const { data: allProfiles } = await supabase
                .from('profiles')
                .select('full_name, asana_name, role, role_creative')

            // Build member list from profiles — use asana_name as the display/match key
            // Only include members who belong to creative team (role_creative != 'none')
            let memberNames: string[] = []
            const profileNameMap: Record<string, string> = {} // asana_name -> display name

            if (allProfiles) {
                allProfiles.forEach(p => {
                    const displayName = p.asana_name || p.full_name
                    if (!displayName) return
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
            console.log('Member names from profiles:', memberNames)
            setAssignees(memberNames)

            // Fetch all tasks
            const { data: tasks, error: tasksError } = await supabase
                .from('tasks')
                .select('*')
                .eq('project_type', 'creative')

            console.log('Tasks query result:', { count: tasks?.length, error: tasksError })

            // Fetch existing targets
            const { data: existingTargets } = await supabase
                .from('targets')
                .select('*')
                .eq('project_type', 'creative')

            // Fetch day offs for all members
            const { data: dayOffsData } = await supabase
                .from('day_offs')
                .select('member_name, date, is_half_day')

            const targetsMap: Record<string, Record<number, number>> = {}
            const actualPointsMap: Record<string, Record<number, number>> = {}
            const dayOffDeductionsMap: Record<string, Record<number, number>> = {}

            memberNames.forEach(name => {
                targetsMap[name] = {}
                actualPointsMap[name] = {}
                dayOffDeductionsMap[name] = {}
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
            if (dayOffsData) {
                dayOffsData.forEach((dayOff: DayOffRecord) => {
                    const memberName = dayOff.member_name
                    if (!memberName) return
                    const date = new Date(dayOff.date + 'T00:00:00')
                    if (date.getFullYear() !== 2026) return

                    // Skip weekends (Sat=6, Sun=0) — Mon-Fri are working days
                    const dayOfWeek = date.getDay()
                    if (dayOfWeek === 0 || dayOfWeek === 6) return

                    const weekNum = getWeek(date, { weekStartsOn: 1 })

                    const weeklyTarget = targetsMap[memberName]?.[weekNum] || parseInt(defaultTargetRef.current) || 160
                    const ptsPerDay = weeklyTarget / WORKING_DAYS_PER_WEEK
                    const deduction = dayOff.is_half_day ? ptsPerDay / 2 : ptsPerDay

                    if (!dayOffDeductionsMap[memberName]) {
                        dayOffDeductionsMap[memberName] = {}
                    }
                    const currentDeduction = dayOffDeductionsMap[memberName][weekNum] || 0
                    // Cap deduction at the weekly target (can't deduct more than target)
                    dayOffDeductionsMap[memberName][weekNum] = Math.min(currentDeduction + deduction, weeklyTarget)
                })
            }

            // Calculate actual points from completed tasks
            if (tasks) {
                tasks.forEach(task => {
                    if (!task.assignee_name) return
                    if (task.status !== 'done') return
                    if (user.role === 'member' && task.assignee_name !== user.asanaName && task.assignee_name !== user.fullName) return

                    const completedDate = task.completed_at
                        ? new Date(task.completed_at)
                        : task.due_date ? new Date(task.due_date) : null

                    if (!completedDate) return

                    const year = completedDate.getFullYear()
                    const month = completedDate.getMonth()

                    if (year !== 2026) return
                    if (month < 1) return

                    const weekNum = getWeek(completedDate, { weekStartsOn: 1 })
                    const points = task.points || 0

                    if (!actualPointsMap[task.assignee_name]) {
                        actualPointsMap[task.assignee_name] = {}
                    }
                    actualPointsMap[task.assignee_name][weekNum] =
                        (actualPointsMap[task.assignee_name][weekNum] || 0) + points
                })
            }

            const targetsArray = memberNames.map(name => ({
                assignee_name: name,
                targets: targetsMap[name] || {},
                actualPoints: actualPointsMap[name] || {},
                dayOffDeductions: dayOffDeductionsMap[name] || {}
            }))
            console.log('Setting targets array:', targetsArray)
            setTargets(targetsArray)
        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setLoading(false)
            initialLoadDone.current = true
        }
    }, [user, supabase])

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
                    console.log('Tasks table changed:', payload)
                    // Debounce: wait 2 seconds before refetching
                    if (timeoutId) clearTimeout(timeoutId)
                    timeoutId = setTimeout(() => {
                        fetchData()
                    }, 2000)
                }
            )
            .subscribe()

        return () => {
            if (timeoutId) clearTimeout(timeoutId)
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

    // Apply to all weeks in selected month (for all visible members)
    const applyToMonth = () => {
        setTargets(prev => prev.map(t => {
            const newTargets = { ...t.targets }
            weeksInMonth.forEach(w => {
                newTargets[w.actualWeekNum] = parseInt(defaultTarget) || 160
            })
            return { ...t, targets: newTargets }
        }))
        setMessage({ type: 'success', text: `✅ Đã áp dụng ${parseInt(defaultTarget) || 160} điểm cho tất cả tuần trong ${MONTHS_2026[selectedMonth].label}` })
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
                    <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-700/30 sticky top-0 z-10">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap sticky left-0 bg-slate-800 z-20 min-w-[120px]">
                                            👤 Thành viên
                                        </th>
                                        {weeks2026.map(week => (
                                            <th
                                                key={week.weekNum}
                                                className={`px-2 py-3 text-xs font-medium text-center whitespace-nowrap min-w-[80px] ${week.actualWeekNum === currentWeekNum
                                                    ? 'bg-purple-600/30 text-purple-300'
                                                    : week.month === selectedMonth
                                                        ? 'bg-blue-600/20 text-blue-300'
                                                        : 'text-slate-400'
                                                    }`}
                                            >
                                                {week.label}
                                            </th>
                                        ))}
                                        <th className="px-3 py-3 text-xs font-semibold text-center whitespace-nowrap min-w-[90px] bg-yellow-600/20 text-yellow-300 sticky right-0 z-20">
                                            TOTAL
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {targets.filter(m => selectedMember === 'all' || m.assignee_name === selectedMember).map((member) => (
                                        <tr key={member.assignee_name} className="hover:bg-slate-700/20">
                                            <td className="px-4 py-3 text-sm font-medium text-white whitespace-nowrap sticky left-0 bg-slate-800/95 z-10">
                                                {member.assignee_name}
                                            </td>
                                            {weeks2026.map(week => {
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

                                                return (
                                                    <td
                                                        key={week.weekNum}
                                                        className={`px-1 py-2 text-center ${week.actualWeekNum === currentWeekNum
                                                            ? 'bg-purple-600/20'
                                                            : week.month === selectedMonth
                                                                ? 'bg-blue-600/10'
                                                                : ''
                                                            } ${cellBg}`}
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
                                                            {/* Day off indicator */}
                                                            {hasDayOff && (
                                                                <div className="text-[10px] text-orange-400 flex items-center gap-0.5" title={`Nghỉ: -${deduction.toFixed(1)}đ`}>
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
                                            {/* Total column */}
                                            {(() => {
                                                let totalActual = 0
                                                let totalTarget = 0
                                                weeks2026.forEach(week => {
                                                    const t = member.targets[week.actualWeekNum]
                                                    const d = member.dayOffDeductions[week.actualWeekNum] || 0
                                                    const adj = t !== undefined && t > 0 ? Math.max(0, Math.round((t - d) * 10) / 10) : 0
                                                    totalTarget += adj
                                                    totalActual += member.actualPoints[week.actualWeekNum] || 0
                                                })
                                                const pct = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0
                                                const isAchieved = pct >= 100
                                                return (
                                                    <td className="px-2 py-2 text-center bg-yellow-600/10 sticky right-0 z-10 border-l border-yellow-600/30">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <div className={`text-sm font-bold px-2 py-0.5 rounded ${totalActual === 0 && totalTarget === 0
                                                                    ? 'text-slate-500'
                                                                    : isAchieved
                                                                        ? 'text-green-400 bg-green-500/30'
                                                                        : 'text-yellow-400 bg-yellow-500/30'
                                                                }`}>
                                                                {totalActual > 0 ? (Number.isInteger(totalActual) ? totalActual : totalActual.toFixed(1)) : '-'}/{totalTarget > 0 ? totalTarget : '-'}
                                                            </div>
                                                            {totalTarget > 0 && (
                                                                <div className="text-[10px] text-yellow-400">
                                                                    {pct.toFixed(0)}%
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                )
                                            })()}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
                </main>
            </div>
        </DashboardLayout>
    )
}
