import { startOfWeek, endOfWeek, format, addWeeks, subWeeks, parseISO, isWithinInterval, startOfDay, addDays } from 'date-fns'

export interface WeekInfo {
    start: Date
    end: Date
    label: string
    weekNumber: number
    year: number
}

export function getWeekInfo(date: Date = new Date()): WeekInfo {
    const start = startOfWeek(date, { weekStartsOn: 1 }) // Monday
    const end = endOfWeek(date, { weekStartsOn: 1 }) // Sunday

    const weekNumber = getWeekNumber(date)
    const year = start.getFullYear()

    return {
        start,
        end,
        label: `Week ${weekNumber} (${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')})`,
        weekNumber,
        year,
    }
}

export function getWeekNumber(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 1)
    const diff = date.getTime() - start.getTime()
    const oneWeek = 604800000
    return Math.ceil((diff + start.getDay() * 86400000) / oneWeek)
}

export function getWeekStartDateString(date: Date = new Date()): string {
    const start = startOfWeek(date, { weekStartsOn: 1 })
    return format(start, 'yyyy-MM-dd')
}

export function getPreviousWeek(date: Date): Date {
    return subWeeks(date, 1)
}

export function getNextWeek(date: Date): Date {
    return addWeeks(date, 1)
}

export function isDateInWeek(date: Date | string, weekStart: Date): boolean {
    const checkDate = typeof date === 'string' ? parseISO(date) : date
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })

    return isWithinInterval(checkDate, { start: weekStart, end: weekEnd })
}

export function getDaysInWeek(weekStart: Date): Date[] {
    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
        days.push(addDays(weekStart, i))
    }
    return days
}

export function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? parseISO(date) : date
    return format(d, 'MMM d, yyyy')
}

export function formatDateShort(date: Date | string): string {
    const d = typeof date === 'string' ? parseISO(date) : date
    return format(d, 'MMM d')
}

export function getDayName(date: Date): string {
    return format(date, 'EEE')
}
