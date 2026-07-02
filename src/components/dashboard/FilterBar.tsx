'use client'

import { useEffect, useRef, useState } from 'react'
import {
    Calendar,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Filter,
    RefreshCw,
    Users,
} from 'lucide-react'
import {
    addDays,
    addMonths,
    differenceInCalendarDays,
    endOfDay,
    format,
    getDate,
    getMonth,
    isSameDay,
    startOfDay,
    startOfMonth,
    subDays,
} from 'date-fns'
import { vi } from 'date-fns/locale'
import { useUser } from '@/contexts/UserContext'
import {
    DASHBOARD_HALF_PRESETS,
    DASHBOARD_MONTH_PRESETS,
    DASHBOARD_QUICK_PRESETS,
    DASHBOARD_TIMELINE,
    DASHBOARD_TIMELINE_WEEK_KEYS,
    DASHBOARD_YEAR_PRESETS,
    getDashboardDateLabel,
    getDashboardFirstWeekStartForHalf,
    getDashboardHalfForDate,
    getDashboardHalfLabel,
    getDateRangeForHalf,
    getDateRangeFromDashboardPreset,
    type DashboardScopePreset,
    type DashboardTimelineWeek,
} from '@/lib/dashboardDatePresets'
import type { TargetHalfKey } from '@/lib/targetTimeline'

type DashboardQuickPresetKey = (typeof DASHBOARD_QUICK_PRESETS)[number]['key']

interface FilterBarProps {
    weekStart: Date
    onWeekChange: (date: Date) => void
    assignees: string[]
    selectedAssignees: string[]
    onAssigneesChange: (assignees: string[]) => void
    status: 'all' | 'done' | 'not_done'
    onStatusChange: (status: 'all' | 'done' | 'not_done') => void
    videoTypes: string[]
    selectedVideoTypes: string[]
    onVideoTypesChange: (types: string[]) => void
    onSync: () => void
    syncing: boolean
    lastSync?: string
    dateRange?: { start: Date; end: Date }
    onDateRangeChange?: (range: { start: Date; end: Date }) => void
    selectedHalf: TargetHalfKey
    onHalfChange: (half: TargetHalfKey) => void
    selectedPreset: DashboardScopePreset | 'custom'
    onPresetChange: (preset: DashboardScopePreset | 'custom') => void
    selectedWeeks: Set<string>
    onWeeksChange: (weeks: Set<string>) => void
}

