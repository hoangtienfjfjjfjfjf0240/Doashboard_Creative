'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { addDays, format, getWeek } from 'date-fns'
import { CalendarDays, ChevronLeft, Pencil, Target, Trash2, TrendingUp, X } from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import { createClient } from '@/lib/supabase/client'
import {
    BenchmarkEntry,
    BenchmarkEntryFormValues,
    BenchmarkProduct,
    BenchmarkProductFormValues,
    BenchmarkWeekOption,
    calculateCpiSummary,
    compareWeekKeysDescending,
    defaultBenchmarkEntryForm,
    defaultBenchmarkProductForm,
    formatMetric,
    getCurrentVideoWeekKey,
    getVideoBenchmarkWeeks,
    getWeekGroupKey,
    isBenchmarkSetupMissing,
    parseNullableNumber,
    toEntryFormValues,
    toProductFormValues,
} from '@/lib/benchmarks'

function getProductAvatarLabel(product: Pick<BenchmarkProduct, 'name' | 'icon_emoji'>): string {
    const customIcon = product.icon_emoji?.trim()
    if (customIcon) {
        return customIcon
    }

    return product.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join('') || 'BM'
}

function ProductAvatar({ product }: { product: Pick<BenchmarkProduct, 'name' | 'icon_emoji'> }) {
    return (
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 text-lg font-semibold text-white ring-1 ring-white/10">
            {getProductAvatarLabel(product)}
        </div>
    )
}

