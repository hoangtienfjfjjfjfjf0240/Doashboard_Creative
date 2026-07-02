import { addWeeks, format, getMonth, getWeek, startOfWeek } from 'date-fns'
import { TOTAL_WEEKS } from '@/lib/constants'

export interface BenchmarkProduct {
    id: string
    name: string
    category: string | null
    platform_focus: string | null
    icon_emoji: string | null
    description: string | null
    cpi_target: number | null
    cpm_target: number | null
    ctr_target: number | null
    cvr_target: number | null
    ipm_target: number | null
    cpi_target_note: string | null
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface BenchmarkEntry {
    id: string
    product_id: string
    week_label: string
    week_start_date: string
    checked_date: string | null
    platform: string | null
    idea_name: string
    market: string | null
    ctr: number | null
    cvr: number | null
    ipm: number | null
    cpi: number | null
    cpm: number | null
    spend: number | null
    status_note: string | null
    created_at: string
    updated_at: string
}

export interface BenchmarkProductFormValues {
    name: string
    category: string
    platform_focus: string
    icon_emoji: string
    description: string
    cpi_target: string
    cpm_target: string
    ctr_target: string
    cvr_target: string
    ipm_target: string
    cpi_target_note: string
}

export interface BenchmarkEntryFormValues {
    week_label: string
    week_start_date: string
    checked_date: string
    platform: string
    idea_name: string
    market: string
    ctr: string
    cvr: string
    ipm: string
    cpi: string
    cpm: string
    spend: string
    status_note: string
}

export interface BenchmarkCpiSummary {
    totalCreatives: number
    passedCreatives: number
    hitRate: number
}

export interface BenchmarkWeekOption {
    key: string
    label: string
    startDate: string
    month: number
    actualWeekNum: number
    displayLabel: string
}

export function defaultBenchmarkProductForm(): BenchmarkProductFormValues {
    return {
        name: '',
        category: '',
        platform_focus: '',
        icon_emoji: '',
        description: '',
        cpi_target: '',
        cpm_target: '',
        ctr_target: '',
        cvr_target: '',
        ipm_target: '',
        cpi_target_note: '',
    }
}

export function defaultBenchmarkEntryForm(): BenchmarkEntryFormValues {
    return {
        week_label: '',
        week_start_date: '',
        checked_date: '',
        platform: '',
        idea_name: '',
        market: '',
        ctr: '',
        cvr: '',
        ipm: '',
        cpi: '',
        cpm: '',
        spend: '',
        status_note: '',
    }
}

export function parseNullableNumber(value: string): number | null {
    const normalized = value.trim()
    if (!normalized) {
        return null
    }

    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
}

export function getWeekGroupKey(weekLabel: string, weekStartDate: string): string {
    return `${weekLabel}__${weekStartDate}`
}

export function compareWeekKeysDescending(
    left: { week_label: string; week_start_date: string },
    right: { week_label: string; week_start_date: string }
): number {
    if (left.week_start_date === right.week_start_date) {
        return right.week_label.localeCompare(left.week_label)
    }

    return right.week_start_date.localeCompare(left.week_start_date)
}

export function getCpiStatus(cpi: number | null, target: number | null): 'passed' | 'failed' | 'pending' {
    if (cpi === null || target === null) {
        return 'pending'
    }

    return cpi <= target ? 'passed' : 'failed'
}

export function calculateCpiSummary(entries: BenchmarkEntry[], cpiTarget: number | null): BenchmarkCpiSummary {
    const totalCreatives = entries.length
    const passedCreatives = entries.filter(entry => getCpiStatus(entry.cpi, cpiTarget) === 'passed').length

    return {
        totalCreatives,
        passedCreatives,
        hitRate: totalCreatives > 0 ? (passedCreatives / totalCreatives) * 100 : 0,
    }
}

export function getVideoBenchmarkWeeks(): BenchmarkWeekOption[] {
    const weeks: BenchmarkWeekOption[] = []
    const firstMonday = new Date(2026, 1, 2)
    const startActualWeek = getWeek(firstMonday, { weekStartsOn: 1 })

    for (let index = 0; index < TOTAL_WEEKS; index += 1) {
        const actualWeekNum = startActualWeek + index
        const weekStart = addWeeks(startOfWeek(new Date(2026, 0, 1), { weekStartsOn: 1 }), actualWeekNum - 1)
        const label = `W${index + 1}`
        const startDate = format(weekStart, 'yyyy-MM-dd')

        weeks.push({
            key: getWeekGroupKey(label, startDate),
            label,
            startDate,
            month: getMonth(weekStart),
            actualWeekNum,
            displayLabel: `${label} • ${format(weekStart, 'dd/MM/yyyy')}`,
        })
    }

    return weeks
}

export function getCurrentVideoWeekKey(weeks: BenchmarkWeekOption[], now: Date = new Date()): string | null {
    const currentActualWeekNum = getWeek(now, { weekStartsOn: 1 })
    const currentWeek = weeks.find(week => week.actualWeekNum === currentActualWeekNum)

    return currentWeek?.key || null
}

export function isBenchmarkSetupMissing(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false
    }

    const errorObject = error as { code?: string; message?: string }
    const message = errorObject.message?.toLowerCase() || ''

    return (
        errorObject.code === '42P01' ||
        message.includes('relation') ||
        message.includes('does not exist') ||
        message.includes('schema cache')
    )
}

export function formatMetric(
    value: number | null | undefined,
    type: 'currency' | 'percent' | 'number'
): string {
    if (value === null || value === undefined) {
        return '--'
    }

    if (type === 'currency') {
        return `$${value.toFixed(2)}`
    }

    if (type === 'percent') {
        return `${value.toFixed(2)}%`
    }

    return value.toFixed(2)
}

export function toProductFormValues(product: BenchmarkProduct): BenchmarkProductFormValues {
    return {
        name: product.name,
        category: product.category || '',
        platform_focus: product.platform_focus || '',
        icon_emoji: product.icon_emoji || '',
        description: product.description || '',
        cpi_target: product.cpi_target?.toString() || '',
        cpm_target: product.cpm_target?.toString() || '',
        ctr_target: product.ctr_target?.toString() || '',
        cvr_target: product.cvr_target?.toString() || '',
        ipm_target: product.ipm_target?.toString() || '',
        cpi_target_note: product.cpi_target_note || '',
    }
}

export function toEntryFormValues(entry: BenchmarkEntry): BenchmarkEntryFormValues {
    return {
        week_label: entry.week_label,
        week_start_date: entry.week_start_date,
        checked_date: entry.checked_date || '',
        platform: entry.platform || '',
        idea_name: entry.idea_name,
        market: entry.market || '',
        ctr: entry.ctr?.toString() || '',
        cvr: entry.cvr?.toString() || '',
        ipm: entry.ipm?.toString() || '',
        cpi: entry.cpi?.toString() || '',
        cpm: entry.cpm?.toString() || '',
        spend: entry.spend?.toString() || '',
        status_note: entry.status_note || '',
    }
}
