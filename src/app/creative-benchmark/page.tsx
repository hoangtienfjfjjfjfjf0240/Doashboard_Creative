'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    addDays,
    addWeeks,
    format,
    isSameDay,
    startOfWeek,
    subDays,
} from 'date-fns'
import {
    Apple,
    BarChart3,
    Calendar,
    Cast,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    HeartPulse,
    Home,
    ExternalLink,
    Link2,
    Plus,
    QrCode,
    RefreshCw,
    Save,
    Search,
    ShieldCheck,
    Trash2,
    X,
    type LucideIcon,
} from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import { useUser } from '@/contexts/UserContext'
import { createClient } from '@/lib/supabase/client'

type StorageMode = 'checking' | 'database' | 'local'

type BenchmarkApp = {
    id: string
    name: string
    category: string
    meta: string
    icon?: LucideIcon
    iconUrl?: string
    accent: string
    storeUrl?: string
    playUrl?: string
    source?: 'app-store' | 'google-play' | 'manual'
    externalId?: string
    isCustom?: boolean
}

type BenchmarkRow = {
    id: string
    ideaName: string
    market: string
    ctr: string
    cvr: string
    cpi: string
    cpm: string
    passed: boolean
}

type DbBenchmarkEntry = {
    id: string
    app_id: string
    week_start_date: string
    idea_name: string | null
    market: string | null
    ctr: number | null
    cvr: number | null
    cpi: number | null
    cpm: number | null
    passed: boolean | null
    sort_order: number | null
}

type WeeklyStats = {
    videosCreated: string
    funnelOneCount: string
    winCount: string
}

type DbWeeklyStats = {
    videos_created: number | null
    funnel_one_count: number | null
    win_count: number | null
}

type DetectedApp = {
    name: string
    iconUrl?: string
    storeUrl?: string
    playUrl?: string
    source: 'app-store' | 'google-play' | 'manual'
    externalId?: string
}

