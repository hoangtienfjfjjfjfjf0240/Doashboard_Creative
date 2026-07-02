import { addDays, endOfDay, format, startOfWeek, subDays } from 'date-fns'
import {
    buildTargetPeriods,
    buildTargetTimelineWeeks,
    getDefaultTargetHalfKey,
    getTimelineWeekKey,
    TARGET_MONTH_LABELS,
    TARGET_YEARS,
    type TargetHalfKey,
} from '@/lib/targetTimeline'

export type DashboardQuickPreset = 'week' | '7days' | '14days' | '28days' | '30days'
export type DashboardYearPreset = `all-${(typeof TARGET_YEARS)[number]}`
export type DashboardMonthPreset = `month-${(typeof TARGET_YEARS)[number]}-${number}`
export type DashboardScopePreset = DashboardQuickPreset | DashboardYearPreset | DashboardMonthPreset | 'half'

export interface DashboardPresetOption<TPreset extends string = string> {
    key: TPreset
    label: string
}

export interface DashboardTimelineWeek {
    week: number
    weekKey: string
    range: string
    startDate: Date
    endDate: Date
}

export interface DashboardTimelineMonth {
    month: string
    monthIndex: number
    year: number
    weeks: DashboardTimelineWeek[]
}

export const DASHBOARD_QUICK_PRESETS: DashboardPresetOption<DashboardQuickPreset>[] = [
    { key: 'week', label: 'Tuần này' },
    { key: '7days', label: '7 ngày qua' },
    { key: '14days', label: '14 ngày qua' },
    { key: '28days', label: '28 ngày qua' },
    { key: '30days', label: '30 ngày qua' },
]

export const DASHBOARD_YEAR_PRESETS: DashboardPresetOption<DashboardYearPreset>[] = TARGET_YEARS.map(year => ({
    key: `all-${year}` as DashboardYearPreset,
    label: `Toàn bộ ${year}`,
}))

export const DASHBOARD_HALF_PRESETS: DashboardPresetOption<TargetHalfKey>[] = buildTargetPeriods().map(period => ({
    key: period.key,
    label: period.label,
}))

export const DASHBOARD_MONTH_PRESETS: DashboardPresetOption<DashboardMonthPreset>[] = TARGET_YEARS.flatMap(year =>
    TARGET_MONTH_LABELS.map((label, monthIndex) => ({
        key: `month-${year}-${monthIndex + 1}` as DashboardMonthPreset,
        label: `${label} / ${year}`,
    }))
)

function formatWeekRange(startDate: Date, endDate: Date) {
    const crossMonth = startDate.getMonth() !== endDate.getMonth()
    const startDay = String(startDate.getDate()).padStart(2, '0')
    const startMonth = String(startDate.getMonth() + 1).padStart(2, '0')
    const endDay = String(endDate.getDate()).padStart(2, '0')
    const endMonth = String(endDate.getMonth() + 1).padStart(2, '0')

    return crossMonth
        ? `${startDay}/${startMonth} - ${endDay}/${endMonth}`
        : `${startDay} - ${endDay}`
}

export const DASHBOARD_TIMELINE: DashboardTimelineMonth[] = (() => {
    const grouped = new Map<string, DashboardTimelineMonth>()

    buildTargetTimelineWeeks().forEach(week => {
        const key = `${week.year}-${week.month}`
        const existing = grouped.get(key)
        const dashboardWeek: DashboardTimelineWeek = {
            week: week.monthWeek,
            weekKey: week.weekKey,
            range: formatWeekRange(week.start, addDays(week.start, 4)),
            startDate: week.start,
            endDate: addDays(week.start, 4),
        }

        if (!existing) {
            grouped.set(key, {
                month: `${TARGET_MONTH_LABELS[week.month]} / ${week.year}`,
                monthIndex: week.month,
                year: week.year,
                weeks: [dashboardWeek],
            })
            return
        }

        existing.weeks.push(dashboardWeek)
    })

    return Array.from(grouped.values())
})()

export const DASHBOARD_TIMELINE_WEEK_KEYS = DASHBOARD_TIMELINE.flatMap(monthData =>
    monthData.weeks.map(weekData => weekData.weekKey)
)

