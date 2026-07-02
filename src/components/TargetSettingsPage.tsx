'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, CalendarOff, ChevronDown, Filter, LayoutGrid, Save, Target } from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import { createClient } from '@/lib/supabase/client'
import { fetchAllPages } from '@/lib/supabase/fetchAllPages'
import { WORKING_DAYS_PER_WEEK, isTargetDeductionDay } from '@/lib/constants'
import {
    buildTargetPeriods,
    buildTargetTimelineWeeks,
    getDefaultTargetHalfKey,
    getTimelineWeekKey,
    TARGET_MONTH_LABELS,
    type TargetHalfKey,
} from '@/lib/targetTimeline'

type ProjectType = 'creative' | 'graphic'

type ThemeConfig = {
    accentText: string
    accentButton: string
    accentButtonHover: string
    accentSoftBg: string
    accentSoftHover: string
    accentSoftBorder: string
    accentSoftText: string
    accentToggle: string
    accentToggleShadow: string
    accentFocus: string
    accentMonthText: string
    accentCurrentBg: string
    accentCurrentText: string
    accentCurrentBorder: string
    accentCurrentShadow: string
    accentLoadingBorder: string
    title: string
    loadingText: string
    allMembersLabel: string
    memberColumnLabel: string
}

type ScreenUser = {
    role: string
    projectRole: string
    fullName: string
    asanaName: string
    email: string
}

type DayOffDetail = {
    date: string
    is_half_day: boolean
}

type AssigneeTarget = {
    assignee_name: string
    targets: Record<string, number>
    actualPoints: Record<string, number>
    dayOffDeductions: Record<string, number>
    companyHolidayDeductions: Record<string, number>
    dayOffDetails: Record<string, DayOffDetail[]>
}

type DayOffRecord = {
    user_email?: string | null
    member_name: string | null
    date: string
    is_half_day: boolean
}

type ProfileRow = {
    role?: string | null
    role_creative?: string | null
    role_graphic?: string | null
    full_name?: string | null
    asana_name?: string | null
    email?: string | null
}

type TargetSettingsPageProps = {
    projectType: ProjectType
    theme: ThemeConfig
}

