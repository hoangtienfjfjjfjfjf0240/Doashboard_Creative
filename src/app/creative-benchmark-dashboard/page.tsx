'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    addDays,
    addWeeks,
    format,
    isSameDay,
    startOfWeek,
} from 'date-fns'
import {
    ArrowRight,
    BarChart3,
    Calendar,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Flame,
    Trophy,
    TrendingUp,
} from 'lucide-react'
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import DashboardLayout from '@/components/DashboardLayout'
import { useUser } from '@/contexts/UserContext'
import { createClient } from '@/lib/supabase/client'

type BenchmarkApp = {
    id: string
    name: string
    category: string
    meta: string
    iconUrl?: string
    storeUrl?: string
    playUrl?: string
    accent: string
    source?: 'app-store' | 'google-play' | 'manual'
    externalId?: string
    isCustom?: boolean
}

type DbBenchmarkEntrySummary = {
    app_id: string
    passed: boolean | null
    win: boolean | null
}

type DbWeeklyStatsRow = {
    app_id: string
    videos_created: number | null
    benchmark_market: string | null
    benchmark_ctr: number | null
    benchmark_cvr: number | null
    benchmark_cpi: number | null
    benchmark_cpm: number | null
    created_by: string | null
    created_at: string | null
}

type AppSignalMetric = {
    app: BenchmarkApp
    ideaCount: number
    videosCreated: number
    funnelOneCount: number
    winCount: number
    funnelOneRate: number
    winRate: number
    benchmarkMarket: string
    benchmarkCtr: number | null
    benchmarkCvr: number | null
    benchmarkCpi: number | null
    benchmarkCpm: number | null
    hasSavedData: boolean
}

type SignalChartDatum = {
    appName: string
    label: string
    rate: number
    numerator: number
    denominator: number
    fill: string
}

type DeadlineStats = {
    weekStartDate: string
    totalIdeaCreators: number
    submittedCount: number
    onTimeCount: number
    lateCount: number
    pendingCount: number
}

const BENCHMARK_APPS: BenchmarkApp[] = [
    {
        id: 'app-store-1641040766',
        name: 'AI Cleaner: Clean Up Storage+',
        category: 'Tiện ích',
        meta: 'App Store',
        iconUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/21/07/29/210729ae-3d3f-a0ce-1d0f-e983d9159d18/AppIcon-0-0-1x_U007ephone-0-1-0-85-220.png/100x100bb.jpg',
        accent: 'from-indigo-500 to-blue-700',
        storeUrl: 'https://apps.apple.com/us/app/ai-cleaner-clean-up-storage/id1641040766?uo=4',
        source: 'app-store',
        externalId: '1641040766',
    },
    {
        id: 'app-store-6468660073',
        name: 'iCardiac: Heart Rate & Health',
        category: 'Sức khỏe & Thể hình',
        meta: 'App Store',
        iconUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/5d/66/3f/5d663f6f-56c9-4043-ae0e-c5bce1568a9d/AppIcon-0-0-1x_U007ephone-0-1-0-85-220.png/100x100bb.jpg',
        accent: 'from-rose-400 to-red-600',
        storeUrl: 'https://apps.apple.com/us/app/icardiac-heart-rate-health/id6468660073?uo=4',
        source: 'app-store',
        externalId: '6468660073',
    },
    {
        id: 'app-store-6737820730',
        name: 'BetterMeal: Daily Food Scanner',
        category: 'Sức khỏe & Thể hình',
        meta: 'App Store',
        iconUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/8a/b6/a1/8ab6a1da-d2a0-8598-9db1-0f67e6f00639/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/100x100bb.jpg',
        accent: 'from-zinc-800 to-black',
        storeUrl: 'https://apps.apple.com/us/app/bettermeal-daily-food-scanner/id6737820730?uo=4',
        source: 'app-store',
        externalId: '6737820730',
    },
    {
        id: 'google-play-com-chat-chatai-chatbot-aichatbot',
        name: 'OneSearch: DeepSearch Finder',
        category: 'Tiện ích',
        meta: 'CH Play',
        iconUrl: 'https://play-lh.googleusercontent.com/6G404D8racifwToPJ6ViEvOrnzYrmsudcIN0drD5XfcYiNzolpdrYHSExDgsTgBNE13Mb0qjUjgkkeKsI1yI',
        accent: 'from-slate-700 to-black',
        playUrl: 'https://play.google.com/store/apps/details?id=com.chat.chatai.chatbot.aichatbot',
        source: 'google-play',
        externalId: 'com.chat.chatai.chatbot.aichatbot',
    },
    {
        id: 'app-store-6754923194',
        name: 'SnapHome: AI Interior Design',
        category: 'Đồ họa & Thiết kế',
        meta: 'App Store',
        iconUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/93/56/fb/9356fbe5-239a-70e4-31b2-48303fc2c3d5/AppIcon-0-0-1x_U007ephone-0-1-0-85-220.png/100x100bb.jpg',
        accent: 'from-amber-300 to-stone-600',
        storeUrl: 'https://apps.apple.com/us/app/snaphome-ai-interior-design/id6754923194?uo=4',
        source: 'app-store',
        externalId: '6754923194',
    },
    {
        id: 'app-store-6504796378',
        name: 'QR Code Reader, Scan Barcode',
        category: 'Tiện ích',
        meta: 'App Store',
        iconUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/20/e9/73/20e9734f-dc4c-e83a-dd14-dc5b034ddd7b/AppIcon-0-0-1x_U007ephone-0-1-0-85-220.png/100x100bb.jpg',
        accent: 'from-sky-400 to-blue-600',
        storeUrl: 'https://apps.apple.com/us/app/qr-code-reader-scan-barcode/id6504796378?uo=4',
        source: 'app-store',
        externalId: '6504796378',
    },
    {
        id: 'app-store-6759957263',
        name: 'Office Word: Edit Document',
        category: 'Năng suất',
        meta: 'App Store',
        iconUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/de/a7/0f/dea70f79-a133-63bb-ad38-84e1dfeed2de/AppIcon-0-0-1x_U007epad-0-1-0-85-220.png/100x100bb.jpg',
        accent: 'from-blue-500 to-cyan-500',
        storeUrl: 'https://apps.apple.com/us/app/office-word-edit-document/id6759957263?uo=4',
        source: 'app-store',
        externalId: '6759957263',
    },
    {
        id: 'google-play-com-aicleaner-clean-cleanstorage-ai',
        name: 'AI Cleaner: Clean up Storage',
        category: 'Tiện ích',
        meta: 'CH Play',
        iconUrl: 'https://play-lh.googleusercontent.com/4k-JMrJ0-bZqVTtltbvMHPaC5pWsUMYKrZX4BkQOGEQ__4pDLBFOoyyTMq9xQi3QpVq4cWoULYZpZZq2dcGEpWc',
        accent: 'from-indigo-400 to-blue-700',
        playUrl: 'https://play.google.com/store/apps/details?id=com.aicleaner.clean.cleanstorage.ai',
        source: 'google-play',
        externalId: 'com.aicleaner.clean.cleanstorage.ai',
    },
]