export function getDashboardDefaultHalf(now: Date = new Date()): TargetHalfKey {
    return getDefaultTargetHalfKey(now)
}

export function getDashboardHalfLabel(halfKey: TargetHalfKey) {
    return buildTargetPeriods().find(period => period.key === halfKey)?.label || halfKey
}

export function getDashboardHalfForDate(date: Date): TargetHalfKey {
    const timelineWeek = buildTargetTimelineWeeks().find(week => week.weekKey === getTimelineWeekKey(date))
    if (timelineWeek) {
        return timelineWeek.halfKey
    }

    const year = date.getFullYear()
    const clampedYear = Math.min(Math.max(year, TARGET_YEARS[0]), TARGET_YEARS[TARGET_YEARS.length - 1])
    const half = date.getMonth() < 6 ? 'H1' : 'H2'
    return `${clampedYear}-${half}` as TargetHalfKey
}

export function getDateRangeForHalf(halfKey: TargetHalfKey): { start: Date; end: Date } {
    const halfPeriod = buildTargetPeriods().find(period => period.key === halfKey)
    if (!halfPeriod) {
        return {
            start: new Date(TARGET_YEARS[0], 0, 1),
            end: endOfDay(new Date(TARGET_YEARS[0], 5, 30)),
        }
    }

    const start = new Date(halfPeriod.year, halfPeriod.months[0], 1)
    const end = new Date(halfPeriod.year, halfPeriod.months[halfPeriod.months.length - 1] + 1, 0)
    return { start, end: endOfDay(end) }
}

export function getDashboardFirstWeekStartForHalf(halfKey: TargetHalfKey): Date | null {
    const firstWeek = buildTargetTimelineWeeks().find(week => week.halfKey === halfKey)
    return firstWeek?.start || null
}

export function getDateRangeFromDashboardPreset(
    preset: DashboardScopePreset,
    halfKey: TargetHalfKey = getDefaultTargetHalfKey()
): { start: Date; end: Date } {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    if (preset === 'half') {
        return getDateRangeForHalf(halfKey)
    }

    if (preset.startsWith('month-')) {
        const [, yearRaw, monthRaw] = preset.split('-')
        const year = Number(yearRaw)
        const month = Number(monthRaw)
        const start = new Date(year, month - 1, 1)
        const end = new Date(year, month, 0)
        return { start, end: endOfDay(end) }
    }

    if (preset.startsWith('all-')) {
        const year = Number(preset.slice(4))
        return {
            start: new Date(year, 0, 1),
            end: endOfDay(new Date(year, 11, 31)),
        }
    }

    switch (preset) {
        case 'week': {
            const weekMon = startOfWeek(today, { weekStartsOn: 1 })
            const weekFri = addDays(weekMon, 4)
            return { start: weekMon, end: endOfDay(weekFri) }
        }
        case '7days': {
            const thisWeekMon = startOfWeek(today, { weekStartsOn: 1 })
            const lastWeekMon = subDays(thisWeekMon, 7)
            const lastWeekFri = addDays(lastWeekMon, 4)
            return { start: lastWeekMon, end: endOfDay(lastWeekFri) }
        }
        case '14days':
            return { start: subDays(today, 13), end: endOfDay(today) }
        case '28days':
            return { start: subDays(today, 27), end: endOfDay(today) }
        case '30days':
        default:
            return { start: subDays(today, 29), end: endOfDay(today) }
    }
}

export function getDashboardDateLabel(
    preset: DashboardScopePreset | 'custom',
    dateRange?: { start: Date; end: Date },
    selectedWeekCount = 0,
    halfKey?: TargetHalfKey
) {
    if ((preset === 'custom' || selectedWeekCount > 0) && dateRange) {
        return `${format(dateRange.start, 'dd/MM')} - ${format(dateRange.end, 'dd/MM/yyyy')}`
    }

    if (preset === 'half' && halfKey) {
        return getDashboardHalfLabel(halfKey)
    }

    const presetOption = [
        ...DASHBOARD_QUICK_PRESETS,
        ...DASHBOARD_YEAR_PRESETS,
        ...DASHBOARD_MONTH_PRESETS,
    ].find(option => option.key === preset)

    return presetOption?.label || 'Tuần này'
}