const BENCHMARK_APPS: BenchmarkApp[] = [
    {
        id: 'onesearch',
        name: 'OneSearch - Tìm kiếm & Trợ lý ảo',
        category: 'Tiện ích',
        meta: '46 tính năng',
        icon: Search,
        accent: 'from-slate-700 to-black',
    },
    {
        id: 'cast-tv',
        name: 'Cast TV: Chromecast, Screencast',
        category: 'Tiện ích',
        meta: '56 tính năng',
        icon: Cast,
        accent: 'from-blue-500 to-amber-400',
    },
    {
        id: 'authenticator',
        name: 'Authenticator App',
        category: 'Tiện ích',
        meta: '63 tính năng',
        icon: ShieldCheck,
        accent: 'from-sky-400 to-blue-700',
    },
    {
        id: 'ikcal-103',
        name: 'ikcal AI Calorie Counter',
        category: 'Sức khỏe & Thể hình',
        meta: '103 tính năng',
        icon: Apple,
        accent: 'from-zinc-800 to-black',
    },
    {
        id: 'icardiac',
        name: 'iCardiac: Heart Health Monitor',
        category: 'Sức khỏe & Thể hình',
        meta: '100 tính năng',
        icon: HeartPulse,
        accent: 'from-rose-400 to-red-600',
    },
    {
        id: 'ai-home',
        name: 'AI Home Design & Interior Decor',
        category: 'Tiện ích',
        meta: '88 tính năng',
        icon: Home,
        accent: 'from-amber-300 to-stone-600',
    },
    {
        id: 'ikcal-86',
        name: 'ikcal AI Calorie Counter',
        category: 'Sức khỏe & Thể hình',
        meta: '86 tính năng',
        icon: Apple,
        accent: 'from-zinc-800 to-black',
    },
    {
        id: 'qr-reader',
        name: 'QR Code Reader - Scan Barcode',
        category: 'Tiện ích',
        meta: '41 tính năng',
        icon: QrCode,
        accent: 'from-sky-400 to-blue-600',
    },
    {
        id: 'phone-cleaner',
        name: 'Phone Cleaner - Clean Storage',
        category: 'Tiện ích',
        meta: '61 tính năng',
        icon: Trash2,
        accent: 'from-indigo-400 to-blue-700',
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
    { key: 'last-week', label: 'Tuần trước', offset: -1 },
    { key: 'next-week', label: 'Tuần sau', offset: 1 },
]

function toDateKey(date: Date) {
    return format(date, 'yyyy-MM-dd')
}

function makeRow(overrides: Partial<BenchmarkRow> = {}): BenchmarkRow {
    return {
        id: crypto.randomUUID(),
        ideaName: '',
        market: '',
        ctr: '',
        cvr: '',
        cpi: '',
        cpm: '',
        passed: false,
        ...overrides,
    }
}

function makeBlankRows(count = 6): BenchmarkRow[] {
    return Array.from({ length: count }, () => makeRow())
}

function formatMetric(value: number | null) {
    if (value === null || value === undefined) return ''
    return Number.isInteger(value) ? String(value) : String(value)
}

function parseMetric(value: string) {
    const normalized = value.replace(/[$,%\s]/g, '').replace(',', '.')
    if (!normalized) return null
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
}

function hasRowContent(row: BenchmarkRow) {
    return Boolean(
        row.ideaName.trim() ||
        row.market.trim() ||
        row.ctr.trim() ||
        row.cvr.trim() ||
        row.cpi.trim() ||
        row.cpm.trim() ||
        row.passed
    )
}

function getStorageKey(appId: string, weekStart: string) {
    return `creative-benchmark:${appId}:${weekStart}`
}

function getStatsStorageKey(appId: string, weekStart: string) {
    return `creative-benchmark-stats:${appId}:${weekStart}`
}

function getAppsStorageKey() {
    return 'creative-benchmark:custom-apps'
}

function makeBlankStats(): WeeklyStats {
    return {
        videosCreated: '',
        funnelOneCount: '',
        winCount: '',
    }
}

function toNumber(value: string) {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function makeAppId(name: string, source?: string, externalId?: string) {
    const base = externalId || name
    return `${source || 'manual'}-${base}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
}

function generateTimelineWeeks() {
    const firstMonday = new Date(2026, 1, 2)
    return Array.from({ length: 24 }, (_, index) => {
        const start = startOfWeek(addWeeks(firstMonday, index), { weekStartsOn: 1 })
        const end = addDays(start, 4)
        return {
            index: index + 1,
            start,
            end,
            month: start.getMonth(),
            year: start.getFullYear(),
        }
    })
}

function groupWeeksByMonth(weeks: ReturnType<typeof generateTimelineWeeks>) {
    return weeks.reduce<Record<string, typeof weeks>>((groups, week) => {
        const key = `${week.year}-${week.month}`
        if (!groups[key]) groups[key] = []
        groups[key].push(week)
        return groups
    }, {})
}

export default function CreativeBenchmarkPage() {
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])
    const { user, loading: userLoading } = useUser()
    const timelineWeeks = useMemo(() => generateTimelineWeeks(), [])
    const weeksByMonth = useMemo(() => groupWeeksByMonth(timelineWeeks), [timelineWeeks])
    const currentWeekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), [])

    const [selectedAppId, setSelectedAppId] = useState(BENCHMARK_APPS[0].id)
    const [customApps, setCustomApps] = useState<BenchmarkApp[]>([])
    const [selectedWeekStart, setSelectedWeekStart] = useState(currentWeekStart)
    const [showWeekPicker, setShowWeekPicker] = useState(false)
    const [showAddApp, setShowAddApp] = useState(false)
    const [appLink, setAppLink] = useState('')
    const [appCategory, setAppCategory] = useState('Tiện ích')
    const [appMeta, setAppMeta] = useState('App mới')
    const [detectedApp, setDetectedApp] = useState<DetectedApp | null>(null)
    const [detectingApp, setDetectingApp] = useState(false)
    const [rows, setRows] = useState<BenchmarkRow[]>(() => makeBlankRows())
    const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>(() => makeBlankStats())
    const [storageMode, setStorageMode] = useState<StorageMode>('checking')
    const [loadingRows, setLoadingRows] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const weekPickerRef = useRef<HTMLDivElement>(null)

    const benchmarkApps = useMemo(() => [...BENCHMARK_APPS, ...customApps], [customApps])
    const selectedApp = benchmarkApps.find(app => app.id === selectedAppId) || benchmarkApps[0]
    const selectedWeekKey = toDateKey(selectedWeekStart)
    const selectedWeekEnd = addDays(selectedWeekStart, 4)
    const filledRows = rows.filter(row => row.ideaName.trim())
    const passedCount = filledRows.filter(row => row.passed).length
    const videosCreated = toNumber(weeklyStats.videosCreated) || filledRows.length
    const funnelOneCount = toNumber(weeklyStats.funnelOneCount)
    const winCount = toNumber(weeklyStats.winCount)
    const benchmarkRate = videosCreated > 0 ? Math.round((passedCount / videosCreated) * 100) : 0
    const funnelOneRate = videosCreated > 0 ? Math.round((funnelOneCount / videosCreated) * 100) : 0
    const winRate = funnelOneCount > 0 ? Math.round((winCount / funnelOneCount) * 100) : 0

    const loadLocalRows = useCallback((appId: string, weekStartKey: string) => {
        try {
            const raw = localStorage.getItem(getStorageKey(appId, weekStartKey))
            if (!raw) return makeBlankRows()
            const parsed = JSON.parse(raw) as BenchmarkRow[]
            return parsed.length > 0 ? parsed.map(row => makeRow(row)) : makeBlankRows()
        } catch {
            return makeBlankRows()
        }
    }, [])

    const loadLocalStats = useCallback((appId: string, weekStartKey: string) => {
        try {
            const raw = localStorage.getItem(getStatsStorageKey(appId, weekStartKey))
            if (!raw) return makeBlankStats()
            return { ...makeBlankStats(), ...(JSON.parse(raw) as Partial<WeeklyStats>) }
        } catch {
            return makeBlankStats()
        }
    }, [])

    const saveLocalRows = useCallback((appId: string, weekStartKey: string, nextRows: BenchmarkRow[]) => {
        localStorage.setItem(
            getStorageKey(appId, weekStartKey),
            JSON.stringify(nextRows.filter(hasRowContent))
        )
    }, [])

    const saveLocalStats = useCallback((appId: string, weekStartKey: string, nextStats: WeeklyStats) => {
        localStorage.setItem(getStatsStorageKey(appId, weekStartKey), JSON.stringify(nextStats))
    }, [])

    const loadCustomApps = useCallback(() => {
        try {
            const raw = localStorage.getItem(getAppsStorageKey())
            if (!raw) return []
            return JSON.parse(raw) as BenchmarkApp[]
        } catch {
            return []
        }
    }, [])

    const saveCustomApps = useCallback((apps: BenchmarkApp[]) => {
        localStorage.setItem(getAppsStorageKey(), JSON.stringify(apps))
    }, [])

    const loadRows = useCallback(async (appId: string, weekStartKey: string) => {
        setLoadingRows(true)
        setMessage(null)

        if (storageMode === 'local') {
            setRows(loadLocalRows(appId, weekStartKey))
            setWeeklyStats(loadLocalStats(appId, weekStartKey))
            setLoadingRows(false)
            return
        }

        const [{ data, error }, statsResult] = await Promise.all([
            supabase
            .from('creative_benchmark_entries')
            .select('id, app_id, week_start_date, idea_name, market, ctr, cvr, cpi, cpm, passed, sort_order')
            .eq('app_id', appId)
            .eq('week_start_date', weekStartKey)
            .order('sort_order', { ascending: true }),
            supabase
                .from('creative_benchmark_weekly_stats')
                .select('videos_created, funnel_one_count, win_count')
                .eq('app_id', appId)
                .eq('week_start_date', weekStartKey)
                .maybeSingle(),
        ])

        if (error || statsResult.error) {
            setStorageMode('local')
            setRows(loadLocalRows(appId, weekStartKey))
            setWeeklyStats(loadLocalStats(appId, weekStartKey))
            setLoadingRows(false)
            return
        }

        setStorageMode('database')
        const dbRows = (data as DbBenchmarkEntry[] | null || []).map(entry =>
            makeRow({
                id: entry.id,
                ideaName: entry.idea_name || '',
                market: entry.market || '',
                ctr: formatMetric(entry.ctr),
                cvr: formatMetric(entry.cvr),
                cpi: formatMetric(entry.cpi),
                cpm: formatMetric(entry.cpm),
                passed: Boolean(entry.passed),
            })
        )
        setRows(dbRows.length > 0 ? dbRows : makeBlankRows())
        const dbStats = statsResult.data as DbWeeklyStats | null
        setWeeklyStats(dbStats ? {
            videosCreated: dbStats.videos_created ? String(dbStats.videos_created) : '',
            funnelOneCount: dbStats.funnel_one_count ? String(dbStats.funnel_one_count) : '',
            winCount: dbStats.win_count ? String(dbStats.win_count) : '',
        } : makeBlankStats())
        setLoadingRows(false)
    }, [loadLocalRows, loadLocalStats, storageMode, supabase])

    useEffect(() => {
        if (!userLoading && !user) {
            router.push('/login')
        }
    }, [router, user, userLoading])

    useEffect(() => {
        setCustomApps(loadCustomApps())
    }, [loadCustomApps])

    useEffect(() => {
        loadRows(selectedAppId, selectedWeekKey)
    }, [loadRows, selectedAppId, selectedWeekKey])

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (weekPickerRef.current && !weekPickerRef.current.contains(event.target as Node)) {
                setShowWeekPicker(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const updateRow = (id: string, field: keyof BenchmarkRow, value: string | boolean) => {
        setRows(prev => prev.map(row => (row.id === id ? { ...row, [field]: value } : row)))
    }

    const addRow = () => {
        setRows(prev => [...prev, makeRow()])
    }

    const removeRow = (id: string) => {
        setRows(prev => {
            const next = prev.filter(row => row.id !== id)
            return next.length > 0 ? next : makeBlankRows(1)
        })
    }

    const saveRows = async () => {
        const rowsToSave = rows.filter(hasRowContent)
        setSaving(true)
        setMessage(null)

        if (storageMode === 'local') {
            saveLocalRows(selectedAppId, selectedWeekKey, rowsToSave)
            saveLocalStats(selectedAppId, selectedWeekKey, weeklyStats)
            setMessage({ type: 'success', text: 'Đã lưu benchmark' })
            setSaving(false)
            return
        }

        const { error: deleteError } = await supabase
            .from('creative_benchmark_entries')
            .delete()
            .eq('app_id', selectedAppId)
            .eq('week_start_date', selectedWeekKey)

        const { error: statsDeleteError } = await supabase
            .from('creative_benchmark_weekly_stats')
            .delete()
            .eq('app_id', selectedAppId)
            .eq('week_start_date', selectedWeekKey)

        if (deleteError || statsDeleteError) {
            setStorageMode('local')
            saveLocalRows(selectedAppId, selectedWeekKey, rowsToSave)
            saveLocalStats(selectedAppId, selectedWeekKey, weeklyStats)
            setMessage({ type: 'success', text: 'Đã lưu benchmark' })
            setSaving(false)
            return
        }

        if (rowsToSave.length > 0) {
            const payload = rowsToSave.map((row, index) => ({
                app_id: selectedAppId,
                week_start_date: selectedWeekKey,
                idea_name: row.ideaName.trim(),
                market: row.market.trim(),
                ctr: parseMetric(row.ctr),
                cvr: parseMetric(row.cvr),
                cpi: parseMetric(row.cpi),
                cpm: parseMetric(row.cpm),
                passed: row.passed,
                sort_order: index,
            }))

            const { error: insertError } = await supabase
                .from('creative_benchmark_entries')
                .insert(payload)

            if (insertError) {
                setStorageMode('local')
                saveLocalRows(selectedAppId, selectedWeekKey, rowsToSave)
                saveLocalStats(selectedAppId, selectedWeekKey, weeklyStats)
                setMessage({ type: 'success', text: 'Đã lưu benchmark' })
                setSaving(false)
                return
            }
        }

        const { error: statsInsertError } = await supabase
            .from('creative_benchmark_weekly_stats')
            .insert({
                app_id: selectedAppId,
                week_start_date: selectedWeekKey,
                videos_created: toNumber(weeklyStats.videosCreated),
                funnel_one_count: toNumber(weeklyStats.funnelOneCount),
                win_count: toNumber(weeklyStats.winCount),
            })

        if (statsInsertError) {
            setStorageMode('local')
            saveLocalRows(selectedAppId, selectedWeekKey, rowsToSave)
            saveLocalStats(selectedAppId, selectedWeekKey, weeklyStats)
            setMessage({ type: 'success', text: 'Đã lưu benchmark' })
            setSaving(false)
            return
        }

        setMessage({ type: 'success', text: 'Đã lưu benchmark' })
        setSaving(false)
    }

    const copyPreviousWeek = async () => {
        const previousWeekKey = toDateKey(subDays(selectedWeekStart, 7))
        if (storageMode === 'local') {
            const previousRows = loadLocalRows(selectedAppId, previousWeekKey).filter(hasRowContent)
            if (previousRows.length === 0) {
                setMessage({ type: 'error', text: 'Tuần trước chưa có benchmark' })
                return
            }
            setRows(previousRows.map(row => makeRow({ ...row, passed: false })))
            setMessage({ type: 'success', text: 'Đã copy từ tuần trước' })
            return
        }

        const { data, error } = await supabase
            .from('creative_benchmark_entries')
            .select('idea_name, market, ctr, cvr, cpi, cpm, passed, sort_order')
            .eq('app_id', selectedAppId)
            .eq('week_start_date', previousWeekKey)
            .order('sort_order', { ascending: true })

        if (error) {
            setMessage({ type: 'error', text: 'Không copy được tuần trước' })
            return
        }

        const previousRows = (data as Omit<DbBenchmarkEntry, 'id' | 'app_id' | 'week_start_date'>[] | null || [])
        if (previousRows.length === 0) {
            setMessage({ type: 'error', text: 'Tuần trước chưa có benchmark' })
            return
        }

        setRows(previousRows.map(row =>
            makeRow({
                ideaName: row.idea_name || '',
                market: row.market || '',
                ctr: formatMetric(row.ctr),
                cvr: formatMetric(row.cvr),
                cpi: formatMetric(row.cpi),
                cpm: formatMetric(row.cpm),
                passed: false,
            })
        ))
        setMessage({ type: 'success', text: 'Đã copy từ tuần trước' })
    }

    const updateWeeklyStat = (field: keyof WeeklyStats, value: string) => {
        const cleaned = value.replace(/[^0-9]/g, '')
        setWeeklyStats(prev => {
            const next = { ...prev, [field]: cleaned }
            saveLocalStats(selectedAppId, selectedWeekKey, next)
            return next
        })
    }

    const detectAppFromLink = async () => {
        const url = appLink.trim()
        if (!url) return
        setDetectingApp(true)
        setMessage(null)

        try {
            const response = await fetch(`/api/app-metadata?url=${encodeURIComponent(url)}`)
            const data = await response.json()
            if (!response.ok) {
                throw new Error(data?.error || 'Không nhận diện được app')
            }

            const app = data as DetectedApp
            setDetectedApp(app)
            setAppCategory('Tiện ích')
            setAppMeta(app.source === 'app-store' ? 'App Store' : app.source === 'google-play' ? 'Google Play' : 'App mới')
        } catch (error) {
            setMessage({
                type: 'error',
                text: error instanceof Error ? error.message : 'Không nhận diện được app',
            })
        } finally {
            setDetectingApp(false)
        }
    }

    const addDetectedApp = () => {
        if (!detectedApp) return
        const nextApp: BenchmarkApp = {
            id: makeAppId(detectedApp.name, detectedApp.source, detectedApp.externalId),
            name: detectedApp.name,
            category: appCategory.trim() || 'Tiện ích',
            meta: appMeta.trim() || 'App mới',
            iconUrl: detectedApp.iconUrl,
            accent: 'from-purple-500 to-blue-600',
            storeUrl: detectedApp.storeUrl,
            playUrl: detectedApp.playUrl,
            source: detectedApp.source,
            externalId: detectedApp.externalId,
            isCustom: true,
        }
        const nextApps = [
            ...customApps.filter(app => app.id !== nextApp.id),
            nextApp,
        ]
        setCustomApps(nextApps)
        saveCustomApps(nextApps)
        setSelectedAppId(nextApp.id)
        setShowAddApp(false)
        setDetectedApp(null)
        setAppLink('')
        setMessage({ type: 'success', text: 'Đã thêm app benchmark' })
    }

    if (userLoading || !user) {
        return (
            <DashboardLayout hideAgent>
                <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                    <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-slate-950 text-white p-6">
                <div className="max-w-[1500px] mx-auto space-y-5">
                    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                                    <BarChart3 className="w-5 h-5 text-purple-300" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold tracking-normal">Benchmark Creative</h1>
                                    <p className="text-sm text-slate-400">
                                        {format(selectedWeekStart, 'dd/MM')} - {format(selectedWeekEnd, 'dd/MM/yyyy')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative" ref={weekPickerRef}>
                                <button
                                    onClick={() => setShowWeekPicker(prev => !prev)}
                                    className="flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-800/80 border border-slate-700 hover:bg-slate-700/80 transition-colors"
                                >
                                    <Calendar className="w-4 h-4 text-purple-300" />
                                    <span className="text-sm font-semibold">
                                        {isSameDay(selectedWeekStart, currentWeekStart)
                                            ? 'Tuần này'
                                            : `${format(selectedWeekStart, 'dd/MM')} - ${format(selectedWeekEnd, 'dd/MM')}`}
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                </button>

                                {showWeekPicker && (
                                    <div className="absolute right-0 top-full mt-2 w-[430px] max-w-[calc(100vw-2rem)] bg-slate-800/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl z-[200] overflow-hidden">
                                        <div className="grid grid-cols-[1fr_1.1fr] min-h-[340px]">
                                            <div className="border-r border-slate-700/80 overflow-y-auto max-h-[430px] p-3">
                                                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold px-2 mb-2">
                                                    Timeline
                                                </p>
                                                {Object.entries(weeksByMonth).map(([key, monthWeeks]) => (
                                                    <div key={key} className="mb-4">
                                                        <p className="text-xs font-bold text-purple-300 px-2 mb-1">
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
                                                                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${active
                                                                            ? 'bg-purple-500/25 text-purple-200'
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
                                                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold px-2 mb-2">
                                                    Chọn nhanh
                                                </p>
                                                <div className="space-y-1">
                                                    {QUICK_WEEKS.map(quick => {
                                                        const weekStart = addWeeks(currentWeekStart, quick.offset)
                                                        const active = isSameDay(selectedWeekStart, weekStart)
                                                        return (
                                                            <button
                                                                key={quick.key}
                                                                onClick={() => {
                                                                    setSelectedWeekStart(weekStart)
                                                                    setShowWeekPicker(false)
                                                                }}
                                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${active
                                                                    ? 'bg-purple-500/25 text-purple-200'
                                                                    : 'text-slate-300 hover:bg-slate-700/80'
                                                                    }`}
                                                            >
                                                                <span>{quick.label}</span>
                                                                {active && <Check className="w-4 h-4" />}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                                <div className="mt-4 pt-4 border-t border-slate-700">
                                                    <button
                                                        onClick={() => setSelectedWeekStart(subDays(selectedWeekStart, 7))}
                                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-700/60 text-slate-200 hover:bg-slate-700 transition-colors text-sm"
                                                    >
                                                        <ChevronLeft className="w-4 h-4" />
                                                        Tuần trước
                                                    </button>
                                                    <button
                                                        onClick={() => setSelectedWeekStart(addDays(selectedWeekStart, 7))}
                                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-700/60 text-slate-200 hover:bg-slate-700 transition-colors text-sm mt-2"
                                                    >
                                                        Tuần sau
                                                        <ChevronRight className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={copyPreviousWeek}
                                className="h-10 px-4 rounded-xl bg-slate-800/80 border border-slate-700 text-sm font-semibold text-slate-200 hover:bg-slate-700/80 transition-colors"
                            >
                                Copy tuần trước
                            </button>

                            <button
                                onClick={saveRows}
                                disabled={saving}
                                className="h-10 px-4 rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold text-white transition-colors flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                {saving ? 'Đang lưu' : 'Lưu benchmark'}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                        <SummaryCard label="Video tạo theo tuần" value={videosCreated} tone="blue" />
                        <SummaryCard label="Video đạt benchmark" value={`${passedCount}/${videosCreated || 0} (${benchmarkRate}%)`} tone="green" />
                        <SummaryCard label="Tỉ lệ phễu 1" value={`${funnelOneRate}%`} tone="purple" />
                        <SummaryCard label="Tỉ lệ win" value={`${winRate}%`} tone="amber" />
                        <SummaryCard
                            label="Chế độ lưu"
                            value={storageMode === 'database' ? 'Supabase' : storageMode === 'checking' ? 'Đang kiểm tra' : 'Local'}
                            tone="amber"
                        />
                    </div>

                    {message && (
                        <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                            }`}>
                            {message.text}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
                        <section className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">App</h2>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500">{benchmarkApps.length} app</span>
                                    <button
                                        onClick={() => setShowAddApp(true)}
                                        className="h-8 px-3 rounded-lg bg-purple-500/15 border border-purple-500/30 text-xs font-bold text-purple-200 hover:bg-purple-500/25 transition-colors flex items-center gap-1.5"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Thêm app
                                    </button>
                                </div>
                            </div>
                            {showAddApp && (
                                <div className="rounded-xl border border-purple-500/30 bg-slate-900/95 p-4 shadow-lg shadow-purple-950/30">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div>
                                            <p className="text-sm font-bold text-white">Thêm app benchmark</p>
                                            <p className="text-xs text-slate-500 mt-0.5">Dán link App Store hoặc CH Play</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setShowAddApp(false)
                                                setDetectedApp(null)
                                            }}
                                            className="w-7 h-7 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 flex items-center justify-center"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            value={appLink}
                                            onChange={event => setAppLink(event.target.value)}
                                            placeholder="https://apps.apple.com/... hoặc https://play.google.com/store/apps/details?id=..."
                                            className="min-w-0 flex-1 h-10 rounded-lg bg-slate-950 border border-slate-700 px-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                        <button
                                            onClick={detectAppFromLink}
                                            disabled={detectingApp || !appLink.trim()}
                                            className="h-10 px-3 rounded-lg bg-slate-800 border border-slate-700 text-sm font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {detectingApp ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Nhận diện'}
                                        </button>
                                    </div>

                                    {detectedApp && (
                                        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                                            <div className="flex items-center gap-3">
                                                {detectedApp.iconUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={detectedApp.iconUrl} alt="" className="w-12 h-12 rounded-xl object-cover" />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                                                        <Link2 className="w-5 h-5 text-white" />
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-bold text-white truncate">{detectedApp.name}</p>
                                                    <p className="text-xs text-slate-500">{detectedApp.source === 'app-store' ? 'App Store' : detectedApp.source === 'google-play' ? 'Google Play' : 'Manual'}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 mt-3">
                                                <input
                                                    value={appCategory}
                                                    onChange={event => setAppCategory(event.target.value)}
                                                    className="h-9 rounded-lg bg-slate-900 border border-slate-700 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    placeholder="Category"
                                                />
                                                <input
                                                    value={appMeta}
                                                    onChange={event => setAppMeta(event.target.value)}
                                                    className="h-9 rounded-lg bg-slate-900 border border-slate-700 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    placeholder="Meta"
                                                />
                                            </div>
                                            <button
                                                onClick={addDetectedApp}
                                                className="w-full h-9 mt-3 rounded-lg bg-purple-500 hover:bg-purple-600 text-sm font-bold text-white transition-colors"
                                            >
                                                Thêm vào benchmark
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                                {benchmarkApps.map(app => {
                                    const Icon = app.icon || Link2
                                    const active = selectedAppId === app.id
                                    return (
                                        <button
                                            key={app.id}
                                            onClick={() => setSelectedAppId(app.id)}
                                            className={`text-left rounded-xl border bg-slate-900/70 p-4 transition-all ${active
                                                ? 'border-purple-400 shadow-lg shadow-purple-950/50 ring-1 ring-purple-400/40'
                                                : 'border-slate-800 hover:border-slate-600 hover:bg-slate-900'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${app.accent} flex items-center justify-center shadow-lg`}>
                                                    {app.iconUrl ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={app.iconUrl} alt="" className="w-full h-full rounded-2xl object-cover" />
                                                    ) : (
                                                        <Icon className="w-6 h-6 text-white" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-200 text-[10px] font-bold uppercase">
                                                            {app.category}
                                                        </span>
                                                    </div>
                                                    <p className="font-semibold text-sm text-white truncate">{app.name}</p>
                                                    <p className="text-xs text-slate-500 mt-1">{app.meta}</p>
                                                </div>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </section>

                        <section className="min-w-0">
                            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden">
                                <div className="px-4 py-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-xs text-purple-300 font-bold uppercase tracking-wider mb-1">
                                            {selectedApp.category}
                                        </p>
                                        <h2 className="text-lg font-bold text-white truncate">{selectedApp.name}</h2>
                                        {(selectedApp.storeUrl || selectedApp.playUrl) && (
                                            <div className="flex items-center gap-2 mt-2">
                                                {selectedApp.storeUrl && (
                                                    <a
                                                        href={selectedApp.storeUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-purple-200 transition-colors"
                                                    >
                                                        App Store
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                                {selectedApp.playUrl && (
                                                    <a
                                                        href={selectedApp.playUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-purple-200 transition-colors"
                                                    >
                                                        CH Play
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={addRow}
                                        className="h-9 px-3 rounded-lg bg-slate-800 border border-slate-700 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-2 w-fit"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Thêm idea
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-4 py-4 border-b border-slate-800 bg-slate-950/20">
                                    <WeeklyStatInput
                                        label="Số video tạo"
                                        value={weeklyStats.videosCreated}
                                        onChange={value => updateWeeklyStat('videosCreated', value)}
                                        fallbackValue={filledRows.length}
                                    />
                                    <WeeklyStatInput
                                        label="Qua phễu 1"
                                        value={weeklyStats.funnelOneCount}
                                        onChange={value => updateWeeklyStat('funnelOneCount', value)}
                                        suffix={`${funnelOneRate}%`}
                                    />
                                    <WeeklyStatInput
                                        label="Win"
                                        value={weeklyStats.winCount}
                                        onChange={value => updateWeeklyStat('winCount', value)}
                                        suffix={`${winRate}%`}
                                    />
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[920px]">
                                        <thead className="bg-slate-950/60">
                                            <tr>
                                                <th className="px-3 py-3 text-left text-xs font-bold text-slate-400 uppercase w-[36%]">Tên idea</th>
                                                <th className="px-3 py-3 text-left text-xs font-bold text-slate-400 uppercase w-[13%]">Thị trường</th>
                                                <th className="px-3 py-3 text-right text-xs font-bold text-slate-400 uppercase">CTR</th>
                                                <th className="px-3 py-3 text-right text-xs font-bold text-slate-400 uppercase">CVR</th>
                                                <th className="px-3 py-3 text-right text-xs font-bold text-slate-400 uppercase">CPI</th>
                                                <th className="px-3 py-3 text-right text-xs font-bold text-slate-400 uppercase">CPM</th>
                                                <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 uppercase">Đạt</th>
                                                <th className="px-3 py-3 w-12" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            {loadingRows ? (
                                                <tr>
                                                    <td colSpan={8} className="py-16 text-center">
                                                        <div className="inline-flex w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                                                    </td>
                                                </tr>
                                            ) : rows.map(row => (
                                                <tr key={row.id} className="hover:bg-slate-800/40">
                                                    <td className="px-3 py-2">
                                                        <input
                                                            value={row.ideaName}
                                                            onChange={event => updateRow(row.id, 'ideaName', event.target.value)}
                                                            className="w-full h-9 bg-slate-950/70 border border-slate-800 rounded-lg px-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                            placeholder="Garden_ModifySpy 0306"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <input
                                                            value={row.market}
                                                            onChange={event => updateRow(row.id, 'market', event.target.value)}
                                                            className="w-full h-9 bg-slate-950/70 border border-slate-800 rounded-lg px-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                            placeholder="US"
                                                        />
                                                    </td>
                                                    <MetricCell value={row.ctr} onChange={value => updateRow(row.id, 'ctr', value)} placeholder="1.37" suffix="%" />
                                                    <MetricCell value={row.cvr} onChange={value => updateRow(row.id, 'cvr', value)} placeholder="38.20" suffix="%" />
                                                    <MetricCell value={row.cpi} onChange={value => updateRow(row.id, 'cpi', value)} placeholder="0.32" prefix="$" />
                                                    <MetricCell value={row.cpm} onChange={value => updateRow(row.id, 'cpm', value)} placeholder="1.58" prefix="$" />
                                                    <td className="px-3 py-2 text-center">
                                                        <button
                                                            onClick={() => updateRow(row.id, 'passed', !row.passed)}
                                                            className={`mx-auto w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${row.passed
                                                                ? 'bg-emerald-500 border-emerald-400 text-white'
                                                                : 'bg-slate-950/70 border-slate-700 text-slate-500 hover:border-slate-500'
                                                                }`}
                                                            aria-label="Đạt benchmark"
                                                        >
                                                            {row.passed && <Check className="w-4 h-4" />}
                                                        </button>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <button
                                                            onClick={() => removeRow(row.id)}
                                                            className="w-8 h-8 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 transition-colors flex items-center justify-center"
                                                            aria-label="Xóa idea"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}

function WeeklyStatInput({
    label,
    value,
    onChange,
    fallbackValue,
    suffix,
}: {
    label: string
    value: string
    onChange: (value: string) => void
    fallbackValue?: number
    suffix?: string
}) {
    return (
        <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span>
            <div className="relative mt-2">
                <input
                    value={value}
                    onChange={event => onChange(event.target.value)}
                    inputMode="numeric"
                    placeholder={fallbackValue !== undefined ? String(fallbackValue) : '0'}
                    className="w-full h-11 rounded-xl bg-slate-950/80 border border-slate-800 px-3 pr-16 text-sm font-bold text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {suffix && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-purple-300">
                        {suffix}
                    </span>
                )}
            </div>
        </label>
    )
}

function SummaryCard({
    label,
    value,
    tone,
}: {
    label: string
    value: string | number
    tone: 'blue' | 'green' | 'purple' | 'amber'
}) {
    const toneClass = {
        blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/25 text-blue-200',
        green: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/25 text-emerald-200',
        purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/25 text-purple-200',
        amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/25 text-amber-200',
    }[tone]

    return (
        <div className={`rounded-xl border bg-gradient-to-br ${toneClass} p-4`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="text-2xl font-bold mt-2 text-white">{value}</p>
        </div>
    )
}

function MetricCell({
    value,
    onChange,
    placeholder,
    prefix,
    suffix,
}: {
    value: string
    onChange: (value: string) => void
    placeholder: string
    prefix?: string
    suffix?: string
}) {
    return (
        <td className="px-3 py-2">
            <div className="relative">
                {prefix && (
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                        {prefix}
                    </span>
                )}
                <input
                    value={value}
                    onChange={event => onChange(event.target.value)}
                    className={`w-full h-9 bg-slate-950/70 border border-slate-800 rounded-lg text-right text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500 ${prefix ? 'pl-6 pr-3' : suffix ? 'pl-3 pr-7' : 'px-3'}`}
                    placeholder={placeholder}
                />
                {suffix && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                        {suffix}
                    </span>
                )}
            </div>
        </td>
    )
}