function averageOf(
    entries: BenchmarkEntry[],
    field: 'ctr' | 'cvr' | 'ipm' | 'cpi' | 'cpm' | 'spend'
): number | null {
    const values = entries.map(entry => entry[field]).filter((value): value is number => value !== null)
    if (values.length === 0) {
        return null
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length
}

function buildFallbackWeekOption(entry: BenchmarkEntry): BenchmarkWeekOption {
    const date = new Date(`${entry.week_start_date}T00:00:00`)

    return {
        key: getWeekGroupKey(entry.week_label, entry.week_start_date),
        label: entry.week_label,
        startDate: entry.week_start_date,
        month: date.getMonth(),
        actualWeekNum: getWeek(date, { weekStartsOn: 1 }),
        displayLabel: `${entry.week_label} • ${format(date, 'dd/MM/yyyy')}`,
    }
}

function sortEntries(entries: BenchmarkEntry[]): BenchmarkEntry[] {
    return [...entries].sort((left, right) => {
        const byWeek = compareWeekKeysDescending(left, right)
        if (byWeek !== 0) {
            return byWeek
        }

        const byCheckedDate = (right.checked_date || '').localeCompare(left.checked_date || '')
        if (byCheckedDate !== 0) {
            return byCheckedDate
        }

        return left.idea_name.localeCompare(right.idea_name)
    })
}

const BENCHMARK_MONTH_LABELS = [
    'Tháng 1 / 2026',
    'Tháng 2 / 2026',
    'Tháng 3 / 2026',
    'Tháng 4 / 2026',
    'Tháng 5 / 2026',
    'Tháng 6 / 2026',
    'Tháng 7 / 2026',
    'Tháng 8 / 2026',
    'Tháng 9 / 2026',
    'Tháng 10 / 2026',
    'Tháng 11 / 2026',
    'Tháng 12 / 2026',
]

function getTimelineWeekRange(startDate: string): string {
    const weekStart = new Date(`${startDate}T00:00:00`)
    const weekEnd = addDays(weekStart, 4)

    if (weekStart.getMonth() === weekEnd.getMonth()) {
        return `${format(weekStart, 'dd')} - ${format(weekEnd, 'dd')}`
    }

    return `${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM')}`
}

function ProductEditorModal({
    form,
    saving,
    onChange,
    onClose,
    onSubmit,
}: {
    form: BenchmarkProductFormValues
    saving: boolean
    onChange: (field: keyof BenchmarkProductFormValues, value: string) => void
    onClose: () => void
    onSubmit: () => void
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-800 px-6 py-5">
                    <div>
                        <div className="inline-flex rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-purple-300">
                            App benchmark
                        </div>
                        <h2 className="mt-3 text-2xl font-semibold text-white">Chỉnh sửa benchmark app</h2>
                        <p className="mt-2 text-sm text-slate-400">
                            Bạn có thể custom toàn bộ target và ghi chú benchmark của app này.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-2xl border border-slate-700 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="max-h-[75vh] overflow-y-auto px-6 py-6">
                    <div className="grid gap-4 lg:grid-cols-4">
                        <div className="lg:col-span-2">
                            <label className="mb-2 block text-sm font-medium text-slate-300">Tên app</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={event => onChange('name', event.target.value)}
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-300">Category</label>
                            <input
                                type="text"
                                value={form.category}
                                onChange={event => onChange('category', event.target.value)}
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-300">Icon / emoji</label>
                            <input
                                type="text"
                                value={form.icon_emoji}
                                onChange={event => onChange('icon_emoji', event.target.value)}
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-300">Platform focus</label>
                            <input
                                type="text"
                                value={form.platform_focus}
                                onChange={event => onChange('platform_focus', event.target.value)}
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-300">CPI target</label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.cpi_target}
                                onChange={event => onChange('cpi_target', event.target.value)}
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-300">CTR target (%)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.ctr_target}
                                onChange={event => onChange('ctr_target', event.target.value)}
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-300">CVR target (%)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.cvr_target}
                                onChange={event => onChange('cvr_target', event.target.value)}
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-300">CPM target</label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.cpm_target}
                                onChange={event => onChange('cpm_target', event.target.value)}
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-300">IPM target</label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.ipm_target}
                                onChange={event => onChange('ipm_target', event.target.value)}
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                            />
                        </div>
                        <div className="lg:col-span-4">
                            <label className="mb-2 block text-sm font-medium text-slate-300">Mô tả / ghi chú benchmark</label>
                            <textarea
                                rows={3}
                                value={form.description}
                                onChange={event => onChange('description', event.target.value)}
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                            />
                        </div>
                        <div className="lg:col-span-4">
                            <label className="mb-2 block text-sm font-medium text-slate-300">Ghi chú CPI hiển thị</label>
                            <input
                                type="text"
                                value={form.cpi_target_note}
                                onChange={event => onChange('cpi_target_note', event.target.value)}
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-800 px-6 py-5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-2xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={saving}
                        className="rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {saving ? 'Đang lưu...' : 'Lưu benchmark app'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function BenchmarkProductDetailPage() {
    const params = useParams<{ appId: string }>()
    const productId = Array.isArray(params.appId) ? params.appId[0] : params.appId
    const supabase = useMemo(() => createClient(), [])

    const [loading, setLoading] = useState(true)
    const [savingEntry, setSavingEntry] = useState(false)
    const [savingProduct, setSavingProduct] = useState(false)
    const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null)
    const [setupMissing, setSetupMissing] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [product, setProduct] = useState<BenchmarkProduct | null>(null)
    const [entries, setEntries] = useState<BenchmarkEntry[]>([])
    const [entryForm, setEntryForm] = useState<BenchmarkEntryFormValues>(defaultBenchmarkEntryForm())
    const [productForm, setProductForm] = useState<BenchmarkProductFormValues>(defaultBenchmarkProductForm())
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
    const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null)
    const [platformFilter, setPlatformFilter] = useState('all')
    const [showProductEditor, setShowProductEditor] = useState(false)

    useEffect(() => {
        let mounted = true

        const loadData = async () => {
            setLoading(true)
            setErrorMessage(null)

            const [{ data: productRow, error: productError }, { data: entryRows, error: entryError }] = await Promise.all([
                supabase.from('benchmark_products').select('*').eq('id', productId).single(),
                supabase
                    .from('benchmark_entries')
                    .select('id, product_id, week_label, week_start_date, checked_date, platform, idea_name, market, ctr, cvr, ipm, cpi, cpm, spend, status_note, created_at, updated_at')
                    .eq('product_id', productId)
                    .order('week_start_date', { ascending: false }),
            ])

            if (!mounted) {
                return
            }

            if (productError || entryError) {
                const sourceError = productError || entryError

                if (isBenchmarkSetupMissing(sourceError)) {
                    setSetupMissing(true)
                    setLoading(false)
                    return
                }

                setErrorMessage(sourceError?.message || 'Không thể tải benchmark app này.')
                setLoading(false)
                return
            }

            setSetupMissing(false)
            setProduct((productRow || null) as BenchmarkProduct | null)
            setEntries(sortEntries((entryRows || []) as BenchmarkEntry[]))
            setLoading(false)
        }

        void loadData()

        return () => {
            mounted = false
        }
    }, [productId, supabase])

    const plannedWeeks = useMemo(() => getVideoBenchmarkWeeks(), [])

    const weekOptions = useMemo(() => {
        const plannedKeys = new Set(plannedWeeks.map(week => week.key))
        const extraWeekMap = new Map<string, BenchmarkWeekOption>()

        entries.forEach(entry => {
            const key = getWeekGroupKey(entry.week_label, entry.week_start_date)
            if (!plannedKeys.has(key) && !extraWeekMap.has(key)) {
                extraWeekMap.set(key, buildFallbackWeekOption(entry))
            }
        })

        const extraWeeks = Array.from(extraWeekMap.values()).sort((left, right) =>
            compareWeekKeysDescending(
                { week_label: left.label, week_start_date: left.startDate },
                { week_label: right.label, week_start_date: right.startDate }
            )
        )

        return [...plannedWeeks, ...extraWeeks]
    }, [entries, plannedWeeks])

    const activeWeekKey = useMemo(() => {
        if (selectedWeekKey === '') {
            return ''
        }

        if (selectedWeekKey && weekOptions.some(option => option.key === selectedWeekKey)) {
            return selectedWeekKey
        }

        const currentVideoWeekKey = getCurrentVideoWeekKey(plannedWeeks)
        if (currentVideoWeekKey && weekOptions.some(option => option.key === currentVideoWeekKey)) {
            return currentVideoWeekKey
        }

        return weekOptions[0]?.key || ''
    }, [plannedWeeks, selectedWeekKey, weekOptions])

    const currentVideoWeekKey = useMemo(() => getCurrentVideoWeekKey(plannedWeeks), [plannedWeeks])

    const selectedWeekOption = weekOptions.find(option => option.key === activeWeekKey) || null

    const entryTargetWeekOption = useMemo(() => {
        if (selectedWeekOption) {
            return selectedWeekOption
        }

        if (currentVideoWeekKey) {
            const currentWeekOption = weekOptions.find(option => option.key === currentVideoWeekKey)
            if (currentWeekOption) {
                return currentWeekOption
            }
        }

        return weekOptions[0] || null
    }, [currentVideoWeekKey, selectedWeekOption, weekOptions])

    const formWeekKey = useMemo(() => {
        if (entryForm.week_start_date) {
            const weekLabel = entryForm.week_label.trim() || entryTargetWeekOption?.label || ''
            if (weekLabel) {
                return getWeekGroupKey(weekLabel, entryForm.week_start_date)
            }
        }

        return entryTargetWeekOption?.key || activeWeekKey
    }, [activeWeekKey, entryForm.week_label, entryForm.week_start_date, entryTargetWeekOption])

    const platformOptions = useMemo(() => {
        return Array.from(
            new Set(entries.map(entry => entry.platform?.trim()).filter((value): value is string => Boolean(value)))
        ).sort((left, right) => left.localeCompare(right))
    }, [entries])

    const timelineWeekGroups = useMemo(() => {
        const groupedWeeks = new Map<number, BenchmarkWeekOption[]>()

        weekOptions
            .slice()
            .sort((left, right) => left.startDate.localeCompare(right.startDate))
            .forEach(week => {
                if (!groupedWeeks.has(week.month)) {
                    groupedWeeks.set(week.month, [])
                }

                groupedWeeks.get(week.month)?.push(week)
            })

        return Array.from(groupedWeeks.entries())
            .sort(([leftMonth], [rightMonth]) => leftMonth - rightMonth)
            .map(([month, weeks]) => ({
                month,
                label: BENCHMARK_MONTH_LABELS[month] || `Tháng ${month + 1} / 2026`,
                weeks,
            }))
    }, [weekOptions])

    const filteredEntries = useMemo(() => {
        return entries.filter(entry => {
            const matchesWeek = !activeWeekKey || getWeekGroupKey(entry.week_label, entry.week_start_date) === activeWeekKey
            const matchesPlatform = platformFilter === 'all' || (entry.platform || '') === platformFilter
            return matchesWeek && matchesPlatform
        })
    }, [activeWeekKey, entries, platformFilter])

    const cpiSummary = useMemo(() => {
        return calculateCpiSummary(filteredEntries, product?.cpi_target ?? null)
    }, [filteredEntries, product?.cpi_target])

    const avgCtr = useMemo(() => averageOf(filteredEntries, 'ctr'), [filteredEntries])
    const avgCvr = useMemo(() => averageOf(filteredEntries, 'cvr'), [filteredEntries])
    const avgCpi = useMemo(() => averageOf(filteredEntries, 'cpi'), [filteredEntries])
    const avgCpm = useMemo(() => averageOf(filteredEntries, 'cpm'), [filteredEntries])

    const prepareNewEntry = () => {
        const week = entryTargetWeekOption

        setEntryForm({
            ...defaultBenchmarkEntryForm(),
            week_label: week?.label || '',
            week_start_date: week?.startDate || '',
        })
        setEditingEntryId(null)
        setErrorMessage(null)
    }

    const handleEntryFieldChange = (field: keyof BenchmarkEntryFormValues, value: string) => {
        setEntryForm(previous => ({
            ...previous,
            [field]: value,
        }))
    }

    const handleProductFieldChange = (field: keyof BenchmarkProductFormValues, value: string) => {
        setProductForm(previous => ({
            ...previous,
            [field]: value,
        }))
    }

    const openProductEditor = () => {
        if (!product) {
            return
        }

        setProductForm(toProductFormValues(product))
        setShowProductEditor(true)
        setErrorMessage(null)
    }

    const closeProductEditor = () => {
        setShowProductEditor(false)
    }

    const handleEditEntry = (entry: BenchmarkEntry) => {
        setEditingEntryId(entry.id)
        setEntryForm(toEntryFormValues(entry))
        setSelectedWeekKey(getWeekGroupKey(entry.week_label, entry.week_start_date))
        setErrorMessage(null)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const handleUpdateProduct = async () => {
        if (!product || !productForm.name.trim()) {
            setErrorMessage('Tên app là bắt buộc.')
            return
        }

        setSavingProduct(true)
        setErrorMessage(null)

        const payload = {
            name: productForm.name.trim(),
            category: productForm.category.trim() || null,
            platform_focus: productForm.platform_focus.trim() || null,
            icon_emoji: productForm.icon_emoji.trim() || null,
            description: productForm.description.trim() || null,
            cpi_target: parseNullableNumber(productForm.cpi_target),
            cpm_target: parseNullableNumber(productForm.cpm_target),
            ctr_target: parseNullableNumber(productForm.ctr_target),
            cvr_target: parseNullableNumber(productForm.cvr_target),
            ipm_target: parseNullableNumber(productForm.ipm_target),
            cpi_target_note: productForm.cpi_target_note.trim() || null,
        }

        const { data, error } = await supabase
            .from('benchmark_products')
            .update(payload)
            .eq('id', product.id)
            .select()
            .single()

        if (error) {
            setErrorMessage(error.message)
            setSavingProduct(false)
            return
        }

        setProduct(data as BenchmarkProduct)
        setSavingProduct(false)
        setShowProductEditor(false)
    }

    const handleSaveEntry = async () => {
        if (!product) {
            return
        }

        const fallbackWeek = weekOptions.find(option => option.key === formWeekKey) || entryTargetWeekOption || null
        const resolvedWeekLabel = editingEntryId
            ? entryForm.week_label.trim() || fallbackWeek?.label || ''
            : entryTargetWeekOption?.label || fallbackWeek?.label || ''
        const resolvedWeekStartDate = editingEntryId
            ? entryForm.week_start_date || fallbackWeek?.startDate || ''
            : entryTargetWeekOption?.startDate || fallbackWeek?.startDate || ''

        if (!resolvedWeekLabel || !resolvedWeekStartDate || !entryForm.idea_name.trim()) {
            setErrorMessage('Cần chọn tuần và nhập tên idea trước khi lưu.')
            return
        }

        setSavingEntry(true)
        setErrorMessage(null)

        const { data: authData } = await supabase.auth.getUser()
        const payload = {
            product_id: product.id,
            week_label: resolvedWeekLabel,
            week_start_date: resolvedWeekStartDate,
            checked_date: entryForm.checked_date || null,
            platform: entryForm.platform.trim() || null,
            idea_name: entryForm.idea_name.trim(),
            market: entryForm.market.trim() || null,
            ctr: parseNullableNumber(entryForm.ctr),
            cvr: parseNullableNumber(entryForm.cvr),
            ipm: parseNullableNumber(entryForm.ipm),
            cpi: parseNullableNumber(entryForm.cpi),
            cpm: parseNullableNumber(entryForm.cpm),
            spend: parseNullableNumber(entryForm.spend),
            status_note: entryForm.status_note.trim() || null,
        }

        const response = editingEntryId
            ? await supabase
                .from('benchmark_entries')
                .update(payload)
                .eq('id', editingEntryId)
                .select()
                .single()
            : await supabase
                .from('benchmark_entries')
                .insert({
                    ...payload,
                    created_by: authData.user?.id || null,
                })
                .select()
                .single()

        if (response.error) {
            setErrorMessage(response.error.message)
            setSavingEntry(false)
            return
        }

        const savedEntry = response.data as BenchmarkEntry
        setEntries(previous => {
            const nextEntries = editingEntryId
                ? previous.map(entry => (entry.id === savedEntry.id ? savedEntry : entry))
                : [savedEntry, ...previous]
            return sortEntries(nextEntries)
        })
        setSelectedWeekKey(getWeekGroupKey(savedEntry.week_label, savedEntry.week_start_date))
        setSavingEntry(false)
        prepareNewEntry()
    }

    const handleDeleteEntry = async (entryId: string) => {
        const confirmed = window.confirm('Bạn có chắc muốn xoá creative benchmark này không?')
        if (!confirmed) {
            return
        }

        setDeletingEntryId(entryId)
        const { error } = await supabase.from('benchmark_entries').delete().eq('id', entryId)

        if (error) {
            setErrorMessage(error.message)
            setDeletingEntryId(null)
            return
        }

        setEntries(previous => previous.filter(entry => entry.id !== entryId))
        if (editingEntryId === entryId) {
            prepareNewEntry()
        }
        setDeletingEntryId(null)
    }

    const inlineCellInputClass =
        'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-[13px] text-white outline-none transition placeholder:text-slate-500 focus:border-purple-500'

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex h-full items-center justify-center bg-slate-950">
                    <div className="text-center">
                        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-purple-500" />
                        <p className="mt-4 text-slate-400">Đang tải benchmark app...</p>
                    </div>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-slate-950 p-6">
                <div className="mx-auto max-w-7xl space-y-6">
                    <div className="flex flex-wrap items-center gap-3">
                        <Link
                            href="/benchmarks"
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Quay lại kho app
                        </Link>
                        <button
                            type="button"
                            onClick={openProductEditor}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
                        >
                            <Pencil className="h-4 w-4" />
                            Chỉnh sửa benchmark app
                        </button>
                    </div>

                    {showProductEditor && (
                        <ProductEditorModal
                            form={productForm}
                            saving={savingProduct}
                            onChange={handleProductFieldChange}
                            onClose={closeProductEditor}
                            onSubmit={handleUpdateProduct}
                        />
                    )}

                    {setupMissing && (
                        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 px-6 py-6 text-sm text-amber-100">
                            Bảng benchmark trong Supabase chưa sẵn sàng. Hãy chạy{' '}
                            <code className="rounded bg-slate-900/80 px-2 py-1 text-xs">supabase/benchmark_schema.sql</code> rồi
                            tải lại trang.
                        </div>
                    )}

                    {errorMessage && (
                        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
                            {errorMessage}
                        </div>
                    )}

                    {!product ? (
                        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 px-8 py-12">
                            <h1 className="text-2xl font-semibold text-white">Không tìm thấy app benchmark</h1>
                            <p className="mt-2 text-sm text-slate-400">
                                App này không tồn tại hoặc bạn chưa có quyền xem dữ liệu.
                            </p>
                        </div>
                    ) : (
                        <>
                            <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80">
                                <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.3fr_0.95fr] lg:px-8 lg:py-8">
                                    <div>
                                        <div className="flex items-start gap-4">
                                            <ProductAvatar product={product} />
                                            <div>
                                                <div className="inline-flex rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-purple-300">
                                                    {product.category || 'Benchmark'}
                                                </div>
                                                <h1 className="mt-3 text-3xl font-semibold text-white">{product.name}</h1>
                                                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                                                    {product.description ||
                                                        'Theo dõi benchmark theo tuần, nhập tay từng creative và tự động tính tỉ lệ win theo CPI target.'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-4">
                                                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Platform</div>
                                                <p className="mt-2 text-sm font-medium text-white">
                                                    {product.platform_focus || 'Chưa khai báo'}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-4">
                                                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">CPI target</div>
                                                <p className="mt-2 text-sm font-medium text-white">
                                                    {formatMetric(product.cpi_target, 'currency')}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-4">
                                                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">CTR target</div>
                                                <p className="mt-2 text-sm font-medium text-white">
                                                    {formatMetric(product.ctr_target, 'percent')}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-4">
                                                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">CVR target</div>
                                                <p className="mt-2 text-sm font-medium text-white">
                                                    {formatMetric(product.cvr_target, 'percent')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                                        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-4">
                                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">CPM target</div>
                                            <p className="mt-2 text-sm font-medium text-white">
                                                {formatMetric(product.cpm_target, 'currency')}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-4">
                                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">IPM target</div>
                                            <p className="mt-2 text-sm font-medium text-white">
                                                {formatMetric(product.ipm_target, 'number')}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-4 sm:col-span-2 lg:col-span-1">
                                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Tỉ lệ win của tuần</div>
                                            <p className="mt-2 text-sm font-medium text-white">
                                                {cpiSummary.passedCreatives} creative đạt / {cpiSummary.totalCreatives} creative
                                            </p>
                                            <p className="mt-2 text-xs leading-5 text-slate-400">
                                                {product.cpi_target_note || 'Win rate = số creative đạt CPI / tổng creative của tuần đang xem.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                    <div>
                                        <h2 className="text-xl font-semibold text-white">Benchmark theo tuần</h2>
                                        <p className="mt-1 text-sm text-slate-400">
                                            Chọn tuần trực tiếp trên timeline theo tháng để filter nhanh và nhập ngay trong dòng đầu của bảng bên dưới.
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                                        Dòng nhập đang gắn vào{' '}
                                        <span className="font-medium text-white">
                                            {entryTargetWeekOption ? `${entryTargetWeekOption.label} • ${entryTargetWeekOption.startDate}` : '--'}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                    <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4">
                                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Tuần đang xem</div>
                                        <p className="mt-2 text-base font-semibold text-white">
                                            {selectedWeekOption ? selectedWeekOption.label : 'Tất cả tuần'}
                                        </p>
                                        <p className="mt-1 text-sm text-slate-400">
                                            {selectedWeekOption ? selectedWeekOption.startDate : 'Đang xem toàn bộ dữ liệu'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-500">Platform</label>
                                        <select
                                            value={platformFilter}
                                            onChange={event => setPlatformFilter(event.target.value)}
                                            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                        >
                                            <option value="all">Tất cả platform</option>
                                            {platformOptions.map(option => (
                                                <option key={option} value={option}>
                                                    {option}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="mt-5">
                                    <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Timeline tuần 2026</div>
                                    <div className="grid gap-4 xl:grid-cols-3">
                                        {timelineWeekGroups.map(group => (
                                            <div key={group.label} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                                                <div className="text-sm font-semibold text-purple-300">{group.label}</div>
                                                <div className="mt-4 space-y-2 border-l border-slate-800 pl-4">
                                                    {group.weeks.map(option => {
                                                        const isActive = activeWeekKey === option.key
                                                        return (
                                                            <button
                                                                key={option.key}
                                                                type="button"
                                                                onClick={() => setSelectedWeekKey(option.key)}
                                                                className={`relative w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                                                                    isActive
                                                                        ? 'border-purple-500 bg-purple-500/15 text-white'
                                                                        : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                                                                }`}
                                                            >
                                                                <span
                                                                    className={`absolute -left-[22px] top-5 h-3 w-3 rounded-full border ${
                                                                        isActive
                                                                            ? 'border-purple-400 bg-purple-400'
                                                                            : 'border-slate-600 bg-slate-900'
                                                                    }`}
                                                                />
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <span className="font-medium">{option.label}</span>
                                                                    <span className="text-xs text-slate-400">{getTimelineWeekRange(option.startDate)}</span>
                                                                </div>
                                                                <div className="mt-1 text-xs text-slate-500">{option.startDate}</div>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
                                    <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4">
                                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                                            <CalendarDays className="h-4 w-4" />
                                            Tuần đang xem
                                        </div>
                                        <p className="mt-3 text-sm font-medium text-white">
                                            {selectedWeekOption ? `${selectedWeekOption.label} • ${selectedWeekOption.startDate}` : 'Tất cả tuần'}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4">
                                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                                            <Target className="h-4 w-4" />
                                            Tỉ lệ win
                                        </div>
                                        <p className="mt-3 text-sm font-medium text-white">
                                            {Math.round(cpiSummary.hitRate)}% ({cpiSummary.passedCreatives}/{cpiSummary.totalCreatives})
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4">
                                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                                            <TrendingUp className="h-4 w-4" />
                                            Avg CTR
                                        </div>
                                        <p className="mt-3 text-sm font-medium text-white">{formatMetric(avgCtr, 'percent')}</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4">
                                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                                            <TrendingUp className="h-4 w-4" />
                                            Avg CVR
                                        </div>
                                        <p className="mt-3 text-sm font-medium text-white">{formatMetric(avgCvr, 'percent')}</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4">
                                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Avg CPI</div>
                                        <p className="mt-3 text-sm font-medium text-white">{formatMetric(avgCpi, 'currency')}</p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4">
                                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Avg CPM</div>
                                        <p className="mt-3 text-sm font-medium text-white">{formatMetric(avgCpm, 'currency')}</p>
                                    </div>
                                </div>
                            </section>

                            <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70">
                                <div className="flex flex-col gap-3 border-b border-slate-800 px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
                                    <div>
                                        <h2 className="text-xl font-semibold text-white">Bảng benchmark tuần</h2>
                                        <p className="mt-1 text-sm text-slate-400">
                                            Nhập trực tiếp ngay trong dòng đầu. Bảng đã bỏ ngày check, IPM, spend và trạng thái để nhìn gọn toàn bộ chỉ số.
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                                        {filteredEntries.length} creative trong bộ lọc hiện tại
                                    </div>
                                </div>

                                <div className="overflow-hidden">
                                    <table className="w-full table-fixed text-sm">
                                        <thead className="bg-slate-950/80 text-left text-slate-400">
                                            <tr>
                                                <th className="w-[13%] px-4 py-3 font-medium">Platform</th>
                                                <th className="w-[27%] px-4 py-3 font-medium">Tên idea</th>
                                                <th className="w-[14%] px-4 py-3 font-medium">Thị trường</th>
                                                <th className="w-[8%] px-4 py-3 font-medium">CTR</th>
                                                <th className="w-[8%] px-4 py-3 font-medium">CVR</th>
                                                <th className="w-[8%] px-4 py-3 font-medium">CPI</th>
                                                <th className="w-[8%] px-4 py-3 font-medium">CPM</th>
                                                <th className="w-[14%] px-4 py-3 text-right font-medium">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-t border-slate-800/80 bg-slate-950/60 align-top">
                                                <td className="px-4 py-4">
                                                    <div>
                                                        <input
                                                            type="text"
                                                            value={entryForm.platform}
                                                            onChange={event => handleEntryFieldChange('platform', event.target.value)}
                                                            placeholder={product.platform_focus || 'iOS / Android / Global'}
                                                            className={inlineCellInputClass}
                                                        />
                                                        <p className="mt-2 text-xs text-slate-500">
                                                            {editingEntryId
                                                                ? `Tuần đang sửa: ${entryForm.week_label || '--'}`
                                                                : `Tuần sẽ lưu: ${entryTargetWeekOption ? `${entryTargetWeekOption.label} • ${entryTargetWeekOption.startDate}` : '--'}`}
                                                        </p>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="text"
                                                        value={entryForm.idea_name}
                                                        onChange={event => handleEntryFieldChange('idea_name', event.target.value)}
                                                        placeholder="Nhập tên idea"
                                                        className={inlineCellInputClass}
                                                    />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="text"
                                                        value={entryForm.market}
                                                        onChange={event => handleEntryFieldChange('market', event.target.value)}
                                                        placeholder="GL - US, GL - GB..."
                                                        className={inlineCellInputClass}
                                                    />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={entryForm.ctr}
                                                        onChange={event => handleEntryFieldChange('ctr', event.target.value)}
                                                        placeholder="0.00"
                                                        className={inlineCellInputClass}
                                                    />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={entryForm.cvr}
                                                        onChange={event => handleEntryFieldChange('cvr', event.target.value)}
                                                        placeholder="0.00"
                                                        className={inlineCellInputClass}
                                                    />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={entryForm.cpi}
                                                        onChange={event => handleEntryFieldChange('cpi', event.target.value)}
                                                        placeholder="0.00"
                                                        className={inlineCellInputClass}
                                                    />
                                                </td>
                                                <td className="px-4 py-4">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={entryForm.cpm}
                                                        onChange={event => handleEntryFieldChange('cpm', event.target.value)}
                                                        placeholder="0.00"
                                                        className={inlineCellInputClass}
                                                    />
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={prepareNewEntry}
                                                            className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
                                                        >
                                                            {editingEntryId ? 'Hủy sửa' : 'Reset'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleSaveEntry}
                                                            disabled={savingEntry}
                                                            className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-70"
                                                        >
                                                            {savingEntry ? 'Đang lưu...' : editingEntryId ? 'Lưu' : 'Thêm'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {filteredEntries.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                                                        {selectedWeekOption
                                                            ? `Chưa có creative nào cho ${selectedWeekOption.label}. Hãy nhập trực tiếp ở dòng đầu của bảng.`
                                                            : 'Chưa có creative nào cho bộ lọc hiện tại. Hãy nhập trực tiếp ở dòng đầu của bảng.'}
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredEntries.map(entry => {
                                                    return (
                                                        <tr key={entry.id} className="border-t border-slate-800/80 text-slate-200 hover:bg-slate-900">
                                                            <td className="px-4 py-4 align-top">
                                                                <span className="text-sm text-slate-200">
                                                                    {entry.platform || product.platform_focus || '--'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-4 align-top">
                                                                <div className="pr-2">
                                                                    <p className="break-words font-medium text-white">{entry.idea_name}</p>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-4 align-top">{entry.market || '--'}</td>
                                                            <td className="px-4 py-4 align-top">{formatMetric(entry.ctr, 'percent')}</td>
                                                            <td className="px-4 py-4 align-top">{formatMetric(entry.cvr, 'percent')}</td>
                                                            <td className="px-4 py-4 align-top font-medium text-white">
                                                                {formatMetric(entry.cpi, 'currency')}
                                                            </td>
                                                            <td className="px-4 py-4 align-top">{formatMetric(entry.cpm, 'currency')}</td>
                                                            <td className="px-4 py-4 text-right align-top">
                                                                <div className="flex justify-end gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleEditEntry(entry)}
                                                                        className="rounded-xl border border-slate-700 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white"
                                                                    >
                                                                        <Pencil className="h-4 w-4" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDeleteEntry(entry.id)}
                                                                        disabled={deletingEntryId === entry.id}
                                                                        className="rounded-xl border border-rose-500/30 p-2 text-rose-300 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </>
                    )}
                </div>
            </div>
        </DashboardLayout>
    )
}
