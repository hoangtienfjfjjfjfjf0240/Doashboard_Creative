import { addDays, addWeeks, format, getWeek, startOfWeek } from 'date-fns'

export const TARGET_YEARS = [2026, 2027] as const
export const TARGET_MONTH_LABELS = [
    'Tháng 1',
    'Tháng 2',
    'Tháng 3',
    'Tháng 4',
    'Tháng 5',
    'Tháng 6',
    'Tháng 7',
    'Tháng 8',
    'Tháng 9',
    'Tháng 10',
    'Tháng 11',
    'Tháng 12',
] as const

export type TargetHalf = 'H1' | 'H2'
export type TargetHalfKey = `${(typeof TARGET_YEARS)[number]}-${TargetHalf}`

export interface TargetPeriodOption {
    key: TargetHalfKey
    year: number
    half: TargetHalf
    label: string
    months: number[]
}

export interface TargetTimelineWeek {
    weekKey: string
    start: Date
    year: number
    month: number
    monthWeek: number
    actualWeekNum: number
    halfKey: TargetHalfKey
    label: string
}

function getFirstFridayOfMonth(year: number, month: number) {
    const date = new Date(year, month, 1)

    while (date.getDay() !== 5) {
        date.setDate(date.getDate() + 1)
    }

    return date
}

export function getTimelineWeekKey(date: Date) {
    return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

const TARGET_PERIODS: TargetPeriodOption[] = TARGET_YEARS.flatMap(year => ([
    {
        key: `${year}-H1` as TargetHalfKey,
        year,
        half: 'H1' as const,
        label: `H1 ${year}`,
        months: [0, 1, 2, 3, 4, 5],
    },
    {
        key: `${year}-H2` as TargetHalfKey,
        year,
        half: 'H2' as const,
        label: `H2 ${year}`,
        months: [6, 7, 8, 9, 10, 11],
    },
]))

const TARGET_TIMELINE_WEEKS: TargetTimelineWeek[] = (() => {
    const weeks: TargetTimelineWeek[] = []

    TARGET_YEARS.forEach(year => {
        for (let month = 0; month < 12; month += 1) {
            let monthWeek = 1
            let friday = getFirstFridayOfMonth(year, month)

            while (friday.getFullYear() === year && friday.getMonth() === month) {
                const start = addDays(friday, -4)
                const half = month < 6 ? 'H1' : 'H2'

                weeks.push({
                    weekKey: format(start, 'yyyy-MM-dd'),
                    start,
                    year,
                    month,
                    monthWeek,
                    actualWeekNum: getWeek(start, { weekStartsOn: 1 }),
                    halfKey: `${year}-${half}` as TargetHalfKey,
                    label: `W${monthWeek}/Tháng ${month + 1}`,
                })

                friday = addWeeks(friday, 1)
                monthWeek += 1
            }
        }
    })

    return weeks
})()

export function buildTargetPeriods() {
    return TARGET_PERIODS
}

export function getDefaultTargetHalfKey(now: Date = new Date()): TargetHalfKey {
    const year = now.getFullYear()
    const month = now.getMonth()

    if (year <= TARGET_YEARS[0]) {
        return `${TARGET_YEARS[0]}-${month < 6 ? 'H1' : 'H2'}` as TargetHalfKey
    }

    if (year >= TARGET_YEARS[TARGET_YEARS.length - 1]) {
        return `${TARGET_YEARS[TARGET_YEARS.length - 1]}-${month < 6 ? 'H1' : 'H2'}` as TargetHalfKey
    }

    return `${year}-${month < 6 ? 'H1' : 'H2'}` as TargetHalfKey
}

export function buildTargetTimelineWeeks() {
    return TARGET_TIMELINE_WEEKS
}