const MONTH_NAMES = [
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
]

const QUICK_WEEKS = [
    { key: 'this-week', label: 'Tuần này', offset: 0 },
    { key: 'next-week', label: 'Tuần sau', offset: 1 },
]

const DEFAULT_BENCHMARK_MARKET = 'US/Global'
const CUSTOM_APPS_STORAGE_KEY = 'creative-benchmark:custom-apps:v2'
const HIDDEN_APPS_STORAGE_KEY = 'creative-benchmark:hidden-apps:v1'

function toDateKey(date: Date) {
    return format(date, 'yyyy-MM-dd')
}

function generateTimelineWeeks(startDate: Date) {
    const firstWeekStart = startOfWeek(startDate, { weekStartsOn: 1 })
    const finalWeekStart = startOfWeek(new Date(startDate.getFullYear(), 11, 31), { weekStartsOn: 1 })
    const weeks = []

    let currentStart = firstWeekStart
    let index = 1

    while (currentStart.getTime() <= finalWeekStart.getTime()) {
        const end = addDays(currentStart, 4)
        weeks.push({
            index,
            start: currentStart,
            end,
            month: currentStart.getMonth(),
            year: currentStart.getFullYear(),
        })
        currentStart = addWeeks(currentStart, 1)
        index += 1
    }

    return weeks
}

function groupWeeksByMonth(weeks: ReturnType<typeof generateTimelineWeeks>) {
    return weeks.reduce<Record<string, typeof weeks>>((groups, week) => {
        const key = `${week.year}-${week.month}`
        if (!groups[key]) groups[key] = []
        groups[key].push(week)
        return groups
    }, {})
}

function loadStoredApps() {
    try {
        const raw = localStorage.getItem(CUSTOM_APPS_STORAGE_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed as BenchmarkApp[] : []
    } catch {
        return []
    }
}

function loadHiddenAppIds() {
    try {
        const raw = localStorage.getItem(HIDDEN_APPS_STORAGE_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
    } catch {
        return []
    }
}

function formatMetricValue(value: number | null | undefined) {
    if (value === null || value === undefined) return '--'
    if (Number.isInteger(value)) return String(value)
    return value.toFixed(2).replace(/\.?0+$/, '')
}

function getShortAppLabel(name: string) {
    return name.length <= 18 ? name : `${name.slice(0, 18)}...`
}

function createFallbackApp(appId: string): BenchmarkApp {
    const cleanedName = appId
        .replace(/^(app-store-|google-play-|manual-)/, '')
        .replace(/[-_.]+/g, ' ')
        .trim()

    return {
        id: appId,
        name: cleanedName || appId,
        category: 'Benchmark',
        meta: 'Đã lưu',
        accent: 'from-slate-600 to-slate-800',
    }
}

function getFetchErrorMessage(error?: { message?: string } | null) {
    const detail = error?.message ? ` (${error.message})` : ''
    return `Không tải được dashboard benchmark tuần này.${detail}`
}

function KpiCard({
    label,
    value,
    hint,
    accentClass,
}: {
    label: string
    value: string
    hint: string
    accentClass: string
}) {
    return (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.28)]">
            <div className={`inline-flex rounded-2xl px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] ${accentClass}`}>
                {label}
            </div>
            <div className="mt-4 text-3xl font-bold text-white">{value}</div>
            <p className="mt-2 text-sm text-slate-400">{hint}</p>
        </div>
    )
}