function formatPoint(value: number): string {
    const rounded = Math.round(value * 10) / 10
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function getProjectRole(profile: ProfileRow | null, projectType: ProjectType) {
    const globalRole = profile?.role || 'member'
    return projectType === 'creative'
        ? (profile?.role_creative || globalRole)
        : (profile?.role_graphic || 'none')
}

function shouldIncludeAssigneeRow(profile: ProfileRow, projectType: ProjectType) {
    return getProjectRole(profile, projectType) === 'member'
}

function getSelectedMonthLabel(month: number, year: number) {
    return `${TARGET_MONTH_LABELS[month]} / ${year}`
}

function canManageDefaultTarget(user: ScreenUser | null) {
    if (!user) return false
    return ['admin', 'lead'].includes(user.role) || ['admin', 'lead', 'manager'].includes(user.projectRole)
}

export default function TargetSettingsPage({ projectType, theme }: TargetSettingsPageProps) {
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])

    const timelineWeeks = useMemo(() => buildTargetTimelineWeeks(), [])
    const periodOptions = useMemo(() => buildTargetPeriods(), [])
    const supportedWeekKeys = useMemo(() => timelineWeeks.map(week => week.weekKey), [timelineWeeks])
    const supportedWeekKeySet = useMemo(() => new Set(supportedWeekKeys), [supportedWeekKeys])
    const currentWeekKey = useMemo(() => getTimelineWeekKey(new Date()), [])

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [user, setUser] = useState<ScreenUser | null>(null)
    const [assignees, setAssignees] = useState<string[]>([])
    const [targets, setTargets] = useState<AssigneeTarget[]>([])
    const [defaultTarget, setDefaultTarget] = useState('160')
    const [selectedHalf, setSelectedHalf] = useState<TargetHalfKey>(() => getDefaultTargetHalfKey())
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
    const [showHalfDropdown, setShowHalfDropdown] = useState(false)
    const [showMonthDropdown, setShowMonthDropdown] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [selectedMember, setSelectedMember] = useState<string>('all')
    const [viewMode, setViewMode] = useState<'month' | 'all'>('month')
    const [dayOffTooltip, setDayOffTooltip] = useState<{
        memberName: string
        weekKey: string
        details: DayOffDetail[]
        deduction: number
        x: number
        y: number
    } | null>(null)

    const defaultTargetRef = useRef(defaultTarget)
    defaultTargetRef.current = defaultTarget

    const selectedPeriod = useMemo(
        () => periodOptions.find(period => period.key === selectedHalf) || periodOptions[0],
        [periodOptions, selectedHalf]
    )

    const monthsInSelectedHalf = useMemo(
        () => selectedPeriod.months.map(month => ({ value: month, label: TARGET_MONTH_LABELS[month] })),
        [selectedPeriod]
    )

    useEffect(() => {
        if (!monthsInSelectedHalf.some(month => month.value === selectedMonth)) {
            setSelectedMonth(monthsInSelectedHalf[0]?.value ?? 0)
        }
    }, [monthsInSelectedHalf, selectedMonth])

    const selectedHalfWeeks = useMemo(
        () => timelineWeeks.filter(week => week.halfKey === selectedHalf),
        [selectedHalf, timelineWeeks]
    )

    const weeksInMonth = useMemo(
        () => selectedHalfWeeks.filter(week => week.month === selectedMonth),
        [selectedHalfWeeks, selectedMonth]
    )

    const displayWeeks = useMemo(
        () => (viewMode === 'month' ? weeksInMonth : selectedHalfWeeks),
        [selectedHalfWeeks, viewMode, weeksInMonth]
    )

    const selectedMonthLabel = useMemo(
        () => getSelectedMonthLabel(selectedMonth, selectedPeriod.year),
        [selectedMonth, selectedPeriod.year]
    )
    const canEditDefaultTarget = useMemo(() => canManageDefaultTarget(user), [user])

    const fetchData = useCallback(async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser()
            if (!authUser) {
                router.push('/login')
                return
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('role, role_creative, role_graphic, full_name, asana_name, email')
                .eq('id', authUser.id)
                .single()

            const globalRole = profile?.role || 'member'
            const projectRole = getProjectRole(profile, projectType)

            if (projectType === 'creative' && projectRole === 'idea_creator') {
                router.push('/creative-benchmark')
                return
            }

            const currentUser: ScreenUser = {
                role: globalRole,
                projectRole,
                fullName: profile?.full_name || '',
                asanaName: profile?.asana_name || profile?.full_name || '',
                email: authUser.email || '',
            }
            setUser(currentUser)

            const { data: allProfiles } = await supabase
                .from('profiles')
                .select('full_name, asana_name, role, role_creative, role_graphic, email')

            let memberNames: string[] = []
            const profileNameByEmail: Record<string, string> = {}

            if (allProfiles) {
                allProfiles.forEach(profileRow => {
                    const displayName = profileRow.asana_name || profileRow.full_name
                    if (!displayName) return
                    if (profileRow.email) {
                        profileNameByEmail[profileRow.email.toLowerCase()] = displayName
                    }
                    if (profileRow.role === 'admin' && !profileRow.asana_name) return
                    if (!shouldIncludeAssigneeRow(profileRow, projectType)) return
                    memberNames.push(displayName)
                })
            }

            const isRestrictedMember = projectType === 'creative'
                ? currentUser.role === 'member'
                : currentUser.projectRole === 'member' || (currentUser.role === 'member' && !['admin', 'manager'].includes(currentUser.projectRole))

            if (isRestrictedMember) {
                memberNames = memberNames.filter(name => name === currentUser.asanaName || name === currentUser.fullName)
                if (memberNames.length === 0) {
                    const selfName = currentUser.asanaName || currentUser.fullName
                    if (selfName) memberNames = [selfName]
                }
            }

            memberNames = [...new Set(memberNames)].sort()
            setAssignees(memberNames)

            const tasks = await fetchAllPages<{
                id: string
                assignee_name: string | null
                assignee_email: string | null
                points: number
                due_date: string | null
                status: string
                project_type: string | null
            }>((from, to) =>
                supabase
                    .from('tasks')
                    .select('id, assignee_name, assignee_email, points, due_date, status, project_type')
                    .eq('project_type', projectType)
                    .order('id', { ascending: true })
                    .range(from, to)
            )

            const { data: existingTargets } = await supabase
                .from('targets')
                .select('id, user_gid, week_start_date, target_points, project_type')
                .eq('project_type', projectType)

            const dayOffsData = await fetchAllPages<DayOffRecord>((from, to) =>
                supabase
                    .from('day_offs')
                    .select('user_email, member_name, date, is_half_day')
                    .order('date', { ascending: true })
                    .range(from, to)
            )

            const targetsMap: Record<string, Record<string, number>> = {}
            const actualPointsMap: Record<string, Record<string, number>> = {}
            const dayOffDeductionsMap: Record<string, Record<string, number>> = {}
            const companyHolidayDeductionsMap: Record<string, Record<string, number>> = {}
            const dayOffDetailsMap: Record<string, Record<string, DayOffDetail[]>> = {}

            memberNames.forEach(name => {
                targetsMap[name] = {}
                actualPointsMap[name] = {}
                dayOffDeductionsMap[name] = {}
                companyHolidayDeductionsMap[name] = {}
                dayOffDetailsMap[name] = {}
            })

            existingTargets?.forEach(targetRow => {
                if (!supportedWeekKeySet.has(targetRow.week_start_date)) return
                if (!targetsMap[targetRow.user_gid]) {
                    targetsMap[targetRow.user_gid] = {}
                }
                targetsMap[targetRow.user_gid][targetRow.week_start_date] = targetRow.target_points
            })

            const dayOffsByMemberDate = new Map<string, DayOffRecord>()
            dayOffsData.forEach(dayOff => {
                if (!dayOff.member_name || !dayOff.date) return
                const key = `${dayOff.member_name}|${dayOff.date}`
                const existing = dayOffsByMemberDate.get(key)
                if (!existing || dayOff.user_email === 'system@holiday') {
                    dayOffsByMemberDate.set(key, dayOff)
                }
            })

            dayOffsByMemberDate.forEach(dayOff => {
                const memberName = dayOff.member_name
                if (!memberName) return
                const date = new Date(`${dayOff.date}T00:00:00`)
                if (!isTargetDeductionDay(date)) return

                const weekKey = getTimelineWeekKey(date)
                if (!supportedWeekKeySet.has(weekKey)) return

                const weeklyTarget = targetsMap[memberName]?.[weekKey] || parseInt(defaultTargetRef.current) || 160
                const ptsPerDay = weeklyTarget / WORKING_DAYS_PER_WEEK
                const deduction = dayOff.is_half_day ? ptsPerDay / 2 : ptsPerDay

                if (!dayOffDeductionsMap[memberName]) dayOffDeductionsMap[memberName] = {}
                if (!companyHolidayDeductionsMap[memberName]) companyHolidayDeductionsMap[memberName] = {}
                if (!dayOffDetailsMap[memberName]) dayOffDetailsMap[memberName] = {}
                if (!dayOffDetailsMap[memberName][weekKey]) dayOffDetailsMap[memberName][weekKey] = []

                dayOffDetailsMap[memberName][weekKey].push({
                    date: dayOff.date,
                    is_half_day: dayOff.is_half_day,
                })

                const currentDeduction = dayOffDeductionsMap[memberName][weekKey] || 0
                dayOffDeductionsMap[memberName][weekKey] = Math.min(currentDeduction + deduction, weeklyTarget)

                if (dayOff.user_email === 'system@holiday') {
                    const currentHolidayDeduction = companyHolidayDeductionsMap[memberName][weekKey] || 0
                    companyHolidayDeductionsMap[memberName][weekKey] = Math.min(currentHolidayDeduction + deduction, weeklyTarget)
                }
            })

            tasks.forEach(task => {
                const profileName = task.assignee_email
                    ? profileNameByEmail[task.assignee_email.toLowerCase()]
                    : undefined
                const assigneeName = profileName || task.assignee_name

                if (!assigneeName || task.status !== 'done') return

                if (isRestrictedMember) {
                    const taskEmail = task.assignee_email?.toLowerCase()
                    const userEmail = currentUser.email.toLowerCase()
                    const isOwnTask =
                        assigneeName === currentUser.asanaName ||
                        assigneeName === currentUser.fullName ||
                        task.assignee_name === currentUser.asanaName ||
                        task.assignee_name === currentUser.fullName ||
                        (Boolean(taskEmail) && taskEmail === userEmail)
                    if (!isOwnTask) return
                }

                const taskDate = task.due_date ? new Date(`${task.due_date}T00:00:00`) : null
                if (!taskDate) return

                const weekKey = getTimelineWeekKey(taskDate)
                if (!supportedWeekKeySet.has(weekKey)) return

                if (!actualPointsMap[assigneeName]) {
                    actualPointsMap[assigneeName] = {}
                }
                actualPointsMap[assigneeName][weekKey] = (actualPointsMap[assigneeName][weekKey] || 0) + (task.points || 0)
            })

            setTargets(memberNames.map(name => ({
                assignee_name: name,
                targets: targetsMap[name] || {},
                actualPoints: actualPointsMap[name] || {},
                dayOffDeductions: dayOffDeductionsMap[name] || {},
                companyHolidayDeductions: companyHolidayDeductionsMap[name] || {},
                dayOffDetails: dayOffDetailsMap[name] || {},
            })))
        } catch (error) {
            console.error('Error fetching target settings:', error)
        } finally {
            setLoading(false)
        }
    }, [projectType, router, supportedWeekKeySet, supabase])

    useEffect(() => {
        void fetchData()
    }, [fetchData])

    useEffect(() => {
        if (!user) return

        let timeoutId: NodeJS.Timeout | null = null
        const channel = supabase
            .channel(`${projectType}-target-settings`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
                if (timeoutId) clearTimeout(timeoutId)
                timeoutId = setTimeout(() => {
                    void fetchData()
                }, 2000)
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'targets' }, () => {
                if (timeoutId) clearTimeout(timeoutId)
                timeoutId = setTimeout(() => {
                    void fetchData()
                }, 1200)
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'day_offs' }, () => {
                if (timeoutId) clearTimeout(timeoutId)
                timeoutId = setTimeout(() => {
                    void fetchData()
                }, 1200)
            })
            .subscribe()

        return () => {
            if (timeoutId) clearTimeout(timeoutId)
            supabase.removeChannel(channel)
        }
    }, [fetchData, projectType, supabase, user])

    const updateTarget = (assigneeName: string, weekKey: string, value: number) => {
        setTargets(previous => previous.map(target => {
            if (target.assignee_name !== assigneeName) return target
            return {
                ...target,
                targets: { ...target.targets, [weekKey]: value },
            }
        }))
    }

    const applyToMonth = () => {
        if (!canEditDefaultTarget) {
            setMessage({ type: 'error', text: 'Chỉ manager mới được chỉnh mục tiêu mặc định.' })
            setTimeout(() => setMessage(null), 3000)
            return
        }

        const targetValue = parseInt(defaultTarget) || 160

        setTargets(previous => previous.map(target => {
            if (selectedMember !== 'all' && target.assignee_name !== selectedMember) return target

            const nextTargets = { ...target.targets }
            weeksInMonth.forEach(week => {
                nextTargets[week.weekKey] = targetValue
            })

            return { ...target, targets: nextTargets }
        }))

        const memberLabel = selectedMember === 'all' ? theme.allMembersLabel.toLowerCase() : selectedMember
        setMessage({ type: 'success', text: `✅ Đã áp dụng ${targetValue} điểm cho ${memberLabel} trong ${selectedMonthLabel}` })
        setTimeout(() => setMessage(null), 5000)
    }

    const saveTargets = async () => {
        setSaving(true)

        try {
            const records: { user_gid: string; week_start_date: string; target_points: number; project_type: string }[] = []

            targets.forEach(target => {
                Object.entries(target.targets).forEach(([weekKey, points]) => {
                    if (points <= 0 || !supportedWeekKeySet.has(weekKey)) return
                    records.push({
                        user_gid: target.assignee_name,
                        week_start_date: weekKey,
                        target_points: points,
                        project_type: projectType,
                    })
                })
            })

            for (const target of targets) {
                await supabase
                    .from('targets')
                    .delete()
                    .eq('user_gid', target.assignee_name)
                    .eq('project_type', projectType)
                    .in('week_start_date', supportedWeekKeys)
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
                        <div className={`w-12 h-12 border-4 ${theme.accentLoadingBorder} border-t-transparent rounded-full animate-spin`} />
                        <p className="text-slate-400">{theme.loadingText}</p>
                    </div>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-slate-950">
                <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Target className={`w-6 h-6 ${theme.accentText}`} />
                            <div>
                                <h2 className="text-xl font-bold text-white">{theme.title}</h2>
                                <p className="text-sm text-slate-400">
                                    {projectType === 'creative'
                                        ? (user.role === 'member'
                                            ? `Cấu hình mục tiêu điểm cho ${user.asanaName || user.fullName}`
                                            : 'Cấu hình mục tiêu điểm cho từng thành viên theo tuần')
                                        : 'Cấu hình mục tiêu điểm cho designer theo tuần'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={saveTargets}
                            disabled={saving}
                            className={`flex items-center gap-2 px-5 py-2.5 ${theme.accentButton} ${theme.accentButtonHover} rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 shadow-lg shadow-green-900/30`}
                        >
                            <Save className={`w-4 h-4 ${saving ? 'animate-pulse' : ''}`} />
                            {saving ? 'Đang lưu...' : 'Lưu tất cả'}
                        </button>
                    </div>
                </header>

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
                    <div className="flex flex-wrap items-center gap-4 mb-6 bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                        <div className="flex items-center gap-2">
                            <Target className={`w-4 h-4 ${theme.accentText}`} />
                            <span className="text-sm text-slate-300">Mục tiêu mặc định:</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={defaultTarget}
                                onChange={event => {
                                    if (!canEditDefaultTarget) return
                                    setDefaultTarget(event.target.value.replace(/[^0-9]/g, ''))
                                }}
                                disabled={!canEditDefaultTarget}
                                readOnly={!canEditDefaultTarget}
                                className={`w-24 px-3 py-1.5 border rounded-lg text-sm text-white focus:outline-none focus:ring-2 ${theme.accentFocus} ${
                                    canEditDefaultTarget
                                        ? 'bg-slate-700 border-slate-600'
                                        : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                                }`}
                            />
                            <span className="text-sm text-slate-500">điểm/tuần</span>
                        </div>

                        <div className="relative">
                            <button
                                onClick={() => setShowHalfDropdown(previous => !previous)}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white hover:bg-slate-600 transition-colors"
                            >
                                {selectedPeriod.label}
                                <ChevronDown className="w-4 h-4" />
                            </button>
                            {showHalfDropdown && (
                                <div className="absolute top-full mt-1 left-0 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1 min-w-[140px]">
                                    {periodOptions.map(period => (
                                        <button
                                            key={period.key}
                                            onClick={() => {
                                                setSelectedHalf(period.key)
                                                setShowHalfDropdown(false)
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition-colors ${
                                                selectedHalf === period.key ? `${theme.accentText} bg-slate-700/50` : 'text-slate-300'
                                            }`}
                                        >
                                            {period.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="relative">
                            <button
                                onClick={() => setShowMonthDropdown(previous => !previous)}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white hover:bg-slate-600 transition-colors"
                            >
                                {selectedMonthLabel}
                                <ChevronDown className="w-4 h-4" />
                            </button>
                            {showMonthDropdown && (
                                <div className="absolute top-full mt-1 left-0 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1 max-h-60 overflow-y-auto min-w-[180px]">
                                    {monthsInSelectedHalf.map(month => (
                                        <button
                                            key={month.value}
                                            onClick={() => {
                                                setSelectedMonth(month.value)
                                                setShowMonthDropdown(false)
                                            }}
                                            className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition-colors ${
                                                selectedMonth === month.value ? `${theme.accentText} bg-slate-700/50` : 'text-slate-300'
                                            }`}
                                        >
                                            {getSelectedMonthLabel(month.value, selectedPeriod.year)}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={applyToMonth}
                            disabled={!canEditDefaultTarget}
                            className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm transition-colors ${
                                canEditDefaultTarget
                                    ? `${theme.accentSoftBg} ${theme.accentSoftHover} ${theme.accentSoftBorder} ${theme.accentSoftText}`
                                    : 'bg-slate-800/60 border-slate-700 text-slate-500 cursor-not-allowed'
                            }`}
                        >
                            + Áp dụng cho {selectedMonthLabel}
                        </button>

                        <div className="flex items-center bg-slate-700/50 rounded-lg p-0.5 border border-slate-600/50">
                            <button
                                onClick={() => setViewMode('month')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    viewMode === 'month'
                                        ? `${theme.accentToggle} text-white shadow-lg ${theme.accentToggleShadow}`
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
                                        ? `${theme.accentToggle} text-white shadow-lg ${theme.accentToggleShadow}`
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                                Toàn bộ H
                            </button>
                        </div>

                        <div className="flex items-center gap-2 ml-auto">
                            <Filter className="w-4 h-4 text-slate-400" />
                            <select
                                value={selectedMember}
                                onChange={event => setSelectedMember(event.target.value)}
                                className={`px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 ${theme.accentFocus}`}
                            >
                                <option value="all">{theme.allMembersLabel}</option>
                                {assignees.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                                <thead className="bg-slate-700/30 sticky top-0 z-10">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap sticky left-0 bg-slate-800 z-20 min-w-[140px]">
                                            {theme.memberColumnLabel}
                                        </th>
                                        {displayWeeks.map(week => {
                                            const isCurrentWeek = week.weekKey === currentWeekKey
                                            return (
                                                <th
                                                    key={week.weekKey}
                                                    className={`px-2 py-3 text-xs font-medium text-center whitespace-nowrap min-w-[120px] ${
                                                        isCurrentWeek
                                                            ? `${theme.accentCurrentBg} ${theme.accentCurrentText}`
                                                            : week.month === selectedMonth
                                                                ? `${theme.accentMonthText} bg-blue-600/20`
                                                                : 'text-slate-400'
                                                    }`}
                                                    style={isCurrentWeek ? {
                                                        borderLeft: `2px solid ${theme.accentCurrentBorder}`,
                                                        borderRight: `2px solid ${theme.accentCurrentBorder}`,
                                                        borderTop: `2px solid ${theme.accentCurrentBorder}`,
                                                        boxShadow: theme.accentCurrentShadow,
                                                    } : undefined}
                                                >
                                                    {week.label}
                                                </th>
                                            )
                                        })}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {targets.filter(member => selectedMember === 'all' || member.assignee_name === selectedMember).map((member, memberIndex, filteredMembers) => (
                                        <tr key={member.assignee_name} className="hover:bg-slate-700/20">
                                            <td className="px-4 py-3 text-sm font-medium text-white whitespace-nowrap sticky left-0 bg-slate-800/95 z-10">
                                                {member.assignee_name}
                                            </td>
                                            {displayWeeks.map(week => {
                                                const target = member.targets[week.weekKey]
                                                const deduction = member.dayOffDeductions[week.weekKey] || 0
                                                const adjustedTarget = target !== undefined && target > 0 ? Math.max(0, Math.round((target - deduction) * 10) / 10) : undefined
                                                const actual = member.actualPoints[week.weekKey] || 0
                                                const hasTarget = adjustedTarget !== undefined && adjustedTarget > 0
                                                const hasOriginalTarget = target !== undefined && target > 0
                                                const hasActual = actual > 0
                                                const hasDayOff = deduction > 0
                                                const percentage = hasTarget ? (actual / adjustedTarget) * 100 : 0
                                                const isAchieved = percentage >= 100
                                                const isUnderTarget = hasTarget && hasActual && !isAchieved
                                                const isCurrentWeek = week.weekKey === currentWeekKey
                                                const isLastRow = memberIndex === filteredMembers.length - 1

                                                let cellBg = ''
                                                if (hasActual && hasTarget) {
                                                    cellBg = isAchieved ? 'bg-green-500/20' : 'bg-red-500/20'
                                                }

                                                return (
                                                    <td
                                                        key={week.weekKey}
                                                        className={`px-1 py-2 text-center ${
                                                            isCurrentWeek
                                                                ? theme.accentCurrentBg
                                                                : week.month === selectedMonth
                                                                    ? 'bg-blue-600/10'
                                                                    : ''
                                                        } ${cellBg}`}
                                                        style={isCurrentWeek ? {
                                                            borderLeft: `2px solid ${theme.accentCurrentBorder}`,
                                                            borderRight: `2px solid ${theme.accentCurrentBorder}`,
                                                            ...(isLastRow ? { borderBottom: `2px solid ${theme.accentCurrentBorder}` } : {}),
                                                            boxShadow: `inset 0 0 12px rgba(255,255,255,0.04)`,
                                                        } : undefined}
                                                    >
                                                        <div className="flex flex-col items-center gap-1">
                                                            <div className={`text-sm font-bold px-2 py-0.5 rounded ${
                                                                !hasActual && !hasTarget
                                                                    ? 'text-slate-500'
                                                                    : isAchieved
                                                                        ? 'text-green-400 bg-green-500/30'
                                                                        : isUnderTarget
                                                                            ? 'text-red-400 bg-red-500/30'
                                                                            : 'text-slate-400'
                                                            }`}>
                                                                {hasActual ? (Number.isInteger(actual) ? actual : actual.toFixed(1)) : '-'}/{hasTarget ? adjustedTarget : hasOriginalTarget ? adjustedTarget : '-'}
                                                            </div>
                                                            {hasDayOff && (
                                                                <div
                                                                    className="text-[10px] text-orange-400 flex items-center gap-0.5 cursor-pointer hover:text-orange-300 transition-colors"
                                                                    onClick={event => {
                                                                        event.stopPropagation()
                                                                        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
                                                                        setDayOffTooltip(previous =>
                                                                            previous?.memberName === member.assignee_name && previous?.weekKey === week.weekKey
                                                                                ? null
                                                                                : {
                                                                                    memberName: member.assignee_name,
                                                                                    weekKey: week.weekKey,
                                                                                    details: member.dayOffDetails[week.weekKey] || [],
                                                                                    deduction,
                                                                                    x: rect.left + rect.width / 2,
                                                                                    y: rect.top,
                                                                                }
                                                                        )
                                                                    }}
                                                                >
                                                                    <CalendarOff className="w-3 h-3" />
                                                                    -{deduction.toFixed(0)}
                                                                </div>
                                                            )}
                                                            <input
                                                                type="number"
                                                                value={target || ''}
                                                                onChange={event => updateTarget(member.assignee_name, week.weekKey, parseInt(event.target.value) || 0)}
                                                                placeholder="0"
                                                                className={`w-20 px-1 py-1 rounded text-center text-xs focus:outline-none focus:ring-2 ${theme.accentFocus} ${
                                                                    hasOriginalTarget
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

                    <div className="mt-4 bg-slate-800/50 backdrop-blur-xl border border-yellow-600/30 rounded-2xl p-4">
                        <h3 className="text-sm font-semibold text-yellow-400 mb-3">📊 Tổng kết điểm • {selectedPeriod.label}</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {targets.filter(member => selectedMember === 'all' || member.assignee_name === selectedMember).map(member => {
                                let totalActual = 0
                                let totalTarget = 0
                                let totalOriginalTarget = 0
                                let totalDayOffDeduction = 0

                                selectedHalfWeeks.forEach(week => {
                                    const target = member.targets[week.weekKey]
                                    const deduction = member.dayOffDeductions[week.weekKey] || 0
                                    const holidayDeduction = member.companyHolidayDeductions[week.weekKey] || 0
                                    const hasTarget = target !== undefined && target > 0
                                    const cappedDeduction = hasTarget ? Math.min(deduction, target) : 0
                                    const cappedHolidayDeduction = hasTarget ? Math.min(holidayDeduction, target) : 0
                                    const adjustedTarget = hasTarget ? Math.max(0, Math.round((target - cappedDeduction) * 10) / 10) : 0
                                    const targetAfterCompanyHoliday = hasTarget ? Math.max(0, target - cappedHolidayDeduction) : 0

                                    totalOriginalTarget += targetAfterCompanyHoliday
                                    totalDayOffDeduction += Math.max(0, cappedDeduction - cappedHolidayDeduction)
                                    totalTarget += adjustedTarget
                                    totalActual += member.actualPoints[week.weekKey] || 0
                                })

                                totalTarget = Math.round(totalTarget * 10) / 10
                                totalOriginalTarget = Math.round(totalOriginalTarget * 10) / 10
                                totalDayOffDeduction = Math.round(totalDayOffDeduction * 10) / 10

                                const pct = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0
                                const isAchieved = pct >= 100

                                return (
                                    <div
                                        key={member.assignee_name}
                                        className={`p-3 rounded-xl border ${isAchieved ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}
                                    >
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

                    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-blue-600/20 rounded" />
                            <span>{selectedMonthLabel} (đang chọn)</span>
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

                    {dayOffTooltip && (
                        <>
                            <div className="fixed inset-0 z-[60]" onClick={() => setDayOffTooltip(null)} />
                            <div
                                className="fixed z-[70]"
                                style={{
                                    left: dayOffTooltip.x,
                                    top: dayOffTooltip.y,
                                    transform: 'translate(-50%, -100%) translateY(-8px)',
                                }}
                            >
                                <div className="bg-slate-900 border border-orange-500/40 rounded-lg px-3 py-2 shadow-xl shadow-black/50 min-w-[170px]">
                                    <div className="text-[11px] font-semibold text-orange-400 mb-1.5 flex items-center gap-1">
                                        <CalendarOff className="w-3 h-3" />
                                        Ngày nghỉ — {dayOffTooltip.memberName}
                                    </div>
                                    {dayOffTooltip.details.map((detail, index) => {
                                        const dateObj = new Date(`${detail.date}T00:00:00`)
                                        const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
                                        return (
                                            <div key={index} className="text-[11px] text-slate-300 flex items-center justify-between gap-3 py-0.5">
                                                <span>{dayNames[dateObj.getDay()]} {dateObj.getDate()}/{dateObj.getMonth() + 1}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${detail.is_half_day ? 'bg-yellow-500/20 text-yellow-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                                    {detail.is_half_day ? '½ ngày' : 'Cả ngày'}
                                                </span>
                                            </div>
                                        )
                                    })}
                                    <div className="mt-1 pt-1 border-t border-slate-700 text-[10px] text-slate-500">
                                        Trừ: -{dayOffTooltip.deduction.toFixed(1)} điểm
                                    </div>
                                </div>
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
