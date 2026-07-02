'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Boxes, PackagePlus, Search, Sparkles, Target, TrendingUp, X } from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import { createClient } from '@/lib/supabase/client'
import {
    BenchmarkEntry,
    BenchmarkProduct,
    BenchmarkProductFormValues,
    calculateCpiSummary,
    compareWeekKeysDescending,
    defaultBenchmarkProductForm,
    formatMetric,
    getWeekGroupKey,
    isBenchmarkSetupMissing,
    parseNullableNumber,
} from '@/lib/benchmarks'

interface ProductStats {
    totalRows: number
    totalWeeks: number
    latestWeekLabel: string | null
    latestHitRate: number
}

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

function SetupNotice() {
    return (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 px-6 py-6">
            <h3 className="text-lg font-semibold text-amber-100">Thiếu bảng benchmark trong Supabase</h3>
            <p className="mt-2 text-sm leading-6 text-amber-50/80">
                Module benchmark đã sẵn sàng, nhưng database vẫn chưa có đủ bảng. Hãy chạy file{' '}
                <code className="rounded bg-slate-900/80 px-2 py-1 text-xs">supabase/benchmark_schema.sql</code> rồi tải lại
                trang.
            </p>
        </div>
    )
}

function EmptyState({
    title,
    description,
    showAction,
    onAction,
}: {
    title: string
    description: string
    showAction: boolean
    onAction: () => void
}) {
    return (
        <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/60 px-8 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-300">
                <Boxes className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-semibold text-white">{title}</h3>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
            {showAction && (
                <button
                    type="button"
                    onClick={onAction}
                    className="mt-6 inline-flex items-center rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
                >
                    <PackagePlus className="mr-2 h-4 w-4" />
                    Thêm app benchmark
                </button>
            )}
        </div>
    )
}