function MiniCalendar({
    selectedDate,
    onSelectDate,
    viewMonth,
    onChangeMonth,
}: {
    selectedDate: Date | null
    onSelectDate: (date: Date) => void
    viewMonth: Date
    onChangeMonth: (date: Date) => void
}) {
    const monthStart = startOfMonth(viewMonth)
    const firstDayOfWeek = addDays(monthStart, -((monthStart.getDay() + 6) % 7))
    const days: Date[] = []

    for (let index = 0; index < 42; index += 1) {
        days.push(addDays(firstDayOfWeek, index))
    }

    const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

    return (
        <div className="w-full">
            <div className="mb-3 flex items-center justify-between">
                <button
                    onClick={() => onChangeMonth(addMonths(viewMonth, -1))}
                    className="rounded p-1 transition-colors hover:bg-slate-600"
                >
                    <ChevronLeft className="h-4 w-4 text-slate-400" />
                </button>
                <span className="text-sm font-medium text-white">
                    {format(viewMonth, 'MMMM yyyy', { locale: vi })}
                </span>
                <button
                    onClick={() => onChangeMonth(addMonths(viewMonth, 1))}
                    className="rounded p-1 transition-colors hover:bg-slate-600"
                >
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-1">
                {weekDays.map(day => (
                    <div key={day} className="py-1 text-center text-xs text-slate-500">
                        {day}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
                {days.map(day => {
                    const isCurrentMonth = getMonth(day) === getMonth(viewMonth)
                    const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
                    const isToday = isSameDay(day, new Date())

                    return (
                        <button
                            key={day.toISOString()}
                            onClick={() => onSelectDate(day)}
                            className={[
                                'rounded py-1.5 text-center text-xs transition-colors',
                                !isCurrentMonth ? 'text-slate-600' : 'text-slate-300 hover:bg-slate-600',
                                isSelected ? 'bg-purple-500 text-white' : '',
                                isToday && !isSelected ? 'border border-purple-500' : '',
                            ].join(' ')}
                        >
                            {getDate(day)}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

function getWeekByKey(weekKey: string): DashboardTimelineWeek | undefined {
    for (const monthData of DASHBOARD_TIMELINE) {
        const matchedWeek = monthData.weeks.find(week => week.weekKey === weekKey)
        if (matchedWeek) {
            return matchedWeek
        }
    }

    return undefined
}

function getWeeksForHalf(halfKey: TargetHalfKey) {
    return DASHBOARD_TIMELINE
        .flatMap(monthData => monthData.weeks)
        .filter(weekData => getDashboardHalfForDate(weekData.startDate) === halfKey)
}

export default function FilterBar({
    weekStart,
    onWeekChange,
    assignees,
    selectedAssignees,
    onAssigneesChange,
    status,
    onStatusChange,
    videoTypes,
    selectedVideoTypes,
    onVideoTypesChange,
    onSync,
    syncing,
    lastSync,
    dateRange,
    onDateRangeChange,
    selectedHalf,
    onHalfChange,
    selectedPreset,
    onPresetChange,
    selectedWeeks,
    onWeeksChange,
}: FilterBarProps) {
    const { user: userCtx } = useUser()
    const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false)
    const [showTypeDropdown, setShowTypeDropdown] = useState(false)
    const [showHalfDropdown, setShowHalfDropdown] = useState(false)
    const [showDateDropdown, setShowDateDropdown] = useState(false)
    const [showCustomDatePicker, setShowCustomDatePicker] = useState(false)
    const [assigneeSearch, setAssigneeSearch] = useState('')
    const [customStartDate, setCustomStartDate] = useState<Date | null>(null)
    const [customEndDate, setCustomEndDate] = useState<Date | null>(null)
    const [startViewMonth, setStartViewMonth] = useState(new Date(2026, 0, 1))
    const [endViewMonth, setEndViewMonth] = useState(new Date(2026, 0, 1))
    const [lastSelectedWeekKey, setLastSelectedWeekKey] = useState<string | null>(null)

    const assigneeRef = useRef<HTMLDivElement>(null)
    const typeRef = useRef<HTMLDivElement>(null)
    const halfRef = useRef<HTMLDivElement>(null)
    const dateRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (assigneeRef.current && !assigneeRef.current.contains(event.target as Node)) {
                setShowAssigneeDropdown(false)
            }

            if (typeRef.current && !typeRef.current.contains(event.target as Node)) {
                setShowTypeDropdown(false)
            }

            if (halfRef.current && !halfRef.current.contains(event.target as Node)) {
                setShowHalfDropdown(false)
            }

            if (dateRef.current && !dateRef.current.contains(event.target as Node)) {
                setShowDateDropdown(false)
                setShowCustomDatePicker(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const filteredAssignees = assignees.filter(assignee =>
        assignee.toLowerCase().includes(assigneeSearch.toLowerCase())
    )
    const halfRange = getDateRangeForHalf(selectedHalf)
    const visibleTimeline = DASHBOARD_TIMELINE
        .map(monthData => ({
            ...monthData,
            weeks: monthData.weeks.filter(weekData => getDashboardHalfForDate(weekData.startDate) === selectedHalf),
        }))
        .filter(monthData => monthData.weeks.length > 0)
    const visibleTimelineWeeks = visibleTimeline.flatMap(monthData => monthData.weeks)
    const visibleTimelineWeekKeys = visibleTimelineWeeks.map(weekData => weekData.weekKey)
    const activeHalfWeek = visibleTimelineWeeks.find(weekData => {
        const weekEnd = endOfDay(weekData.endDate)
        return weekStart >= weekData.startDate && weekStart <= weekEnd
    }) ?? visibleTimelineWeeks[0]

    const toggleAssignee = (assignee: string) => {
        if (selectedAssignees.includes(assignee)) {
            onAssigneesChange(selectedAssignees.filter(item => item !== assignee))
            return
        }

        onAssigneesChange([...selectedAssignees, assignee])
    }

    const toggleVideoType = (type: string) => {
        if (selectedVideoTypes.includes(type)) {
            onVideoTypesChange(selectedVideoTypes.filter(item => item !== type))
            return
        }

        onVideoTypesChange([...selectedVideoTypes, type])
    }

    const openCustomDatePicker = () => {
        const baseRange = dateRange ?? getDateRangeFromDashboardPreset(selectedPreset === 'custom' ? 'week' : selectedPreset, selectedHalf)
        setCustomStartDate(startOfDay(baseRange.start))
        setCustomEndDate(startOfDay(baseRange.end))
        setStartViewMonth(startOfMonth(baseRange.start))
        setEndViewMonth(startOfMonth(baseRange.end))
        setShowDateDropdown(false)
        setShowCustomDatePicker(true)
    }

    const handleHalfChange = (halfKey: TargetHalfKey) => {
        const range = getDateRangeForHalf(halfKey)
        const firstWeekStart = getDashboardFirstWeekStartForHalf(halfKey) ?? range.start
        const weeksInHalf = getWeeksForHalf(halfKey)
        const today = new Date()
        const currentWeekInHalf = weeksInHalf.find(weekData => {
            const weekEnd = endOfDay(weekData.endDate)
            return today >= weekData.startDate && today <= weekEnd
        })
        const referenceWeekStart = currentWeekInHalf?.startDate ?? firstWeekStart

        onHalfChange(halfKey)
        onPresetChange('half')
        onWeeksChange(new Set())
        setLastSelectedWeekKey(null)

        if (onDateRangeChange) {
            onDateRangeChange(range)
        }

        onWeekChange(referenceWeekStart)
        setShowHalfDropdown(false)
        setShowDateDropdown(false)
        setShowCustomDatePicker(false)
    }

    const selectedHalfIndex = DASHBOARD_HALF_PRESETS.findIndex(option => option.key === selectedHalf)

    const shiftHalf = (direction: -1 | 1) => {
        const nextHalf = DASHBOARD_HALF_PRESETS[selectedHalfIndex + direction]
        if (!nextHalf) {
            return
        }

        handleHalfChange(nextHalf.key)
    }

    const applyRange = (range: { start: Date; end: Date }, preset: DashboardScopePreset | 'custom') => {
        onPresetChange(preset)
        onWeeksChange(new Set())
        setLastSelectedWeekKey(null)
        onHalfChange(getDashboardHalfForDate(range.start))

        if (onDateRangeChange) {
            onDateRangeChange(range)
        }

        onWeekChange(range.start)
    }

    const clampRangeToHalf = (range: { start: Date; end: Date }) => ({
        start: range.start < halfRange.start ? halfRange.start : range.start,
        end: range.end > halfRange.end ? halfRange.end : range.end,
    })

    const getQuickPresetRangeForSelectedHalf = (preset: DashboardQuickPresetKey) => {
        const fallbackRange = getDateRangeFromDashboardPreset(preset, selectedHalf)
        if (!activeHalfWeek) {
            return fallbackRange
        }

        const referenceEnd = dateRange && selectedPreset !== 'half'
            ? (dateRange.end > halfRange.end ? halfRange.end : dateRange.end)
            : endOfDay(activeHalfWeek.endDate)

        switch (preset) {
            case 'week':
                return clampRangeToHalf({
                    start: activeHalfWeek.startDate,
                    end: endOfDay(activeHalfWeek.endDate),
                })
            case '7days': {
                const activeWeekIndex = visibleTimelineWeekKeys.indexOf(activeHalfWeek.weekKey)
                const previousWeek = visibleTimelineWeeks[Math.max(0, activeWeekIndex - 1)] ?? activeHalfWeek

                return clampRangeToHalf({
                    start: previousWeek.startDate,
                    end: endOfDay(previousWeek.endDate),
                })
            }
            case '14days':
                return clampRangeToHalf({ start: startOfDay(subDays(referenceEnd, 13)), end: referenceEnd })
            case '28days':
                return clampRangeToHalf({ start: startOfDay(subDays(referenceEnd, 27)), end: referenceEnd })
            case '30days':
            default:
                return clampRangeToHalf({ start: startOfDay(subDays(referenceEnd, 29)), end: referenceEnd })
        }
    }

    const shiftActiveRange = (direction: -1 | 1) => {
        if (selectedPreset === 'half') {
            const nextWeekStart = addDays(weekStart, direction * 7)
            if (getDashboardHalfForDate(nextWeekStart) !== selectedHalf) {
                return
            }

            const range = {
                start: nextWeekStart,
                end: endOfDay(addDays(nextWeekStart, 4)),
            }

            onPresetChange('custom')
            onWeeksChange(new Set())
            setLastSelectedWeekKey(null)

            if (onDateRangeChange) {
                onDateRangeChange(range)
            }

            onWeekChange(nextWeekStart)
            return
        }

        if (selectedPreset.startsWith('all-')) {
            const year = Number(selectedPreset.slice(4))
            const nextYear = year + direction
            const nextPreset = DASHBOARD_YEAR_PRESETS.find(option => option.key === `all-${nextYear}`)

            if (nextPreset) {
                handlePresetChange(nextPreset.key)
            }

            return
        }

        if (selectedPreset.startsWith('month-')) {
            const [, yearRaw, monthRaw] = selectedPreset.split('-')
            const nextMonth = addMonths(new Date(Number(yearRaw), Number(monthRaw) - 1, 1), direction)
            const nextPreset = DASHBOARD_MONTH_PRESETS.find(option =>
                option.key === `month-${nextMonth.getFullYear()}-${nextMonth.getMonth() + 1}`
            )

            if (nextPreset) {
                handlePresetChange(nextPreset.key)
            }

            return
        }

        const baseRange = dateRange ?? getDateRangeFromDashboardPreset(selectedPreset === 'custom' ? 'week' : selectedPreset, selectedHalf)
        const spanDays = selectedPreset === 'week' || selectedPreset === '7days'
            ? 7
            : selectedPreset === '14days'
                ? 14
                : selectedPreset === '28days'
                    ? 28
                    : selectedPreset === '30days'
                        ? 30
                        : Math.max(1, differenceInCalendarDays(baseRange.end, baseRange.start) + 1)

        applyRange(
            {
                start: addDays(baseRange.start, spanDays * direction),
                end: endOfDay(addDays(baseRange.end, spanDays * direction)),
            },
            'custom'
        )
    }

    const toggleWeekSelect = (weekData: DashboardTimelineWeek, event: React.MouseEvent<HTMLButtonElement>) => {
        const nextSelected = new Set(selectedWeeks)

        if (event.shiftKey && lastSelectedWeekKey) {
            const currentIndex = visibleTimelineWeekKeys.indexOf(weekData.weekKey)
            const lastIndex = visibleTimelineWeekKeys.indexOf(lastSelectedWeekKey)

            if (currentIndex !== -1 && lastIndex !== -1) {
                const [startIndex, endIndex] = currentIndex > lastIndex
                    ? [lastIndex, currentIndex]
                    : [currentIndex, lastIndex]

                for (let index = startIndex; index <= endIndex; index += 1) {
                    nextSelected.add(visibleTimelineWeekKeys[index])
                }
            }
        } else if (nextSelected.has(weekData.weekKey)) {
            nextSelected.delete(weekData.weekKey)
        } else {
            nextSelected.add(weekData.weekKey)
        }

        onWeeksChange(nextSelected)
        setLastSelectedWeekKey(weekData.weekKey)
    }

    const applySelectedWeeks = () => {
        if (selectedWeeks.size === 0) {
            return
        }

        const matchedWeeks = DASHBOARD_TIMELINE_WEEK_KEYS
            .filter(weekKey => selectedWeeks.has(weekKey))
            .map(getWeekByKey)
            .filter((week): week is DashboardTimelineWeek => Boolean(week))

        if (matchedWeeks.length === 0) {
            return
        }

        const minStart = matchedWeeks[0].startDate
        const maxEnd = matchedWeeks[matchedWeeks.length - 1].endDate
        const range = { start: minStart, end: endOfDay(maxEnd) }

        onHalfChange(getDashboardHalfForDate(minStart))
        onPresetChange('custom')

        if (onDateRangeChange) {
            onDateRangeChange(range)
        }

        onWeekChange(minStart)
        setShowDateDropdown(false)
    }

    const handlePresetChange = (preset: DashboardScopePreset | 'custom') => {
        if (preset === 'custom') {
            openCustomDatePicker()
            return
        }

        const range = DASHBOARD_QUICK_PRESETS.some(option => option.key === preset)
            ? getQuickPresetRangeForSelectedHalf(preset as DashboardQuickPresetKey)
            : getDateRangeFromDashboardPreset(preset, selectedHalf)

        onPresetChange(preset)
        onWeeksChange(new Set())
        setLastSelectedWeekKey(null)

        if (preset !== 'half' && !preset.startsWith('all-')) {
            onHalfChange(getDashboardHalfForDate(range.start))
        }

        if (onDateRangeChange) {
            onDateRangeChange(range)
        }

        onWeekChange(range.start)
        setShowDateDropdown(false)
        setShowCustomDatePicker(false)
    }

    const handleApplyCustomRange = () => {
        if (!customStartDate || !customEndDate) {
            return
        }

        const start = customStartDate <= customEndDate ? customStartDate : customEndDate
        const end = customStartDate <= customEndDate ? customEndDate : customStartDate

        applyRange({ start: startOfDay(start), end: endOfDay(end) }, 'custom')
        setShowCustomDatePicker(false)
    }

    const getDateRangeLabel = () => {
        if (selectedPreset === 'half') {
            const weekEnd = addDays(weekStart, 4)
            return `${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM/yyyy')}`
        }

        return getDashboardDateLabel(selectedPreset, dateRange, selectedWeeks.size, selectedHalf)
    }

    return (
        <div className="relative z-[100] mb-6 rounded-2xl border border-slate-700/50 bg-slate-800/50 p-4 backdrop-blur-xl">
            <div className="flex flex-wrap items-center gap-4">
                <div className="relative" ref={halfRef}>
                    <div className="flex items-center gap-2 rounded-xl bg-slate-700/50 p-1">
                        <button
                            onClick={() => shiftHalf(-1)}
                            disabled={selectedHalfIndex <= 0}
                            className="rounded-lg p-2 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronLeft className="h-5 w-5 text-slate-300" />
                        </button>
                        <button
                            onClick={() => {
                                setShowDateDropdown(false)
                                setShowCustomDatePicker(false)
                                setShowHalfDropdown(current => !current)
                            }}
                            className="flex items-center gap-2 rounded-lg px-3 py-1 transition-colors hover:bg-slate-600/50"
                        >
                            <Calendar className="h-4 w-4 text-purple-400" />
                            <span className="whitespace-nowrap text-sm font-medium text-white">
                                {getDashboardHalfLabel(selectedHalf)}
                            </span>
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                        </button>
                        <button
                            onClick={() => shiftHalf(1)}
                            disabled={selectedHalfIndex >= DASHBOARD_HALF_PRESETS.length - 1}
                            className="rounded-lg p-2 transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronRight className="h-5 w-5 text-slate-300" />
                        </button>
                    </div>

                    {showHalfDropdown && (
                        <div className="animate-slide-down absolute left-0 top-full z-[220] mt-2 w-48 overflow-hidden rounded-xl border border-slate-700 bg-slate-800/95 shadow-2xl backdrop-blur-xl">
                            <div className="p-2">
                                {DASHBOARD_HALF_PRESETS.map(option => (
                                    <button
                                        key={option.key}
                                        onClick={() => handleHalfChange(option.key)}
                                        className={[
                                            'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
                                            selectedHalf === option.key
                                                ? 'bg-purple-500/20 text-purple-300'
                                                : 'text-slate-300 hover:bg-slate-700',
                                        ].join(' ')}
                                    >
                                        <span>{option.label}</span>
                                        {selectedHalf === option.key && (
                                            <Check className="h-4 w-4" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="relative" ref={dateRef}>
                    <div className="flex items-center gap-2 rounded-xl bg-slate-700/50 p-1">
                        <button
                            onClick={() => shiftActiveRange(-1)}
                            className="rounded-lg p-2 transition-colors hover:bg-slate-600"
                        >
                            <ChevronLeft className="h-5 w-5 text-slate-300" />
                        </button>
                        <button
                            onClick={() => {
                                setShowHalfDropdown(false)
                                setShowCustomDatePicker(false)
                                setShowDateDropdown(current => !current)
                            }}
                            className="flex items-center gap-2 rounded-lg px-3 py-1 transition-colors hover:bg-slate-600/50"
                        >
                            <Calendar className="h-4 w-4 text-purple-400" />
                            <span className="whitespace-nowrap text-sm font-medium text-white">
                                {getDateRangeLabel()}
                            </span>
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                        </button>
                        <button
                            onClick={() => shiftActiveRange(1)}
                            className="rounded-lg p-2 transition-colors hover:bg-slate-600"
                        >
                            <ChevronRight className="h-5 w-5 text-slate-300" />
                        </button>
                    </div>

                    {showDateDropdown && (
                        <div className="animate-slide-down absolute left-0 top-full z-[210] mt-2 w-[620px] overflow-hidden rounded-xl border border-slate-700 bg-slate-800/95 shadow-2xl backdrop-blur-xl">
                            <div className="flex">
                                <div className="w-72 border-r border-slate-700">
                                    <div className="sticky top-0 border-b border-slate-700 bg-slate-800/95 p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-medium text-slate-300">Timeline (chọn nhiều)</p>
                                                <p className="mt-1 text-[11px] text-slate-500">
                                                    Giữ Shift để chọn nhanh từ tuần đầu đến tuần cuối.
                                                </p>
                                            </div>
                                            {selectedWeeks.size > 0 && (
                                                <button
                                                    onClick={applySelectedWeeks}
                                                    className="rounded bg-purple-500 px-2 py-1 text-xs text-white transition-colors hover:bg-purple-600"
                                                >
                                                    Áp dụng
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="max-h-96 overflow-y-auto p-2">
                                        {visibleTimeline.map(monthData => (
                                            <div key={monthData.month} className="mb-3">
                                                <p className="px-2 py-1 text-xs font-semibold text-purple-400">
                                                    {monthData.month}
                                                </p>
                                                {monthData.weeks.map(weekData => {
                                                    const isSelected = selectedWeeks.has(weekData.weekKey)

                                                    return (
                                                        <button
                                                            key={weekData.weekKey}
                                                            onClick={event => toggleWeekSelect(weekData, event)}
                                                            className={[
                                                                'flex w-full items-center justify-between rounded px-3 py-1.5 text-left text-xs transition-colors',
                                                                isSelected
                                                                    ? 'bg-purple-500/20 text-purple-300'
                                                                    : 'text-slate-300 hover:bg-slate-700',
                                                            ].join(' ')}
                                                        >
                                                            <span>{`Tuần ${weekData.week}: ${weekData.range}`}</span>
                                                            {isSelected && <Check className="h-3 w-3" />}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <div className="border-b border-slate-700 p-3">
                                        <p className="text-xs font-medium text-slate-300">Chọn nhanh</p>
                                    </div>
                                    <div className="max-h-96 overflow-y-auto p-2">
                                        {DASHBOARD_QUICK_PRESETS.map(option => (
                                            <button
                                                key={option.key}
                                                onClick={() => handlePresetChange(option.key)}
                                                className={[
                                                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
                                                    (selectedPreset === option.key || (selectedPreset === 'half' && option.key === 'week')) && selectedWeeks.size === 0
                                                        ? 'bg-purple-500/20 text-purple-300'
                                                        : 'text-slate-300 hover:bg-slate-700',
                                                ].join(' ')}
                                            >
                                                <span>{option.label}</span>
                                                {(selectedPreset === option.key || (selectedPreset === 'half' && option.key === 'week')) && selectedWeeks.size === 0 && (
                                                    <Check className="h-4 w-4" />
                                                )}
                                            </button>
                                        ))}

                                        <hr className="my-2 border-slate-700" />
                                        <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                                            Theo năm
                                        </p>
                                        {DASHBOARD_YEAR_PRESETS.map(option => (
                                            <button
                                                key={option.key}
                                                onClick={() => handlePresetChange(option.key)}
                                                className={[
                                                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
                                                    selectedPreset === option.key && selectedWeeks.size === 0
                                                        ? 'bg-purple-500/20 text-purple-300'
                                                        : 'text-slate-300 hover:bg-slate-700',
                                                ].join(' ')}
                                            >
                                                <span>{option.label}</span>
                                                {selectedPreset === option.key && selectedWeeks.size === 0 && (
                                                    <Check className="h-4 w-4" />
                                                )}
                                            </button>
                                        ))}

                                        <hr className="my-2 border-slate-700" />
                                        <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                                            Theo tháng
                                        </p>
                                        {DASHBOARD_MONTH_PRESETS.map(option => (
                                            <button
                                                key={option.key}
                                                onClick={() => handlePresetChange(option.key)}
                                                className={[
                                                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors',
                                                    selectedPreset === option.key && selectedWeeks.size === 0
                                                        ? 'bg-purple-500/20 text-purple-300'
                                                        : 'text-slate-300 hover:bg-slate-700',
                                                ].join(' ')}
                                            >
                                                <span>{option.label}</span>
                                                {selectedPreset === option.key && selectedWeeks.size === 0 && (
                                                    <Check className="h-4 w-4" />
                                                )}
                                            </button>
                                        ))}

                                        <hr className="my-2 border-slate-700" />
                                        <button
                                            onClick={openCustomDatePicker}
                                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 transition-colors hover:bg-slate-700"
                                        >
                                            Tùy chỉnh...
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {showCustomDatePicker && (
                        <div className="animate-slide-down absolute left-0 top-full z-[220] mt-2 w-[520px] rounded-xl border border-slate-700 bg-slate-800/95 p-4 shadow-2xl backdrop-blur-xl">
                            <div className="mb-4 flex items-center justify-between">
                                <p className="text-sm font-medium text-white">Chọn khoảng thời gian</p>
                                <select
                                    value={selectedPreset === 'custom' || selectedPreset === 'half' ? '' : selectedPreset}
                                    onChange={event => {
                                        if (event.target.value) {
                                            handlePresetChange(event.target.value as DashboardScopePreset)
                                        }
                                    }}
                                    className="rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                >
                                    <option value="">Tùy chỉnh</option>
                                    {[...DASHBOARD_QUICK_PRESETS, ...DASHBOARD_YEAR_PRESETS, ...DASHBOARD_MONTH_PRESETS].map(option => (
                                        <option key={option.key} value={option.key}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="mb-2 text-xs text-slate-400">Ngày bắt đầu</p>
                                    <MiniCalendar
                                        selectedDate={customStartDate}
                                        onSelectDate={setCustomStartDate}
                                        viewMonth={startViewMonth}
                                        onChangeMonth={setStartViewMonth}
                                    />
                                </div>
                                <div>
                                    <p className="mb-2 text-xs text-slate-400">Ngày kết thúc</p>
                                    <MiniCalendar
                                        selectedDate={customEndDate}
                                        onSelectDate={setCustomEndDate}
                                        viewMonth={endViewMonth}
                                        onChangeMonth={setEndViewMonth}
                                    />
                                </div>
                            </div>

                            <div className="mt-4 flex justify-end gap-2 border-t border-slate-700 pt-4">
                                <button
                                    onClick={() => setShowCustomDatePicker(false)}
                                    className="px-4 py-2 text-sm text-slate-400 transition-colors hover:text-white"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleApplyCustomRange}
                                    disabled={!customStartDate || !customEndDate}
                                    className="rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Áp dụng
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="relative" ref={assigneeRef}>
                    <button
                        onClick={() => setShowAssigneeDropdown(current => !current)}
                        className="flex items-center gap-2 rounded-xl bg-slate-700/50 px-4 py-2 transition-colors hover:bg-slate-600/50"
                    >
                        <Users className="h-4 w-4 text-purple-400" />
                        <span className="text-sm text-white">
                            {selectedAssignees.length === 0
                                ? (userCtx?.role === 'member'
                                    ? (userCtx.asanaName || userCtx.fullName || 'All Members')
                                    : 'All Members')
                                : `${selectedAssignees.length} selected`}
                        </span>
                    </button>

                    {showAssigneeDropdown && (
                        <div className="animate-slide-down absolute left-0 top-full z-[200] mt-2 max-h-80 w-64 overflow-hidden rounded-xl border border-slate-700 bg-slate-800/95 shadow-2xl backdrop-blur-xl">
                            <div className="border-b border-slate-700 p-2">
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={assigneeSearch}
                                    onChange={event => setAssigneeSearch(event.target.value)}
                                    className="w-full rounded-lg bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>
                            <div className="max-h-60 overflow-y-auto p-2">
                                <button
                                    onClick={() => {
                                        onAssigneesChange([])
                                        setShowAssigneeDropdown(false)
                                    }}
                                    className={[
                                        'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                                        selectedAssignees.length === 0
                                            ? 'bg-purple-500/20 text-purple-300'
                                            : 'text-slate-300 hover:bg-slate-700',
                                    ].join(' ')}
                                >
                                    {userCtx?.role === 'member'
                                        ? (userCtx.asanaName || userCtx.fullName || 'All Members')
                                        : 'All Members'}
                                </button>
                                {filteredAssignees.map(assignee => (
                                    <button
                                        key={assignee}
                                        onClick={() => toggleAssignee(assignee)}
                                        className={[
                                            'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                                            selectedAssignees.includes(assignee)
                                                ? 'bg-purple-500/20 text-purple-300'
                                                : 'text-slate-300 hover:bg-slate-700',
                                        ].join(' ')}
                                    >
                                        {assignee}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center rounded-xl bg-slate-700/50 p-1">
                    {(['all', 'done', 'not_done'] as const).map(item => (
                        <button
                            key={item}
                            onClick={() => onStatusChange(item)}
                            className={[
                                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                                status === item ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white',
                            ].join(' ')}
                        >
                            {item === 'all' ? 'All' : item === 'done' ? 'Done' : 'Chưa Done'}
                        </button>
                    ))}
                </div>

                <div className="relative" ref={typeRef}>
                    <button
                        onClick={() => setShowTypeDropdown(current => !current)}
                        className="flex items-center gap-2 rounded-xl bg-slate-700/50 px-4 py-2 transition-colors hover:bg-slate-600/50"
                    >
                        <Filter className="h-4 w-4 text-purple-400" />
                        <span className="text-sm text-white">
                            {selectedVideoTypes.length === 0 ? 'All Types' : `${selectedVideoTypes.length} types`}
                        </span>
                    </button>

                    {showTypeDropdown && (
                        <div className="animate-slide-down absolute left-0 top-full z-[200] mt-2 max-h-96 w-64 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/95 p-2 shadow-2xl backdrop-blur-xl">
                            <button
                                onClick={() => {
                                    onVideoTypesChange([])
                                    setShowTypeDropdown(false)
                                }}
                                className={[
                                    'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                                    selectedVideoTypes.length === 0
                                        ? 'bg-purple-500/20 text-purple-300'
                                        : 'text-slate-300 hover:bg-slate-700',
                                ].join(' ')}
                            >
                                All Types
                            </button>
                            {videoTypes.map(type => (
                                <button
                                    key={type}
                                    onClick={() => toggleVideoType(type)}
                                    className={[
                                        'w-full break-words rounded-lg px-3 py-2 text-left text-sm transition-colors',
                                        selectedVideoTypes.includes(type)
                                            ? 'bg-purple-500/20 text-purple-300'
                                            : 'text-slate-300 hover:bg-slate-700',
                                    ].join(' ')}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="ml-auto flex items-center gap-3">
                    {lastSync && (
                        <span className="text-xs text-slate-500">
                            Last sync: {format(new Date(lastSync), 'HH:mm')}
                        </span>
                    )}
                    <button
                        onClick={onSync}
                        disabled={syncing}
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-purple-900/30 transition-all duration-200 hover:from-violet-500 hover:to-purple-500 hover:shadow-purple-700/40 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                </div>
            </div>

            {(selectedAssignees.length > 0 || selectedVideoTypes.length > 0 || status !== 'all') && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-700/50 pt-3">
                    <span className="mr-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                        Filters:
                    </span>
                    {status !== 'all' && (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-violet-500/20 bg-violet-500/20 px-2.5 py-1 text-xs text-violet-300">
                            {status === 'done' ? 'Done' : 'Chưa Done'}
                            <button onClick={() => onStatusChange('all')} className="ml-0.5 hover:text-white">
                                ×
                            </button>
                        </span>
                    )}
                    {selectedAssignees.map(assignee => (
                        <span
                            key={assignee}
                            className="inline-flex items-center gap-1 rounded-lg border border-purple-500/20 bg-purple-500/20 px-2.5 py-1 text-xs text-purple-300"
                        >
                            {assignee}
                            <button onClick={() => toggleAssignee(assignee)} className="ml-0.5 hover:text-white">
                                ×
                            </button>
                        </span>
                    ))}
                    {selectedVideoTypes.map(type => (
                        <span
                            key={type}
                            className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/20 bg-cyan-500/20 px-2.5 py-1 text-xs text-cyan-300"
                        >
                            {type}
                            <button onClick={() => toggleVideoType(type)} className="ml-0.5 hover:text-white">
                                ×
                            </button>
                        </span>
                    ))}
                    <button
                        onClick={() => {
                            onAssigneesChange([])
                            onVideoTypesChange([])
                            onStatusChange('all')
                        }}
                        className="ml-2 rounded-lg px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-700/50 hover:text-red-400"
                    >
                        × Clear all
                    </button>
                </div>
            )}
        </div>
    )
}
