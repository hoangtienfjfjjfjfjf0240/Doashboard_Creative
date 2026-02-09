'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar, Users, Filter, RefreshCw, ChevronDown, Check } from 'lucide-react'
import { format, startOfWeek, addWeeks, subWeeks, subDays, startOfDay, endOfDay, startOfMonth, addDays, isSameDay, getDate, getMonth, addMonths } from 'date-fns'
import { vi } from 'date-fns/locale'
import { useUser } from '@/contexts/UserContext'

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
    // Controlled filter state
    selectedPreset: 'week' | '7days' | '14days' | '28days' | '30days' | 'custom'
    onPresetChange: (preset: 'week' | '7days' | '14days' | '28days' | '30days' | 'custom') => void
    selectedWeeks: Set<string>
    onWeeksChange: (weeks: Set<string>) => void
}

const VIDEO_TYPES = ['S1', 'S2A', 'S2B', 'S3A', 'S3B', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9A', 'S9B', 'S9C', 'S10A']

// Timeline data for 2026 with actual dates
interface WeekData {
    week: number
    range: string
    startDay: number
    endDay: number
}

interface MonthData {
    month: string
    monthIndex: number
    year: number
    weeks: WeekData[]
}

const TIMELINE_2026: MonthData[] = [
    // Start from February 2026 onwards (bỏ tháng 1)
    {
        month: 'Tháng 2 / 2026',
        monthIndex: 1,
        year: 2026,
        weeks: [
            { week: 1, range: '02 – 06', startDay: 2, endDay: 6 },
            { week: 2, range: '09 – 13', startDay: 9, endDay: 13 },
            { week: 3, range: '16 – 20', startDay: 16, endDay: 20 },
            { week: 4, range: '23 – 27', startDay: 23, endDay: 27 },
        ]
    },
    {
        month: 'Tháng 3 / 2026',
        monthIndex: 2,
        year: 2026,
        weeks: [
            { week: 1, range: '02 – 06', startDay: 2, endDay: 6 },
            { week: 2, range: '09 – 13', startDay: 9, endDay: 13 },
            { week: 3, range: '16 – 20', startDay: 16, endDay: 20 },
            { week: 4, range: '23 – 27', startDay: 23, endDay: 27 },
            { week: 5, range: '30 – 31', startDay: 30, endDay: 31 },
        ]
    },
    {
        month: 'Tháng 4 / 2026',
        monthIndex: 3,
        year: 2026,
        weeks: [
            { week: 1, range: '01 – 03', startDay: 1, endDay: 3 },
            { week: 2, range: '06 – 10', startDay: 6, endDay: 10 },
            { week: 3, range: '13 – 17', startDay: 13, endDay: 17 },
            { week: 4, range: '20 – 24', startDay: 20, endDay: 24 },
            { week: 5, range: '27 – 30', startDay: 27, endDay: 30 },
        ]
    },
    {
        month: 'Tháng 5 / 2026',
        monthIndex: 4,
        year: 2026,
        weeks: [
            { week: 1, range: '04 – 08', startDay: 4, endDay: 8 },
            { week: 2, range: '11 – 15', startDay: 11, endDay: 15 },
            { week: 3, range: '18 – 22', startDay: 18, endDay: 22 },
            { week: 4, range: '25 – 29', startDay: 25, endDay: 29 },
        ]
    },
    {
        month: 'Tháng 6 / 2026',
        monthIndex: 5,
        year: 2026,
        weeks: [
            { week: 1, range: '01 – 05', startDay: 1, endDay: 5 },
            { week: 2, range: '08 – 12', startDay: 8, endDay: 12 },
            { week: 3, range: '15 – 19', startDay: 15, endDay: 19 },
            { week: 4, range: '22 – 26', startDay: 22, endDay: 26 },
            { week: 5, range: '29 – 30', startDay: 29, endDay: 30 },
        ]
    },
]

type DatePreset = 'week' | '7days' | '14days' | '28days' | '30days' | 'custom'

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
    { key: '7days', label: '7 ngày qua' },
    { key: '14days', label: '14 ngày qua' },
    { key: '28days', label: '28 ngày qua' },
    { key: '30days', label: '30 ngày qua' },
]