function CreateProductModal({
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
                        <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-purple-300">
                            Benchmark product
                        </div>
                        <h2 className="mt-3 text-2xl font-semibold text-white">Tạo app benchmark</h2>
                        <p className="mt-2 text-sm text-slate-400">
                            Tạo kho sản phẩm trước, sau đó click vào từng app để nhập benchmark theo tuần.
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
                                placeholder="Ví dụ: AI Home iOS"
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-300">Category</label>
                            <input
                                type="text"
                                value={form.category}
                                onChange={event => onChange('category', event.target.value)}
                                placeholder="Utility, Health..."
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                            />
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-300">Icon / emoji</label>
                            <input
                                type="text"
                                value={form.icon_emoji}
                                onChange={event => onChange('icon_emoji', event.target.value)}
                                placeholder="Ví dụ: AI hoặc 📱"
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-300">Platform focus</label>
                            <input
                                type="text"
                                value={form.platform_focus}
                                onChange={event => onChange('platform_focus', event.target.value)}
                                placeholder="iOS / Android / Global"
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
                                placeholder="4"
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
                                placeholder="1.50"
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
                                placeholder="20"
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
                                placeholder="12"
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
                                placeholder="3"
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                            />
                        </div>

                        <div className="lg:col-span-4">
                            <label className="mb-2 block text-sm font-medium text-slate-300">Mô tả / ghi chú benchmark</label>
                            <textarea
                                value={form.description}
                                onChange={event => onChange('description', event.target.value)}
                                rows={3}
                                placeholder="Mô tả nhanh về app, thị trường hoặc ngữ cảnh benchmark"
                                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                            />
                        </div>

                        <div className="lg:col-span-4">
                            <label className="mb-2 block text-sm font-medium text-slate-300">Ghi chú CPI hiển thị</label>
                            <input
                                type="text"
                                value={form.cpi_target_note}
                                onChange={event => onChange('cpi_target_note', event.target.value)}
                                placeholder="Ví dụ: ≤ $4 cho US, ≤ $1 cho GL"
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
                        {saving ? 'Đang lưu...' : 'Tạo app benchmark'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function BenchmarksPage() {
    const supabase = useMemo(() => createClient(), [])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [setupMissing, setSetupMissing] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [products, setProducts] = useState<BenchmarkProduct[]>([])
    const [entries, setEntries] = useState<BenchmarkEntry[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [productForm, setProductForm] = useState<BenchmarkProductFormValues>(defaultBenchmarkProductForm())

    useEffect(() => {
        let mounted = true

        const loadData = async () => {
            setLoading(true)
            setErrorMessage(null)

            const [{ data: productRows, error: productError }, { data: entryRows, error: entryError }] = await Promise.all([
                supabase
                    .from('benchmark_products')
                    .select('*')
                    .eq('is_active', true)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('benchmark_entries')
                    .select('id, product_id, week_label, week_start_date, checked_date, platform, idea_name, market, ctr, cvr, ipm, cpi, cpm, spend, status_note, created_at, updated_at')
                    .order('week_start_date', { ascending: false }),
            ])

            if (!mounted) {
                return
            }

            if (productError || entryError) {
                const sourceError = productError || entryError

                if (isBenchmarkSetupMissing(sourceError)) {
                    setSetupMissing(true)
                    setProducts([])
                    setEntries([])
                    setLoading(false)
                    return
                }

                setErrorMessage(sourceError?.message || 'Không thể tải dữ liệu benchmark.')
                setLoading(false)
                return
            }

            setSetupMissing(false)
            setProducts((productRows || []) as BenchmarkProduct[])
            setEntries((entryRows || []) as BenchmarkEntry[])
            setLoading(false)
        }

        void loadData()

        return () => {
            mounted = false
        }
    }, [supabase])

    const entriesByProduct = useMemo(() => {
        return entries.reduce<Record<string, BenchmarkEntry[]>>((result, entry) => {
            if (!result[entry.product_id]) {
                result[entry.product_id] = []
            }

            result[entry.product_id].push(entry)
            return result
        }, {})
    }, [entries])

    const productStatsMap = useMemo(() => {
        return products.reduce<Record<string, ProductStats>>((result, product) => {
            const productEntries = entriesByProduct[product.id] || []
            const distinctWeekKeys = Array.from(
                new Set(productEntries.map(entry => getWeekGroupKey(entry.week_label, entry.week_start_date)))
            )
            const latestWeekEntry = [...productEntries].sort(compareWeekKeysDescending)[0]
            const latestWeekEntries = latestWeekEntry
                ? productEntries.filter(
                    entry =>
                        entry.week_label === latestWeekEntry.week_label &&
                        entry.week_start_date === latestWeekEntry.week_start_date
                )
                : []
            const latestSummary = calculateCpiSummary(latestWeekEntries, product.cpi_target)

            result[product.id] = {
                totalRows: productEntries.length,
                totalWeeks: distinctWeekKeys.length,
                latestWeekLabel: latestWeekEntry?.week_label || null,
                latestHitRate: latestSummary.hitRate,
            }

            return result
        }, {})
    }, [entriesByProduct, products])

    const filteredProducts = useMemo(() => {
        if (!searchQuery.trim()) {
            return products
        }

        const keyword = searchQuery.trim().toLowerCase()
        return products.filter(product =>
            [product.name, product.category || '', product.platform_focus || '', product.description || ''].some(value =>
                value.toLowerCase().includes(keyword)
            )
        )
    }, [products, searchQuery])

    const totalStoredWeeks = useMemo(() => {
        return Array.from(new Set(entries.map(entry => getWeekGroupKey(entry.week_label, entry.week_start_date)))).length
    }, [entries])

    const handleProductFieldChange = (field: keyof BenchmarkProductFormValues, value: string) => {
        setProductForm(previous => ({
            ...previous,
            [field]: value,
        }))
    }

    const closeCreateModal = () => {
        setShowCreateModal(false)
        setProductForm(defaultBenchmarkProductForm())
    }

    const handleCreateProduct = async () => {
        if (!productForm.name.trim()) {
            setErrorMessage('Tên app là bắt buộc.')
            return
        }

        setSaving(true)
        setErrorMessage(null)

        const { data: authData } = await supabase.auth.getUser()
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
            created_by: authData.user?.id || null,
        }

        const { data, error } = await supabase
            .from('benchmark_products')
            .insert(payload)
            .select()
            .single()

        if (error) {
            setErrorMessage(error.message)
            setSaving(false)
            return
        }

        setProducts(previous => [data as BenchmarkProduct, ...previous])
        setSaving(false)
        closeCreateModal()
    }

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-slate-950 p-6">
                <div className="mx-auto max-w-7xl space-y-6">
                    <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80">
                        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.6fr_0.9fr] lg:px-8 lg:py-8">
                            <div>
                                <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-purple-300">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Benchmarks
                                </div>
                                <h1 className="mt-4 text-3xl font-semibold text-white">Kho ứng dụng benchmark</h1>
                                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                                    Tạo một mục sản phẩm cho mỗi app, sau đó click vào từng app để nhập benchmark theo tuần.
                                    Hệ thống sẽ tự tính <span className="font-medium text-white">% đạt</span> theo công thức:
                                    số creative đạt CPI chia cho tổng creative của tuần đang xem.
                                </p>
                                <div className="mt-6 flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(true)}
                                        className="inline-flex items-center rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500"
                                    >
                                        <PackagePlus className="mr-2 h-4 w-4" />
                                        Thêm app benchmark
                                    </button>
                                    <div className="inline-flex items-center rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                                        Click vào từng card để mở benchmark chi tiết theo app
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-4">
                                    <p className="text-sm text-slate-400">Tổng app</p>
                                    <p className="mt-2 text-2xl font-semibold text-white">{products.length}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-4">
                                    <p className="text-sm text-slate-400">Tổng creative</p>
                                    <p className="mt-2 text-2xl font-semibold text-white">{entries.length}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-4">
                                    <p className="text-sm text-slate-400">Tuần đã lưu</p>
                                    <p className="mt-2 text-2xl font-semibold text-white">{totalStoredWeeks}</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 px-5 py-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="relative w-full max-w-xl">
                                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={event => setSearchQuery(event.target.value)}
                                    placeholder="Tìm app, category hoặc platform..."
                                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-3 pl-11 pr-4 text-white outline-none transition focus:border-purple-500"
                                />
                            </div>
                            <p className="text-sm text-slate-400">
                                Mỗi app có một bảng benchmark riêng. Dữ liệu creative sẽ được quản lý trong trang chi tiết.
                            </p>
                        </div>
                    </section>

                    {errorMessage && (
                        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200">
                            {errorMessage}
                        </div>
                    )}

                    {showCreateModal && (
                        <CreateProductModal
                            form={productForm}
                            saving={saving}
                            onChange={handleProductFieldChange}
                            onClose={closeCreateModal}
                            onSubmit={handleCreateProduct}
                        />
                    )}

                    {setupMissing ? (
                        <SetupNotice />
                    ) : loading ? (
                        <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-slate-800 bg-slate-900/70">
                            <div className="text-center">
                                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-purple-500" />
                                <p className="mt-4 text-sm text-slate-400">Đang tải kho benchmark...</p>
                            </div>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <EmptyState
                            title={products.length === 0 ? 'Chưa có app benchmark nào' : 'Không tìm thấy app phù hợp'}
                            description={
                                products.length === 0
                                    ? 'Hãy tạo app benchmark đầu tiên để quản lý dữ liệu benchmark theo tuần cho từng sản phẩm.'
                                    : 'Thử đổi từ khóa tìm kiếm hoặc thêm app benchmark mới.'
                            }
                            showAction={products.length === 0}
                            onAction={() => setShowCreateModal(true)}
                        />
                    ) : (
                        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                            {filteredProducts.map(product => {
                                const stats = productStatsMap[product.id] || {
                                    totalRows: 0,
                                    totalWeeks: 0,
                                    latestWeekLabel: null,
                                    latestHitRate: 0,
                                }

                                return (
                                    <Link
                                        key={product.id}
                                        href={`/benchmarks/${product.id}`}
                                        className="group overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 transition duration-200 hover:-translate-y-1 hover:border-purple-500/40 hover:bg-slate-900"
                                    >
                                        <div className="border-b border-slate-800/80 px-6 py-5">
                                            <div className="flex items-start justify-between gap-4">
                                                <ProductAvatar product={product} />
                                                <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-purple-300">
                                                    {product.category || 'Benchmark'}
                                                </span>
                                            </div>

                                            <div className="mt-5">
                                                <h2 className="text-xl font-semibold text-white transition group-hover:text-purple-200">
                                                    {product.name}
                                                </h2>
                                                <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-400">
                                                    {product.description || 'Theo dõi benchmark thủ công theo tuần, thị trường và hiệu suất creative.'}
                                                </p>
                                            </div>

                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {product.platform_focus && (
                                                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-200">
                                                        {product.platform_focus}
                                                    </span>
                                                )}
                                                {product.cpi_target !== null && (
                                                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                                                        CPI {formatMetric(product.cpi_target, 'currency')}
                                                    </span>
                                                )}
                                                {product.ctr_target !== null && (
                                                    <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
                                                        CTR {formatMetric(product.ctr_target, 'percent')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3 px-6 py-5">
                                            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                    <TrendingUp className="h-3.5 w-3.5" />
                                                    Creative
                                                </div>
                                                <p className="mt-2 text-lg font-semibold text-white">{stats.totalRows}</p>
                                            </div>
                                            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                    <Target className="h-3.5 w-3.5" />
                                                    % đạt
                                                </div>
                                                <p className="mt-2 text-lg font-semibold text-white">{Math.round(stats.latestHitRate)}%</p>
                                            </div>
                                            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                    <Boxes className="h-3.5 w-3.5" />
                                                    Tuần
                                                </div>
                                                <p className="mt-2 text-lg font-semibold text-white">{stats.totalWeeks}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-4 text-sm text-slate-400">
                                            <div>
                                                <p>Tuần gần nhất</p>
                                                <p className="mt-1 font-medium text-white">{stats.latestWeekLabel || 'Chưa có dữ liệu'}</p>
                                            </div>
                                            <span className="inline-flex items-center gap-2 font-medium text-purple-300">
                                                Mở benchmark
                                                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                                            </span>
                                        </div>
                                    </Link>
                                )
                            })}
                        </section>
                    )}
                </div>
            </div>
        </DashboardLayout>
    )
}