function RankingPanel({
    title,
    caption,
    icon: Icon,
    items,
    type,
}: {
    title: string
    caption: string
    icon: typeof Flame
    items: AppSignalMetric[]
    type: 'funnel' | 'win'
}) {
    const accent = type === 'funnel'
        ? {
            ring: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-200',
            bar: 'from-cyan-400 via-sky-400 to-emerald-400',
            badge: 'text-cyan-200',
        }
        : {
            ring: 'border-amber-500/25 bg-amber-500/10 text-amber-100',
            bar: 'from-amber-400 via-orange-400 to-rose-400',
            badge: 'text-amber-100',
        }

    return (
        <section className="rounded-[28px] border border-slate-800 bg-slate-900/75 p-5 shadow-[0_22px_50px_rgba(15,23,42,0.35)]">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] ${accent.ring}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {title}
                    </div>
                    <p className="mt-3 text-sm text-slate-400">{caption}</p>
                </div>
                <span className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1 text-xs font-semibold text-slate-300">
                    {items.length} app
                </span>
            </div>

            {items.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 px-4 py-8 text-center text-sm text-slate-500">
                    Chưa có app đủ dữ liệu cho bảng xếp hạng này.
                </div>
            ) : (
                <div className="mt-5 space-y-3">
                    {items.map((item, index) => {
                        const metricValue = type === 'funnel' ? item.funnelOneRate : item.winRate
                        const countText = type === 'funnel'
                            ? `${item.funnelOneCount}/${item.videosCreated || 0} qua phễu 1`
                            : `${item.winCount}/${item.funnelOneCount || 0} win`

                        return (
                            <div
                                key={`${type}-${item.app.id}`}
                                className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${item.app.accent} text-sm font-bold text-white shadow-lg`}>
                                        {index + 1}
                                    </div>
                                    <AppIdentity app={item.app} compact />
                                    <div className="ml-auto text-right">
                                        <div className={`text-2xl font-bold ${accent.badge}`}>{metricValue}%</div>
                                        <div className="text-xs text-slate-400">{countText}</div>
                                    </div>
                                </div>
                                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                                    <div
                                        className={`h-full rounded-full bg-gradient-to-r ${accent.bar}`}
                                        style={{ width: `${Math.min(metricValue, 100)}%` }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </section>
    )
}

function AppIdentity({
    app,
    compact = false,
}: {
    app: BenchmarkApp
    compact?: boolean
}) {
    return (
        <div className="flex min-w-0 items-center gap-3">
            {app.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={app.iconUrl}
                    alt={app.name}
                    className={`${compact ? 'h-10 w-10 rounded-2xl' : 'h-12 w-12 rounded-2xl'} shrink-0 border border-slate-800 object-cover`}
                />
            ) : (
                <div className={`${compact ? 'h-10 w-10 text-sm' : 'h-12 w-12 text-base'} flex shrink-0 items-center justify-center rounded-2xl border border-slate-800 bg-slate-800 font-bold text-white`}>
                    {app.name.slice(0, 1).toUpperCase()}
                </div>
            )}
            <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{app.name}</div>
                <div className="truncate text-xs text-slate-400">{app.category} • {app.meta}</div>
            </div>
        </div>
    )
}

function SignalBarChart({
    title,
    caption,
    data,
    emptyText,
}: {
    title: string
    caption: string
    data: SignalChartDatum[]
    emptyText: string
}) {
    return (
        <section className="rounded-[28px] border border-slate-800 bg-slate-900/75 p-5 shadow-[0_22px_50px_rgba(15,23,42,0.35)]">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-slate-200">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {title}
                    </div>
                    <p className="mt-3 text-sm text-slate-400">{caption}</p>
                </div>
                <span className="rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1 text-xs font-semibold text-slate-300">
                    {data.length} app
                </span>
            </div>

            {data.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 px-4 py-8 text-center text-sm text-slate-500">
                    {emptyText}
                </div>
            ) : (
                <div className="mt-5 h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={data}
                            layout="vertical"
                            margin={{ top: 4, right: 16, left: 16, bottom: 4 }}
                            barCategoryGap={12}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                            <XAxis
                                type="number"
                                domain={[0, 100]}
                                tickFormatter={value => `${value}%`}
                                stroke="#64748b"
                                fontSize={11}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                type="category"
                                dataKey="label"
                                width={120}
                                stroke="#94a3b8"
                                fontSize={11}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                cursor={{ fill: 'rgba(15, 23, 42, 0.45)' }}
                                contentStyle={{
                                    backgroundColor: '#0f172a',
                                    border: '1px solid #334155',
                                    borderRadius: '12px',
                                    padding: '10px 12px',
                                }}
                                labelStyle={{ color: '#f8fafc', fontWeight: 700 }}
                                formatter={(value: number | string | undefined, _name, payload) => {
                                    const item = payload?.payload as SignalChartDatum | undefined
                                    if (!item) return [`${value ?? 0}%`, 'Tỉ lệ']
                                    return [`${item.rate}%`, `${item.numerator}/${item.denominator}`]
                                }}
                                labelFormatter={(_label, payload) => {
                                    const item = payload?.[0]?.payload as SignalChartDatum | undefined
                                    return item?.appName || ''
                                }}
                            />
                            <Bar dataKey="rate" radius={[0, 10, 10, 0]} maxBarSize={26}>
                                {data.map(item => (
                                    <Cell key={`${title}-${item.appName}`} fill={item.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </section>
    )
}

export default function CreativeBenchmarkDashboardPage() {
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])
    const { user, loading: userLoading, canAccessFeature } = useUser()
    const canAccessBenchmark = canAccessFeature('benchmark')
    const currentWeekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), [])
    const timelineWeeks = useMemo(() => generateTimelineWeeks(currentWeekStart), [currentWeekStart])
    const weeksByMonth = useMemo(() => groupWeeksByMonth(timelineWeeks), [timelineWeeks])

    const [selectedWeekStart, setSelectedWeekStart] = useState(currentWeekStart)
    const [showWeekPicker, setShowWeekPicker] = useState(false)
    const [customApps] = useState<BenchmarkApp[]>(() => typeof window === 'undefined' ? [] : loadStoredApps())
    const [hiddenAppIds] = useState<string[]>(() => typeof window === 'undefined' ? [] : loadHiddenAppIds())
    const [loadingData, setLoadingData] = useState(true)
    const [entries, setEntries] = useState<DbBenchmarkEntrySummary[]>([])
    const [weeklyStats, setWeeklyStats] = useState<DbWeeklyStatsRow[]>([])
    const [deadlineStats, setDeadlineStats] = useState<DeadlineStats | null>(null)
    const [message, setMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null)
    const weekPickerRef = useRef<HTMLDivElement>(null)

    const selectedWeekKey = toDateKey(selectedWeekStart)
    const selectedWeekEnd = addDays(selectedWeekStart, 4)
    const lastTimelineWeekStart = timelineWeeks[timelineWeeks.length - 1]?.start || currentWeekStart
    const canGoToPreviousWeek = selectedWeekStart.getTime() > currentWeekStart.getTime()
    const canGoToNextWeek = selectedWeekStart.getTime() < lastTimelineWeekStart.getTime()

    const benchmarkApps = useMemo(
        () => [...BENCHMARK_APPS, ...customApps].filter(app => !hiddenAppIds.includes(app.id)),
        [customApps, hiddenAppIds]
    )

    const loadDashboardData = useCallback(async () => {
        setLoadingData(true)
        setMessage(null)

        const deadlineRequest = fetch(`/api/creative-benchmark/deadline-stats?weekStartDate=${selectedWeekKey}`, {
            cache: 'no-store',
        })
            .then(async response => {
                const payload = await response.json().catch(() => null)
                if (!response.ok) {
                    return {
                        data: null,
                        error: payload?.error || 'Khong tai duoc ti le deadline.',
                    }
                }

                return {
                    data: payload as DeadlineStats,
                    error: null,
                }
            })
            .catch(error => ({
                data: null,
                error: error instanceof Error ? error.message : 'Khong tai duoc ti le deadline.',
            }))

        const [entriesResult, statsResult, deadlineResult] = await Promise.all([
            supabase
                .from('creative_benchmark_entries')
                .select('app_id, passed, win')
                .eq('week_start_date', selectedWeekKey),
            supabase
                .from('creative_benchmark_weekly_stats')
                .select('app_id, videos_created, benchmark_market, benchmark_ctr, benchmark_cvr, benchmark_cpi, benchmark_cpm, created_by, created_at')
                .eq('week_start_date', selectedWeekKey),
            deadlineRequest,
        ])

        if (entriesResult.error || statsResult.error) {
            setEntries([])
            setWeeklyStats([])
            setDeadlineStats(null)
            setMessage({ type: 'error', text: getFetchErrorMessage(entriesResult.error || statsResult.error) })
            setLoadingData(false)
            return
        }

        setEntries((entriesResult.data as DbBenchmarkEntrySummary[] | null) || [])
        setWeeklyStats((statsResult.data as DbWeeklyStatsRow[] | null) || [])
        setDeadlineStats(deadlineResult.data)
        setMessage(deadlineResult.error ? { type: 'info', text: deadlineResult.error } : null)
        setLoadingData(false)
    }, [selectedWeekKey, supabase])

    useEffect(() => {
        if (!userLoading && !user) {
            router.push('/login')
        }
        if (!userLoading && user && !canAccessBenchmark) {
            router.push(canAccessFeature('dashboard') ? '/dashboard' : '/login')
        }
    }, [canAccessBenchmark, canAccessFeature, router, user, userLoading])

    useEffect(() => {
        if (!user) return
        const timeoutId = window.setTimeout(() => {
            void loadDashboardData()
        }, 0)

        return () => window.clearTimeout(timeoutId)
    }, [loadDashboardData, user])

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (weekPickerRef.current && !weekPickerRef.current.contains(event.target as Node)) {
                setShowWeekPicker(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const appMetrics = useMemo(() => {
        const visibleAppMap = new Map(benchmarkApps.map(app => [app.id, app]))
        const entryCounts = new Map<string, { ideaCount: number; funnelOneCount: number; winCount: number }>()
        const statsMap = new Map<string, DbWeeklyStatsRow>()

        for (const row of weeklyStats) {
            statsMap.set(row.app_id, row)
        }

        for (const entry of entries) {
            const current = entryCounts.get(entry.app_id) || { ideaCount: 0, funnelOneCount: 0, winCount: 0 }
            current.ideaCount += 1
            if (entry.passed) current.funnelOneCount += 1
            if (entry.win) current.winCount += 1
            entryCounts.set(entry.app_id, current)
        }

        const relevantAppIds = new Set<string>()
        benchmarkApps.forEach(app => relevantAppIds.add(app.id))
        entryCounts.forEach((value, appId) => {
            if (value.ideaCount > 0 || value.funnelOneCount > 0 || value.winCount > 0) {
                relevantAppIds.add(appId)
            }
        })
        statsMap.forEach((value, appId) => {
            if ((value.videos_created || 0) > 0) {
                relevantAppIds.add(appId)
            }
        })

        return Array.from(relevantAppIds)
            .filter(appId => !hiddenAppIds.includes(appId))
            .map(appId => {
                const app = visibleAppMap.get(appId) || createFallbackApp(appId)
                const counts = entryCounts.get(appId) || { ideaCount: 0, funnelOneCount: 0, winCount: 0 }
                const stats = statsMap.get(appId)
                const videosCreated = stats?.videos_created || 0
                const funnelOneRate = videosCreated > 0 ? Math.round((counts.funnelOneCount / videosCreated) * 100) : 0
                const winRate = counts.funnelOneCount > 0 ? Math.round((counts.winCount / counts.funnelOneCount) * 100) : 0

                return {
                    app,
                    ideaCount: counts.ideaCount,
                    videosCreated,
                    funnelOneCount: counts.funnelOneCount,
                    winCount: counts.winCount,
                    funnelOneRate,
                    winRate,
                    benchmarkMarket: stats?.benchmark_market || DEFAULT_BENCHMARK_MARKET,
                    benchmarkCtr: stats?.benchmark_ctr ?? null,
                    benchmarkCvr: stats?.benchmark_cvr ?? null,
                    benchmarkCpi: stats?.benchmark_cpi ?? null,
                    benchmarkCpm: stats?.benchmark_cpm ?? null,
                    hasSavedData: Boolean(
                        stats
                        || counts.ideaCount > 0
                        || videosCreated > 0
                        || counts.funnelOneCount > 0
                        || counts.winCount > 0
                    ),
                } satisfies AppSignalMetric
            })
            .filter(item => item.hasSavedData)
            .sort((left, right) =>
                right.funnelOneRate - left.funnelOneRate
                || right.winRate - left.winRate
                || right.funnelOneCount - left.funnelOneCount
                || right.videosCreated - left.videosCreated
                || left.app.name.localeCompare(right.app.name)
            )
    }, [benchmarkApps, entries, hiddenAppIds, weeklyStats])

    const topFunnelApps = useMemo(() => {
        return [...appMetrics]
            .filter(item => item.videosCreated > 0 || item.funnelOneCount > 0)
            .sort((left, right) =>
                right.funnelOneRate - left.funnelOneRate
                || right.funnelOneCount - left.funnelOneCount
                || right.videosCreated - left.videosCreated
                || left.app.name.localeCompare(right.app.name)
            )
            .slice(0, 6)
    }, [appMetrics])

    const topWinApps = useMemo(() => {
        return [...appMetrics]
            .filter(item => item.funnelOneCount > 0)
            .sort((left, right) =>
                right.winRate - left.winRate
                || right.winCount - left.winCount
                || right.funnelOneCount - left.funnelOneCount
                || left.app.name.localeCompare(right.app.name)
            )
            .slice(0, 6)
    }, [appMetrics])

    const funnelChartData = useMemo(() => {
        return [...appMetrics]
            .filter(item => item.videosCreated > 0 || item.funnelOneCount > 0)
            .sort((left, right) =>
                right.funnelOneRate - left.funnelOneRate
                || right.funnelOneCount - left.funnelOneCount
                || left.app.name.localeCompare(right.app.name)
            )
            .slice(0, 8)
            .map(item => ({
                appName: item.app.name,
                label: getShortAppLabel(item.app.name),
                rate: item.funnelOneRate,
                numerator: item.funnelOneCount,
                denominator: item.videosCreated || 0,
                fill: '#22d3ee',
            }))
    }, [appMetrics])

    const winChartData = useMemo(() => {
        return [...appMetrics]
            .filter(item => item.funnelOneCount > 0)
            .sort((left, right) =>
                right.winRate - left.winRate
                || right.winCount - left.winCount
                || left.app.name.localeCompare(right.app.name)
            )
            .slice(0, 8)
            .map(item => ({
                appName: item.app.name,
                label: getShortAppLabel(item.app.name),
                rate: item.winRate,
                numerator: item.winCount,
                denominator: item.funnelOneCount || 0,
                fill: '#f59e0b',
            }))
    }, [appMetrics])

    const totals = useMemo(() => {
        return appMetrics.reduce((result, item) => {
            result.ideaCount += item.ideaCount
            result.videosCreated += item.videosCreated
            result.funnelOneCount += item.funnelOneCount
            result.winCount += item.winCount
            return result
        }, {
            ideaCount: 0,
            videosCreated: 0,
            funnelOneCount: 0,
            winCount: 0,
        })
    }, [appMetrics])

    const activeAppCount = appMetrics.filter(item => item.ideaCount > 0 || item.videosCreated > 0).length
    const overallFunnelRate = totals.videosCreated > 0
        ? Math.round((totals.funnelOneCount / totals.videosCreated) * 100)
        : 0
    const overallWinRate = totals.funnelOneCount > 0
        ? Math.round((totals.winCount / totals.funnelOneCount) * 100)
        : 0
    const maxIdeaCount = Math.max(1, ...appMetrics.map(item => item.ideaCount))
    const deadlineRate = deadlineStats && deadlineStats.totalIdeaCreators > 0
        ? Math.round((deadlineStats.onTimeCount / deadlineStats.totalIdeaCreators) * 100)
        : 0
    const deadlineValue = deadlineStats
        ? `${deadlineStats.onTimeCount}/${deadlineStats.totalIdeaCreators} (${deadlineRate}%)`
        : '--'
    const deadlineHint = deadlineStats
        ? `Idea Creator luu truoc 23:59 thu 2. Tre: ${deadlineStats.lateCount}, chua nhap: ${deadlineStats.pendingCount}.`
        : 'Chua tai duoc ti le deadline thu 2.'

    if (userLoading || !user || !canAccessBenchmark) {
        return (
            <DashboardLayout hideAgent>
                <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                    <div className="h-10 w-10 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-slate-950 px-6 py-6 text-white">
                <div className="mx-auto max-w-[1500px] space-y-6">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/25 bg-cyan-500/10">
                                <TrendingUp className="h-5 w-5 text-cyan-200" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold">Creative Signal Dashboard</h1>
                                <p className="text-sm text-slate-400">
                                    {format(selectedWeekStart, 'dd/MM')} - {format(selectedWeekEnd, 'dd/MM/yyyy')} • cùng timeline với Benchmark Creative
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative" ref={weekPickerRef}>
                                <button
                                    onClick={() => setShowWeekPicker(prev => !prev)}
                                    className="flex h-10 items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 transition-colors hover:bg-slate-700/80"
                                >
                                    <Calendar className="h-4 w-4 text-cyan-200" />
                                    <span className="text-sm font-semibold">
                                        {isSameDay(selectedWeekStart, currentWeekStart)
                                            ? 'Tuần này'
                                            : `${format(selectedWeekStart, 'dd/MM')} - ${format(selectedWeekEnd, 'dd/MM')}`}
                                    </span>
                                    <ChevronDown className="h-4 w-4 text-slate-400" />
                                </button>

                                {showWeekPicker && (
                                    <div className="absolute right-0 top-full z-[200] mt-2 w-[430px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-700 bg-slate-800/95 shadow-2xl backdrop-blur-xl">
                                        <div className="grid min-h-[340px] grid-cols-[1fr_1.1fr]">
                                            <div className="max-h-[430px] overflow-y-auto border-r border-slate-700/80 p-3">
                                                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                                    Timeline
                                                </p>
                                                {Object.entries(weeksByMonth).map(([key, monthWeeks]) => (
                                                    <div key={key} className="mb-4">
                                                        <p className="mb-1 px-2 text-xs font-bold text-cyan-200">
                                                            {MONTH_NAMES[monthWeeks[0].month]} / {monthWeeks[0].year}
                                                        </p>
                                                        <div className="space-y-0.5">
                                                            {monthWeeks.map(week => {
                                                                const active = isSameDay(selectedWeekStart, week.start)
                                                                return (
                                                                    <button
                                                                        key={week.index}
                                                                        onClick={() => {
                                                                            setSelectedWeekStart(week.start)
                                                                            setShowWeekPicker(false)
                                                                        }}
                                                                        className={`w-full rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${active
                                                                            ? 'bg-cyan-500/25 text-cyan-100'
                                                                            : 'text-slate-300 hover:bg-slate-700/80'
                                                                            }`}
                                                                    >
                                                                        Tuần {week.index}: {format(week.start, 'dd')} - {format(week.end, 'dd/MM')}
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="p-3">
                                                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                                    Chọn nhanh
                                                </p>
                                                <div className="space-y-1">
                                                    {QUICK_WEEKS.map(quick => {
                                                        const weekStart = addWeeks(currentWeekStart, quick.offset)
                                                        if (weekStart.getTime() > lastTimelineWeekStart.getTime()) {
                                                            return null
                                                        }
                                                        const active = isSameDay(selectedWeekStart, weekStart)
                                                        return (
                                                            <button
                                                                key={quick.key}
                                                                onClick={() => {
                                                                    setSelectedWeekStart(weekStart)
                                                                    setShowWeekPicker(false)
                                                                }}
                                                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${active
                                                                    ? 'bg-cyan-500/25 text-cyan-100'
                                                                    : 'text-slate-300 hover:bg-slate-700/80'
                                                                    }`}
                                                            >
                                                                <span>{quick.label}</span>
                                                                {active && <Check className="h-4 w-4" />}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                                <div className="mt-4 border-t border-slate-700 pt-4">
                                                    <button
                                                        onClick={() => {
                                                            if (canGoToPreviousWeek) {
                                                                setSelectedWeekStart(addDays(selectedWeekStart, -7))
                                                            }
                                                        }}
                                                        disabled={!canGoToPreviousWeek}
                                                        className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${canGoToPreviousWeek
                                                            ? 'bg-slate-700/60 text-slate-200 hover:bg-slate-700'
                                                            : 'cursor-not-allowed bg-slate-800/60 text-slate-500'
                                                            }`}
                                                    >
                                                        <ChevronLeft className="h-4 w-4" />
                                                        Tuần trước
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (canGoToNextWeek) {
                                                                setSelectedWeekStart(addDays(selectedWeekStart, 7))
                                                            }
                                                        }}
                                                        disabled={!canGoToNextWeek}
                                                        className={`mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${canGoToNextWeek
                                                            ? 'bg-slate-700/60 text-slate-200 hover:bg-slate-700'
                                                            : 'cursor-not-allowed bg-slate-800/60 text-slate-500'
                                                            }`}
                                                    >
                                                        Tuần sau
                                                        <ChevronRight className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Link
                                href="/creative-benchmark"
                                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-700/80"
                            >
                                Vào benchmark
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>

                    {message && (
                        <div className={`rounded-2xl border px-4 py-3 text-sm ${message.type === 'error'
                            ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                            : 'border-slate-700 bg-slate-900/70 text-slate-300'
                            }`}>
                            {message.text}
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                        <KpiCard
                            label="App đang làm"
                            value={`${activeAppCount}/${benchmarkApps.length}`}
                            hint="Số app đang có idea hoặc video trong tuần đang chọn"
                            accentClass="bg-cyan-500/10 text-cyan-200"
                        />
                        <KpiCard
                            label="Idea trong tuần"
                            value={String(totals.ideaCount)}
                            hint={`${totals.videosCreated} video tạo trong tuần này`}
                            accentClass="bg-violet-500/10 text-violet-200"
                        />
                        <KpiCard
                            label="Tỉ lệ phễu 1"
                            value={`${overallFunnelRate}%`}
                            hint={`${totals.funnelOneCount}/${totals.videosCreated} video qua phễu 1`}
                            accentClass="bg-emerald-500/10 text-emerald-200"
                        />
                        <KpiCard
                            label="Tỉ lệ win"
                            value={`${overallWinRate}%`}
                            hint={`${totals.winCount}/${totals.funnelOneCount} win trong tuần này`}
                            accentClass="bg-amber-500/10 text-amber-100"
                        />
                        <KpiCard
                            label="Dung deadline T2"
                            value={deadlineValue}
                            hint={deadlineHint}
                            accentClass="bg-sky-500/10 text-sky-200"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                        <SignalBarChart
                            title="Biểu đồ phễu 1"
                            caption="So sánh nhanh % video qua phễu 1 giữa các app đang có data."
                            data={funnelChartData}
                            emptyText="Chưa có app nào đủ dữ liệu để vẽ biểu đồ phễu 1."
                        />
                        <SignalBarChart
                            title="Biểu đồ win"
                            caption="So sánh nhanh % win trên số video đã qua phễu 1 của từng app."
                            data={winChartData}
                            emptyText="Chưa có app nào đủ dữ liệu để vẽ biểu đồ win."
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                        <RankingPanel
                            title="Tín hiệu phễu 1 tốt"
                            caption="Xếp hạng theo % video qua phễu 1 trên tổng video tạo của từng app."
                            icon={Flame}
                            items={topFunnelApps}
                            type="funnel"
                        />
                        <RankingPanel
                            title="App đang có tỉ lệ win"
                            caption="Xếp hạng theo % win trên số video đã qua phễu 1."
                            icon={Trophy}
                            items={topWinApps}
                            type="win"
                        />
                    </div>

                    <section className="overflow-hidden rounded-[30px] border border-slate-800 bg-slate-900/75 shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
                        <div className="flex flex-col gap-3 border-b border-slate-800 px-5 py-5 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                                <div className="inline-flex items-center gap-2 rounded-2xl border border-purple-500/25 bg-purple-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-purple-200">
                                    <BarChart3 className="h-3.5 w-3.5" />
                                    Toàn cảnh app
                                </div>
                                <h2 className="mt-3 text-xl font-semibold text-white">Bảng tổng hợp theo app</h2>
                                <p className="mt-1 text-sm text-slate-400">
                                    Dashboard chỉ đọc dữ liệu benchmark đã lưu của tuần {format(selectedWeekStart, 'dd/MM')} - {format(selectedWeekEnd, 'dd/MM/yyyy')}.
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                                {loadingData ? 'Đang tải dữ liệu...' : `${appMetrics.length} app đang có số liệu trong tuần này`}
                            </div>
                        </div>

                        {loadingData ? (
                            <div className="flex min-h-[280px] items-center justify-center bg-slate-950/30">
                                <div className="h-10 w-10 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin" />
                            </div>
                        ) : appMetrics.length === 0 ? (
                            <div className="px-5 py-16 text-center">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-slate-800 bg-slate-950/80">
                                    <Calendar className="h-7 w-7 text-slate-500" />
                                </div>
                                <h3 className="mt-4 text-lg font-semibold text-white">Tuần này chưa có app nào có dữ liệu</h3>
                                <p className="mt-2 text-sm text-slate-400">
                                    Bạn có thể nhập benchmark ở màn Creative Benchmark rồi quay lại đây để xem tổng hợp.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-[1320px] w-full">
                                    <thead className="bg-slate-950/70">
                                        <tr>
                                            <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">App</th>
                                            <th className="px-3 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400 w-[21%]">Idea tuần</th>
                                            <th className="px-3 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Video tạo</th>
                                            <th className="px-3 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Qua phễu 1</th>
                                            <th className="px-3 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">% phễu 1</th>
                                            <th className="px-3 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">Win</th>
                                            <th className="px-3 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400">% win</th>
                                            <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-400">Benchmark đang dùng</th>
                                            <th className="px-5 py-4 w-28" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {appMetrics.map(item => (
                                            <tr key={item.app.id} className="bg-slate-900/40 transition-colors hover:bg-slate-900/80">
                                                <td className="px-5 py-4">
                                                    <AppIdentity app={item.app} />
                                                </td>
                                                <td className="px-3 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-8 text-right text-sm font-bold text-white">{item.ideaCount}</span>
                                                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                                                            <div
                                                                className="h-full rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400"
                                                                style={{ width: `${Math.min(Math.round((item.ideaCount / maxIdeaCount) * 100), 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 text-right">
                                                    <div className="text-lg font-bold text-white">{item.videosCreated}</div>
                                                    <div className="text-xs text-slate-500">video</div>
                                                </td>
                                                <td className="px-3 py-4 text-right">
                                                    <div className="text-lg font-bold text-white">{item.funnelOneCount}</div>
                                                    <div className="text-xs text-slate-500">{item.funnelOneCount}/{item.videosCreated || 0}</div>
                                                </td>
                                                <td className="px-3 py-4 text-right">
                                                    <div className="text-lg font-bold text-cyan-200">{item.funnelOneRate}%</div>
                                                    <div className="mt-2 ml-auto h-2 w-24 overflow-hidden rounded-full bg-slate-800">
                                                        <div
                                                            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400"
                                                            style={{ width: `${Math.min(item.funnelOneRate, 100)}%` }}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-3 py-4 text-right">
                                                    <div className="text-lg font-bold text-white">{item.winCount}</div>
                                                    <div className="text-xs text-slate-500">{item.winCount}/{item.funnelOneCount || 0}</div>
                                                </td>
                                                <td className="px-3 py-4 text-right">
                                                    <div className="text-lg font-bold text-amber-100">{item.winRate}%</div>
                                                    <div className="mt-2 ml-auto h-2 w-24 overflow-hidden rounded-full bg-slate-800">
                                                        <div
                                                            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400"
                                                            style={{ width: `${Math.min(item.winRate, 100)}%` }}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3">
                                                        <div className="text-sm font-semibold text-white">{item.benchmarkMarket}</div>
                                                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
                                                            <span>CTR {formatMetricValue(item.benchmarkCtr)}%</span>
                                                            <span>CVR {formatMetricValue(item.benchmarkCvr)}%</span>
                                                            <span>CPI ${formatMetricValue(item.benchmarkCpi)}</span>
                                                            <span>CPM ${formatMetricValue(item.benchmarkCpm)}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <Link
                                                        href={`/creative-benchmark?appId=${encodeURIComponent(item.app.id)}&weekStart=${encodeURIComponent(selectedWeekKey)}`}
                                                        className="inline-flex h-9 items-center rounded-lg border border-slate-700 bg-slate-800 px-3 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
                                                    >
                                                        Chi tiết
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </DashboardLayout>
    )
}