function getDateRangeFromPreset(preset: DatePreset): { start: Date; end: Date } {
    const now = new Date()
    const today = startOfDay(now)

    switch (preset) {
        case '7days':
            return { start: subDays(today, 6), end: endOfDay(today) }
        case '14days':
            return { start: subDays(today, 13), end: endOfDay(today) }
        case '28days':
            return { start: subDays(today, 27), end: endOfDay(today) }
        case '30days':
            return { start: subDays(today, 29), end: endOfDay(today) }
        default:
            return { start: subDays(today, 6), end: endOfDay(today) }
    }
}

// Calendar component
function MiniCalendar({
    selectedDate,
    onSelectDate,
    viewMonth,
    onChangeMonth
}: {
    selectedDate: Date | null
    onSelectDate: (date: Date) => void
    viewMonth: Date
    onChangeMonth: (date: Date) => void
}) {
    const monthStart = startOfMonth(viewMonth)
    const firstDayOfWeek = startOfWeek(monthStart, { weekStartsOn: 1 })
    const days: Date[] = []

    for (let i = 0; i < 42; i++) {
        days.push(addDays(firstDayOfWeek, i))
    }

    const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

    return (
        <div className="w-full">
            <div className="flex items-center justify-between mb-3">
                <button
                    onClick={() => onChangeMonth(addMonths(viewMonth, -1))}
                    className="p-1 hover:bg-slate-600 rounded transition-colors"
                >
                    <ChevronLeft className="w-4 h-4 text-slate-400" />
                </button>
                <span className="text-sm font-medium text-white">
                    {format(viewMonth, 'MMMM yyyy', { locale: vi })}
                </span>
                <button
                    onClick={() => onChangeMonth(addMonths(viewMonth, 1))}
                    className="p-1 hover:bg-slate-600 rounded transition-colors"
                >
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
                {weekDays.map(day => (
                    <div key={day} className="text-center text-xs text-slate-500 py-1">
                        {day}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map((day, idx) => {
                    const isCurrentMonth = getMonth(day) === getMonth(viewMonth)
                    const isSelected = selectedDate && isSameDay(day, selectedDate)
                    const isToday = isSameDay(day, new Date())

                    return (
                        <button
                            key={idx}
                            onClick={() => onSelectDate(day)}
                            className={`
                                text-center text-xs py-1.5 rounded transition-colors
                                ${!isCurrentMonth ? 'text-slate-600' : 'text-slate-300 hover:bg-slate-600'}
                                ${isSelected ? 'bg-purple-500 text-white' : ''}
                                ${isToday && !isSelected ? 'border border-purple-500' : ''}
                            `}
                        >
                            {getDate(day)}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

// Week key for multi-select
function getWeekKey(monthData: MonthData, weekData: WeekData): string {
    return `${monthData.monthIndex}-${weekData.week}-${weekData.startDay}`
}

export default function FilterBar({
    weekStart,
    onWeekChange,
    assignees,
    selectedAssignees,
    onAssigneesChange,
    status,
    onStatusChange,
    selectedVideoTypes,
    onVideoTypesChange,
    onSync,
    syncing,
    lastSync,
    dateRange,
    onDateRangeChange,
    // Controlled filter props
    selectedPreset,
    onPresetChange,
    selectedWeeks,
    onWeeksChange,
}: FilterBarProps) {
    const { user: userCtx } = useUser()
    const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false)
    const [showTypeDropdown, setShowTypeDropdown] = useState(false)
    const [showDateDropdown, setShowDateDropdown] = useState(false)
    const [showCustomDatePicker, setShowCustomDatePicker] = useState(false)
    const [assigneeSearch, setAssigneeSearch] = useState('')
    // Removed local selectedPreset and selectedWeeks - now controlled by parent
    const [includeToday, setIncludeToday] = useState(true)

    // Custom date picker state
    const [customStartDate, setCustomStartDate] = useState<Date | null>(null)
    const [customEndDate, setCustomEndDate] = useState<Date | null>(null)
    const [startViewMonth, setStartViewMonth] = useState(new Date(2026, 0, 1))
    const [endViewMonth, setEndViewMonth] = useState(new Date(2026, 1, 1))
    const [appliedRange, setAppliedRange] = useState<{ start: Date; end: Date } | null>(null)

    const assigneeRef = useRef<HTMLDivElement>(null)
    const typeRef = useRef<HTMLDivElement>(null)
    const dateRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (assigneeRef.current && !assigneeRef.current.contains(event.target as Node)) {
                setShowAssigneeDropdown(false)
            }
            if (typeRef.current && !typeRef.current.contains(event.target as Node)) {
                setShowTypeDropdown(false)
            }
            if (dateRef.current && !dateRef.current.contains(event.target as Node)) {
                setShowDateDropdown(false)
                setShowCustomDatePicker(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const filteredAssignees = assignees.filter(a =>
        a.toLowerCase().includes(assigneeSearch.toLowerCase())
    )

    const toggleAssignee = (assignee: string) => {
        if (selectedAssignees.includes(assignee)) {
            onAssigneesChange(selectedAssignees.filter(a => a !== assignee))
        } else {
            onAssigneesChange([...selectedAssignees, assignee])
        }
    }

    const toggleVideoType = (type: string) => {
        if (selectedVideoTypes.includes(type)) {
            onVideoTypesChange(selectedVideoTypes.filter(t => t !== type))
        } else {
            onVideoTypesChange([...selectedVideoTypes, type])
        }
    }

    // Toggle week selection (multi-select)
    const toggleWeekSelect = (monthData: MonthData, weekData: WeekData) => {
        const key = getWeekKey(monthData, weekData)
        const newSelected = new Set(selectedWeeks)

        if (newSelected.has(key)) {
            newSelected.delete(key)
        } else {
            newSelected.add(key)
        }

        onWeeksChange(newSelected)
    }

    // Apply selected weeks
    const applySelectedWeeks = () => {
        console.log('applySelectedWeeks called, selectedWeeks:', selectedWeeks)
        if (selectedWeeks.size === 0) return

        let minStart: Date | null = null
        let maxEnd: Date | null = null

        selectedWeeks.forEach(key => {
            console.log('Processing key:', key)
            const [monthIdx, , startDay] = key.split('-').map(Number)
            const monthData = TIMELINE_2026.find(m => m.monthIndex === monthIdx)
            if (monthData) {
                const weekData = monthData.weeks.find(w => w.startDay === startDay)
                if (weekData) {
                    const start = new Date(monthData.year, monthData.monthIndex, weekData.startDay)
                    const end = new Date(monthData.year, monthData.monthIndex, weekData.endDay)
                    console.log('Week:', weekData.week, 'Start:', start, 'End:', end)

                    if (!minStart || start < minStart) minStart = start
                    if (!maxEnd || end > maxEnd) maxEnd = end
                }
            }
        })

        console.log('Final range:', minStart, maxEnd)
        if (minStart && maxEnd) {
            const newRange = { start: minStart, end: endOfDay(maxEnd) }
            console.log('Setting appliedRange:', newRange)
            onPresetChange('week')
            setAppliedRange(newRange)
            if (onDateRangeChange) {
                onDateRangeChange(newRange)
            }
            onWeekChange(minStart)
        }

        setShowDateDropdown(false)
    }

    const handlePresetChange = (preset: DatePreset) => {
        console.log('handlePresetChange called with:', preset)
        if (preset === 'custom') {
            setShowCustomDatePicker(true)
            setShowDateDropdown(false)
            return
        }

        console.log('Setting selectedPreset to:', preset)
        onPresetChange(preset)
        onWeeksChange(new Set())
        setAppliedRange(null)
        const range = getDateRangeFromPreset(preset)
        console.log('Range from preset:', range)

        if (onDateRangeChange) {
            onDateRangeChange(range)
        }

        onWeekChange(range.start)
        setShowDateDropdown(false)
    }

    const handleApplyCustomRange = () => {
        if (customStartDate && customEndDate) {
            onPresetChange('custom')
            onWeeksChange(new Set())
            if (onDateRangeChange) {
                onDateRangeChange({ start: customStartDate, end: endOfDay(customEndDate) })
            }
            onWeekChange(customStartDate)
            setShowCustomDatePicker(false)
        }
    }

    const getDateRangeLabel = () => {
        console.log('getDateRangeLabel - selectedPreset:', selectedPreset, 'dateRange:', dateRange)
        // Use dateRange when weeks are selected (controlled by parent)
        if (selectedPreset === 'week' && dateRange) {
            return `${format(dateRange.start, 'dd/MM')} - ${format(dateRange.end, 'dd/MM/yyyy')}`
        }
        if (selectedPreset === 'custom' && dateRange) {
            return `${format(dateRange.start, 'dd/MM')} - ${format(dateRange.end, 'dd/MM/yyyy')}`
        }
        const preset = DATE_PRESETS.find(p => p.key === selectedPreset)
        console.log('Found preset:', preset)
        return preset?.label || '7 ngày qua'
    }

    return (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 mb-6 relative z-[100] sticky top-4">
            <div className="flex flex-wrap items-center gap-4">
                {/* Date Range Picker with Timeline */}
                <div className="relative" ref={dateRef}>
                    <div className="flex items-center gap-2 bg-slate-700/50 rounded-xl p-1">
                        <button
                            onClick={() => onWeekChange(subWeeks(weekStart, 1))}
                            className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5 text-slate-300" />
                        </button>
                        <button
                            onClick={() => setShowDateDropdown(!showDateDropdown)}
                            className="flex items-center gap-2 px-3 py-1 hover:bg-slate-600/50 rounded-lg transition-colors"
                        >
                            <Calendar className="w-4 h-4 text-purple-400" />
                            <span className="text-sm font-medium text-white whitespace-nowrap">
                                {getDateRangeLabel()}
                            </span>
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                        </button>
                        <button
                            onClick={() => onWeekChange(addWeeks(weekStart, 1))}
                            className="p-2 hover:bg-slate-600 rounded-lg transition-colors"
                        >
                            <ChevronRight className="w-5 h-5 text-slate-300" />
                        </button>
                    </div>

                    {/* Date preset dropdown */}
                    {showDateDropdown && (
                        <div className="absolute top-full mt-2 left-0 w-[520px] bg-slate-800/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl z-[200] overflow-hidden animate-slide-down">
                            <div className="flex">
                                {/* Left: Timeline with multi-select */}
                                <div className="w-52 border-r border-slate-700 max-h-96 overflow-y-auto">
                                    <div className="p-2 border-b border-slate-700 sticky top-0 bg-slate-800/95 flex items-center justify-between">
                                        <p className="text-xs text-slate-400 font-medium px-2">Timeline (chọn nhiều)</p>
                                        {selectedWeeks.size > 0 && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    e.preventDefault()
                                                    applySelectedWeeks()
                                                }}
                                                className="px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white text-xs rounded transition-colors"
                                            >
                                                Áp dụng
                                            </button>
                                        )}
                                    </div>
                                    <div className="p-2">
                                        {TIMELINE_2026.map(monthData => (
                                            <div key={monthData.month} className="mb-3">
                                                <p className="text-xs font-semibold text-purple-400 px-2 py-1">{monthData.month}</p>
                                                {monthData.weeks.map(weekData => {
                                                    const key = getWeekKey(monthData, weekData)
                                                    const isSelected = selectedWeeks.has(key)

                                                    return (
                                                        <button
                                                            key={key}
                                                            onClick={() => toggleWeekSelect(monthData, weekData)}
                                                            className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors flex items-center justify-between ${isSelected
                                                                ? 'bg-purple-500/20 text-purple-300'
                                                                : 'text-slate-300 hover:bg-slate-700'
                                                                }`}
                                                        >
                                                            <span>Tuần {weekData.week}: {weekData.range}</span>
                                                            {isSelected && <Check className="w-3 h-3" />}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Right: Presets */}
                                <div className="flex-1">
                                    <div className="p-2 border-b border-slate-700">
                                        <p className="text-xs text-slate-400 font-medium px-2">Chọn nhanh</p>
                                    </div>
                                    <div className="p-2">
                                        {DATE_PRESETS.map(preset => (
                                            <button
                                                key={preset.key}
                                                onClick={() => handlePresetChange(preset.key)}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${selectedPreset === preset.key && selectedWeeks.size === 0
                                                    ? 'bg-purple-500/20 text-purple-300'
                                                    : 'text-slate-300 hover:bg-slate-700'
                                                    }`}
                                            >
                                                <span>{preset.label}</span>
                                                {selectedPreset === preset.key && selectedWeeks.size === 0 && (
                                                    <Check className="w-4 h-4" />
                                                )}
                                            </button>
                                        ))}
                                        <hr className="my-2 border-slate-700" />
                                        <button
                                            onClick={() => handlePresetChange('custom')}
                                            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                                        >
                                            Tùy chỉnh...
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Custom date picker modal */}
                    {showCustomDatePicker && (
                        <div className="absolute top-full mt-2 left-0 w-[480px] bg-slate-800/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl z-[200] p-4 animate-slide-down">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-2 text-sm text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={includeToday}
                                            onChange={e => setIncludeToday(e.target.checked)}
                                            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500"
                                        />
                                        Tính cả hôm nay
                                    </label>
                                </div>
                                <select
                                    value={selectedPreset === 'custom' ? '' : selectedPreset}
                                    onChange={e => {
                                        if (e.target.value) {
                                            handlePresetChange(e.target.value as DatePreset)
                                        }
                                    }}
                                    className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                >
                                    <option value="">Tùy chỉnh</option>
                                    {DATE_PRESETS.map(p => (
                                        <option key={p.key} value={p.key}>{p.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-slate-400 mb-2">Ngày bắt đầu</p>
                                    <MiniCalendar
                                        selectedDate={customStartDate}
                                        onSelectDate={setCustomStartDate}
                                        viewMonth={startViewMonth}
                                        onChangeMonth={setStartViewMonth}
                                    />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-400 mb-2">Ngày kết thúc</p>
                                    <MiniCalendar
                                        selectedDate={customEndDate}
                                        onSelectDate={setCustomEndDate}
                                        viewMonth={endViewMonth}
                                        onChangeMonth={setEndViewMonth}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-700">
                                <button
                                    onClick={() => setShowCustomDatePicker(false)}
                                    className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleApplyCustomRange}
                                    disabled={!customStartDate || !customEndDate}
                                    className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Áp dụng
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Assignee Filter */}
                <div className="relative" ref={assigneeRef}>
                    <button
                        onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-xl transition-colors"
                    >
                        <Users className="w-4 h-4 text-purple-400" />
                        <span className="text-sm text-white">
                            {selectedAssignees.length === 0
                                ? (userCtx?.role === 'member' ? (userCtx.asanaName || userCtx.fullName || 'All Members') : 'All Members')
                                : `${selectedAssignees.length} selected`}
                        </span>
                    </button>

                    {showAssigneeDropdown && (
                        <div className="absolute top-full mt-2 left-0 w-64 bg-slate-800/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl z-[200] max-h-80 overflow-hidden animate-slide-down">
                            <div className="p-2 border-b border-slate-700">
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={assigneeSearch}
                                    onChange={e => setAssigneeSearch(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-700 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>
                            <div className="max-h-60 overflow-y-auto p-2">
                                <button
                                    onClick={() => {
                                        onAssigneesChange([])
                                        setShowAssigneeDropdown(false)
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedAssignees.length === 0 ? 'bg-purple-500/20 text-purple-300' : 'text-slate-300 hover:bg-slate-700'}`}
                                >
                                    {userCtx?.role === 'member' ? (userCtx.asanaName || userCtx.fullName || 'All Members') : 'All Members'}
                                </button>
                                {filteredAssignees.map(assignee => (
                                    <button
                                        key={assignee}
                                        onClick={() => toggleAssignee(assignee)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedAssignees.includes(assignee) ? 'bg-purple-500/20 text-purple-300' : 'text-slate-300 hover:bg-slate-700'}`}
                                    >
                                        {assignee}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Status Filter */}
                <div className="flex items-center bg-slate-700/50 rounded-xl p-1">
                    {(['all', 'done', 'not_done'] as const).map(s => (
                        <button
                            key={s}
                            onClick={() => onStatusChange(s)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${status === s
                                ? 'bg-purple-500 text-white'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            {s === 'all' ? 'All' : s === 'done' ? 'Done' : 'Not Done'}
                        </button>
                    ))}
                </div>

                {/* Video Type Filter */}
                <div className="relative" ref={typeRef}>
                    <button
                        onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-xl transition-colors"
                    >
                        <Filter className="w-4 h-4 text-purple-400" />
                        <span className="text-sm text-white">
                            {selectedVideoTypes.length === 0 ? 'All Types' : `${selectedVideoTypes.length} types`}
                        </span>
                    </button>

                    {showTypeDropdown && (
                        <div className="absolute top-full mt-2 left-0 w-48 bg-slate-800/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl z-[200] p-2 animate-slide-down">
                            <button
                                onClick={() => {
                                    onVideoTypesChange([])
                                    setShowTypeDropdown(false)
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedVideoTypes.length === 0 ? 'bg-purple-500/20 text-purple-300' : 'text-slate-300 hover:bg-slate-700'}`}
                            >
                                All Types
                            </button>
                            {VIDEO_TYPES.map(type => (
                                <button
                                    key={type}
                                    onClick={() => toggleVideoType(type)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedVideoTypes.includes(type) ? 'bg-purple-500/20 text-purple-300' : 'text-slate-300 hover:bg-slate-700'}`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Sync Button */}
                <div className="ml-auto flex items-center gap-3">
                    {lastSync && (
                        <span className="text-xs text-slate-500">
                            Last sync: {format(new Date(lastSync), 'HH:mm')}
                        </span>
                    )}
                    <button
                        onClick={onSync}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 rounded-xl text-sm font-medium text-white transition-all duration-200 disabled:opacity-50 shadow-lg shadow-purple-900/30 hover:shadow-purple-700/40"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                </div>
            </div>

            {/* Active Filters */}
            {(selectedAssignees.length > 0 || selectedVideoTypes.length > 0 || status !== 'all') && (
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-700/50">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mr-1">Filters:</span>
                    {status !== 'all' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-500/20 rounded-lg text-xs text-violet-300 border border-violet-500/20">
                            {status === 'done' ? '✅ Done' : '⏳ Not Done'}
                            <button onClick={() => onStatusChange('all')} className="hover:text-white ml-0.5">×</button>
                        </span>
                    )}
                    {selectedAssignees.map(a => (
                        <span
                            key={a}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-500/20 rounded-lg text-xs text-purple-300 border border-purple-500/20"
                        >
                            {a}
                            <button onClick={() => toggleAssignee(a)} className="hover:text-white ml-0.5">×</button>
                        </span>
                    ))}
                    {selectedVideoTypes.map(t => (
                        <span
                            key={t}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-cyan-500/20 rounded-lg text-xs text-cyan-300 border border-cyan-500/20"
                        >
                            {t}
                            <button onClick={() => toggleVideoType(t)} className="hover:text-white ml-0.5">×</button>
                        </span>
                    ))}
                    <button
                        onClick={() => {
                            onAssigneesChange([])
                            onVideoTypesChange([])
                            onStatusChange('all')
                        }}
                        className="text-xs text-slate-500 hover:text-red-400 transition-colors ml-2 px-2 py-1 hover:bg-slate-700/50 rounded-lg"
                    >
                        ✕ Clear all
                    </button>
                </div>
            )}
        </div>
    )
}
