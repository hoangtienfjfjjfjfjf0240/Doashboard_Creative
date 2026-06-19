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
    BarChart3,
    Calendar,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    Link2,
    Plus,
    RefreshCw,
    Save,
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
    win: boolean
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
    win: boolean | null
    sort_order: number | null
}

type WeeklyStats = {
    videosCreated: string
    funnelOneCount: string
    winCount: string
    benchmarkMarket: string
    benchmarkCtr: string
    benchmarkCvr: string
    benchmarkCpi: string
    benchmarkCpm: string
}

type DbWeeklyStats = {
    videos_created: number | null
    funnel_one_count: number | null
    win_count: number | null
    benchmark_market: string | null
    benchmark_ctr: number | null
    benchmark_cvr: number | null
    benchmark_cpi: number | null
    benchmark_cpm: number | null
}

type DetectedApp = {
    name: string
    iconUrl?: string
    storeUrl?: string
    playUrl?: string
    source: 'app-store' | 'google-play' | 'manual'
    externalId?: string
}

type BenchmarkAppDeleteHistoryRecord = {
    id: string
    appId: string
    appName: string
    category: string
    meta: string
    deletedAt: string
    deletedByEmail: string
    deletedByName: string
    deletedByRole: string
    isCustom: boolean
}

type SaveRowsOptions = {
    silent?: boolean
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

const MARKET_OPTIONS = ['US/Global', 'US', 'Global', 'VN', 'TH', 'ID', 'BR', 'MX', 'JP', 'KR']
const AUTO_SAVE_INTERVAL_MS = 60_000

function toDateKey(date: Date) {
    return format(date, 'yyyy-MM-dd')
}

function makeRow(overrides: Partial<BenchmarkRow> = {}): BenchmarkRow {
    return {
        id: crypto.randomUUID(),
        ideaName: '',
        market: 'US',
        ctr: '',
        cvr: '',
        cpi: '',
        cpm: '',
        passed: false,
        win: false,
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
        row.ctr.trim() ||
        row.cvr.trim() ||
        row.cpi.trim() ||
        row.cpm.trim() ||
        row.passed ||
        row.win
    )
}

function hasBenchmarkInput(row: BenchmarkRow) {
    return Boolean(
        row.ideaName.trim() ||
        row.ctr.trim() ||
        row.cvr.trim() ||
        row.cpi.trim() ||
        row.cpm.trim()
    )
}

function syncBenchmarkRow(row: BenchmarkRow): BenchmarkRow {
    const passed = hasBenchmarkInput(row)
    return {
        ...row,
        passed,
        win: passed ? row.win : false,
    }
}

function getStorageKey(appId: string, weekStart: string) {
    return `creative-benchmark:${appId}:${weekStart}`
}

function getStatsStorageKey(appId: string, weekStart: string) {
    return `creative-benchmark-stats:${appId}:${weekStart}`
}

function getAppsStorageKey() {
    return 'creative-benchmark:custom-apps:v2'
}

function getHiddenAppsStorageKey() {
    return 'creative-benchmark:hidden-apps:v1'
}

function getDeleteHistoryStorageKey() {
    return 'creative-benchmark:app-delete-history:v1'
}

function makeBlankStats(): WeeklyStats {
    return {
        videosCreated: '',
        funnelOneCount: '',
        winCount: '',
        benchmarkMarket: 'US/Global',
        benchmarkCtr: '1.50',
        benchmarkCvr: '20',
        benchmarkCpi: '4',
        benchmarkCpm: '12',
    }
}

function hasStatsContent(stats: WeeklyStats) {
    const defaultStats = makeBlankStats()
    return (
        stats.videosCreated !== defaultStats.videosCreated
        || stats.funnelOneCount !== defaultStats.funnelOneCount
        || stats.winCount !== defaultStats.winCount
        || stats.benchmarkMarket !== defaultStats.benchmarkMarket
        || stats.benchmarkCtr !== defaultStats.benchmarkCtr
        || stats.benchmarkCvr !== defaultStats.benchmarkCvr
        || stats.benchmarkCpi !== defaultStats.benchmarkCpi
        || stats.benchmarkCpm !== defaultStats.benchmarkCpm
    )
}

function toNumber(value: string) {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function getSupabaseSaveError(error?: { message?: string } | null) {
    const detail = error?.message ? ` (${error.message})` : ''
    return `Chưa lưu được Supabase. Dữ liệu đang được giữ tạm trên trình duyệt, cần chạy migration benchmark trước.${detail}`
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

export default function CreativeBenchmarkPage() {
    const router = useRouter()
    const supabase = useMemo(() => createClient(), [])
    const { user, loading: userLoading } = useUser()
    const canAccessIdeaCreator = user?.role === 'admin'
        || (Boolean(user?.roleCreative) && user?.roleCreative !== 'none')
    const currentWeekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), [])
    const timelineWeeks = useMemo(() => generateTimelineWeeks(currentWeekStart), [currentWeekStart])
    const weeksByMonth = useMemo(() => groupWeeksByMonth(timelineWeeks), [timelineWeeks])

    const [selectedAppId, setSelectedAppId] = useState(BENCHMARK_APPS[0].id)
    const [customApps, setCustomApps] = useState<BenchmarkApp[]>([])
    const [hiddenAppIds, setHiddenAppIds] = useState<string[]>([])
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
    const [, setStorageMode] = useState<StorageMode>('checking')
    const [loadingRows, setLoadingRows] = useState(true)
    const [saving, setSaving] = useState(false)
    const [isDirty, setIsDirty] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const weekPickerRef = useRef<HTMLDivElement>(null)
    const dirtyVersionRef = useRef(0)
    const saveRowsRef = useRef<((options?: SaveRowsOptions) => Promise<void>) | null>(null)
    const savingRef = useRef(false)
    const canDeleteApps = user?.role === 'admin'
        || user?.role === 'manager'
        || user?.roleCreative === 'admin'
        || user?.roleCreative === 'manager'

    const benchmarkApps = useMemo(
        () => [...BENCHMARK_APPS, ...customApps].filter(app => !hiddenAppIds.includes(app.id)),
        [customApps, hiddenAppIds]
    )
    const selectedApp = benchmarkApps.find(app => app.id === selectedAppId) || benchmarkApps[0] || BENCHMARK_APPS[0]
    const selectedWeekKey = toDateKey(selectedWeekStart)
    const selectedWeekEnd = addDays(selectedWeekStart, 4)
    const lastTimelineWeekStart = timelineWeeks[timelineWeeks.length - 1]?.start || currentWeekStart
    const canGoToPreviousWeek = selectedWeekStart.getTime() > currentWeekStart.getTime()
    const canGoToNextWeek = selectedWeekStart.getTime() < lastTimelineWeekStart.getTime()
    const normalizedRows = useMemo(() => rows.map(syncBenchmarkRow), [rows])
    const filledRows = normalizedRows.filter(hasBenchmarkInput)
    const passedCount = filledRows.length
    const videosCreated = toNumber(weeklyStats.videosCreated)
    const funnelOneCount = passedCount
    const winCount = filledRows.filter(row => row.win).length
    const benchmarkRate = videosCreated > 0 ? Math.round((passedCount / videosCreated) * 100) : 0
    const funnelOneRate = videosCreated > 0 ? Math.round((funnelOneCount / videosCreated) * 100) : 0
    const winRate = funnelOneCount > 0 ? Math.round((winCount / funnelOneCount) * 100) : 0

    const setDirtyState = useCallback((nextDirty: boolean) => {
        if (!nextDirty) {
            dirtyVersionRef.current = 0
            setIsDirty(false)
            return
        }

        dirtyVersionRef.current = Math.max(dirtyVersionRef.current, 1)
        setIsDirty(true)
    }, [])

    const markDirty = useCallback(() => {
        dirtyVersionRef.current += 1
        setIsDirty(true)
    }, [])

    const loadLocalRows = useCallback((appId: string, weekStartKey: string) => {
        try {
            const raw = localStorage.getItem(getStorageKey(appId, weekStartKey))
            if (!raw) return makeBlankRows()
            const parsed = JSON.parse(raw) as BenchmarkRow[]
            return parsed.length > 0 ? parsed.map(row => makeRow(syncBenchmarkRow(row))) : makeBlankRows()
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

    const loadHiddenAppIds = useCallback(() => {
        try {
            const raw = localStorage.getItem(getHiddenAppsStorageKey())
            if (!raw) return []
            const parsed = JSON.parse(raw)
            return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
        } catch {
            return []
        }
    }, [])

    const saveHiddenAppIds = useCallback((appIds: string[]) => {
        localStorage.setItem(getHiddenAppsStorageKey(), JSON.stringify(appIds))
    }, [])

    const loadDeleteHistory = useCallback(() => {
        try {
            const raw = localStorage.getItem(getDeleteHistoryStorageKey())
            if (!raw) return []
            const parsed = JSON.parse(raw)
            return Array.isArray(parsed) ? parsed as BenchmarkAppDeleteHistoryRecord[] : []
        } catch {
            return []
        }
    }, [])

    const saveDeleteHistory = useCallback((records: BenchmarkAppDeleteHistoryRecord[]) => {
        localStorage.setItem(getDeleteHistoryStorageKey(), JSON.stringify(records.slice(0, 200)))
    }, [])

    const loadRows = useCallback(async (appId: string, weekStartKey: string) => {
        setLoadingRows(true)
        setMessage(null)

        const [{ data, error }, statsResult] = await Promise.all([
            supabase
            .from('creative_benchmark_entries')
            .select('id, app_id, week_start_date, idea_name, market, ctr, cvr, cpi, cpm, passed, win, sort_order')
            .eq('app_id', appId)
            .eq('week_start_date', weekStartKey)
            .order('sort_order', { ascending: true }),
            supabase
                .from('creative_benchmark_weekly_stats')
                .select('videos_created, funnel_one_count, win_count, benchmark_market, benchmark_ctr, benchmark_cvr, benchmark_cpi, benchmark_cpm')
                .eq('app_id', appId)
                .eq('week_start_date', weekStartKey)
                .maybeSingle(),
        ])

        if (error || statsResult.error) {
            setStorageMode('local')
            const fallbackRows = loadLocalRows(appId, weekStartKey)
            const fallbackStats = loadLocalStats(appId, weekStartKey)
            setRows(fallbackRows)
            setWeeklyStats(fallbackStats)
            setDirtyState(fallbackRows.some(hasRowContent) || hasStatsContent(fallbackStats))
            setMessage({ type: 'error', text: getSupabaseSaveError(error || statsResult.error) })
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
                win: Boolean(entry.win),
            })
        )
        const localRows = loadLocalRows(appId, weekStartKey)
        const hasLocalRows = localRows.some(hasRowContent)
        setRows(dbRows.length > 0 ? dbRows : hasLocalRows ? localRows : makeBlankRows())
        const dbStats = statsResult.data as DbWeeklyStats | null
        const localStats = loadLocalStats(appId, weekStartKey)
        setWeeklyStats(dbStats ? {
            videosCreated: dbStats.videos_created ? String(dbStats.videos_created) : '',
            funnelOneCount: dbStats.funnel_one_count ? String(dbStats.funnel_one_count) : '',
            winCount: dbStats.win_count ? String(dbStats.win_count) : '',
            benchmarkMarket: dbStats.benchmark_market || 'US/Global',
            benchmarkCtr: dbStats.benchmark_ctr !== null && dbStats.benchmark_ctr !== undefined ? String(dbStats.benchmark_ctr) : '1.50',
            benchmarkCvr: dbStats.benchmark_cvr !== null && dbStats.benchmark_cvr !== undefined ? String(dbStats.benchmark_cvr) : '20',
            benchmarkCpi: dbStats.benchmark_cpi !== null && dbStats.benchmark_cpi !== undefined ? String(dbStats.benchmark_cpi) : '4',
            benchmarkCpm: dbStats.benchmark_cpm !== null && dbStats.benchmark_cpm !== undefined ? String(dbStats.benchmark_cpm) : '12',
        } : localStats)
        setDirtyState((dbRows.length === 0 && hasLocalRows) || (!dbStats && hasStatsContent(localStats)))
        setLoadingRows(false)
    }, [loadLocalRows, loadLocalStats, setDirtyState, supabase])

    useEffect(() => {
        if (!userLoading && !user) {
            router.push('/login')
        }
        if (!userLoading && user && !canAccessIdeaCreator) {
            router.push('/dashboard')
        }
    }, [canAccessIdeaCreator, router, user, userLoading])

    useEffect(() => {
        setCustomApps(loadCustomApps())
        setHiddenAppIds(loadHiddenAppIds())
    }, [loadCustomApps, loadHiddenAppIds])

    useEffect(() => {
        if (benchmarkApps.length > 0 && !benchmarkApps.some(app => app.id === selectedAppId)) {
            setSelectedAppId(benchmarkApps[0].id)
        }
    }, [benchmarkApps, selectedAppId])

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
        setRows(prev => {
            const next = prev.map(row => {
                if (row.id !== id) {
                    return row
                }

                if (field === 'passed') {
                    return syncBenchmarkRow(row)
                }

                return syncBenchmarkRow({ ...row, [field]: value })
            })
            saveLocalRows(selectedAppId, selectedWeekKey, next)
            return next
        })
        markDirty()
    }

    const addRow = () => {
        setRows(prev => {
            const next = [...prev, makeRow()]
            saveLocalRows(selectedAppId, selectedWeekKey, next)
            return next
        })
        markDirty()
    }

    const removeRow = (id: string) => {
        setRows(prev => {
            const next = prev.filter(row => row.id !== id)
            const nextRows = next.length > 0 ? next : makeBlankRows(1)
            saveLocalRows(selectedAppId, selectedWeekKey, nextRows)
            return nextRows
        })
        markDirty()
    }

    const saveRows = useCallback(async ({ silent = false }: SaveRowsOptions = {}) => {
        if (savingRef.current) {
            return
        }

        const saveVersion = dirtyVersionRef.current
        const rowsToSave = normalizedRows.filter(hasRowContent)
        const statsToSave: WeeklyStats = {
            ...weeklyStats,
            funnelOneCount: String(funnelOneCount),
            winCount: String(winCount),
        }
        savingRef.current = true
        setSaving(true)
        if (!silent) {
            setMessage(null)
        }

        const { error: deleteError } = await supabase
            .from('creative_benchmark_entries')
            .delete()
            .eq('app_id', selectedAppId)
            .eq('week_start_date', selectedWeekKey)

        if (deleteError) {
            setStorageMode('local')
            saveLocalRows(selectedAppId, selectedWeekKey, rowsToSave)
            saveLocalStats(selectedAppId, selectedWeekKey, statsToSave)
            setMessage({ type: 'error', text: getSupabaseSaveError(deleteError) })
            savingRef.current = false
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
                win: row.win,
                sort_order: index,
            }))

            const { error: insertError } = await supabase
                .from('creative_benchmark_entries')
                .insert(payload)

            if (insertError) {
                setStorageMode('local')
                saveLocalRows(selectedAppId, selectedWeekKey, rowsToSave)
                saveLocalStats(selectedAppId, selectedWeekKey, statsToSave)
                setMessage({ type: 'error', text: getSupabaseSaveError(insertError) })
                savingRef.current = false
                setSaving(false)
                return
            }
        }

        // Keep the first save timestamp/owner on weekly stats so deadline tracking
        // still reflects the initial submission even if someone edits later.
        const { error: statsInsertError } = await supabase
            .from('creative_benchmark_weekly_stats')
            .upsert({
                app_id: selectedAppId,
                week_start_date: selectedWeekKey,
                videos_created: toNumber(weeklyStats.videosCreated),
                funnel_one_count: funnelOneCount,
                win_count: winCount,
                benchmark_market: weeklyStats.benchmarkMarket || 'US/Global',
                benchmark_ctr: parseMetric(weeklyStats.benchmarkCtr),
                benchmark_cvr: parseMetric(weeklyStats.benchmarkCvr),
                benchmark_cpi: parseMetric(weeklyStats.benchmarkCpi),
                benchmark_cpm: parseMetric(weeklyStats.benchmarkCpm),
            }, {
                onConflict: 'app_id,week_start_date',
            })

        if (statsInsertError) {
            setStorageMode('local')
            saveLocalRows(selectedAppId, selectedWeekKey, rowsToSave)
            saveLocalStats(selectedAppId, selectedWeekKey, statsToSave)
            setMessage({ type: 'error', text: getSupabaseSaveError(statsInsertError) })
            savingRef.current = false
            setSaving(false)
            return
        }

        setStorageMode('database')
        saveLocalRows(selectedAppId, selectedWeekKey, rowsToSave)
        saveLocalStats(selectedAppId, selectedWeekKey, statsToSave)
        if (dirtyVersionRef.current === saveVersion) {
            setDirtyState(false)
        }
        if (silent) {
            setMessage(current => current?.type === 'error' ? null : current)
        } else {
            setMessage({ type: 'success', text: 'Đã lưu benchmark' })
        }
        savingRef.current = false
        setSaving(false)
    }, [
        funnelOneCount,
        normalizedRows,
        saveLocalRows,
        saveLocalStats,
        selectedAppId,
        selectedWeekKey,
        setDirtyState,
        supabase,
        weeklyStats,
        winCount,
    ])

    useEffect(() => {
        saveRowsRef.current = saveRows
    }, [saveRows])

    useEffect(() => {
        if (!isDirty || loadingRows || userLoading || !user) {
            return
        }

        const intervalId = window.setInterval(() => {
            if (!savingRef.current) {
                void saveRowsRef.current?.({ silent: true })
            }
        }, AUTO_SAVE_INTERVAL_MS)

        return () => window.clearInterval(intervalId)
    }, [isDirty, loadingRows, user, userLoading])

    const copyPreviousWeek = async () => {
        const previousWeekKey = toDateKey(subDays(selectedWeekStart, 7))
        const previousLocalRows = loadLocalRows(selectedAppId, previousWeekKey).filter(hasRowContent)

        const { data, error } = await supabase
            .from('creative_benchmark_entries')
            .select('idea_name, market, ctr, cvr, cpi, cpm, passed, win, sort_order')
            .eq('app_id', selectedAppId)
            .eq('week_start_date', previousWeekKey)
            .order('sort_order', { ascending: true })

        if (error) {
            if (previousLocalRows.length > 0) {
                const nextRows = previousLocalRows.map(row => makeRow(syncBenchmarkRow({ ...row, win: false })))
                setRows(nextRows)
                saveLocalRows(selectedAppId, selectedWeekKey, nextRows)
                markDirty()
                setMessage({ type: 'error', text: 'Đã copy từ dữ liệu tạm trên trình duyệt. Supabase vẫn chưa sẵn sàng để đọc benchmark.' })
                return
            }
            setMessage({ type: 'error', text: getSupabaseSaveError(error) })
            return
        }

        const previousRows = (data as Omit<DbBenchmarkEntry, 'id' | 'app_id' | 'week_start_date'>[] | null || [])
        if (previousRows.length === 0) {
            if (previousLocalRows.length > 0) {
                const nextRows = previousLocalRows.map(row => makeRow(syncBenchmarkRow({ ...row, win: false })))
                setRows(nextRows)
                saveLocalRows(selectedAppId, selectedWeekKey, nextRows)
                markDirty()
                setMessage({ type: 'success', text: 'Đã copy từ dữ liệu tạm tuần trước' })
                return
            }
            setMessage({ type: 'error', text: 'Tuần trước chưa có benchmark' })
            return
        }

        const nextRows = previousRows.map(row =>
            makeRow({
                ideaName: row.idea_name || '',
                market: row.market || '',
                ctr: formatMetric(row.ctr),
                cvr: formatMetric(row.cvr),
                cpi: formatMetric(row.cpi),
                cpm: formatMetric(row.cpm),
                win: false,
            })
        )
        setRows(nextRows)
        saveLocalRows(selectedAppId, selectedWeekKey, nextRows)
        markDirty()
        setMessage({ type: 'success', text: 'Đã copy từ tuần trước' })
    }

    const updateWeeklyStat = (field: keyof WeeklyStats, value: string) => {
        const cleaned = field === 'videosCreated' || field === 'funnelOneCount' || field === 'winCount'
            ? value.replace(/[^0-9]/g, '')
            : field === 'benchmarkMarket'
                ? value
                : value.replace(/[^0-9.,]/g, '')
        setWeeklyStats(prev => {
            const next = { ...prev, [field]: cleaned }
            saveLocalStats(selectedAppId, selectedWeekKey, next)
            return next
        })
        markDirty()
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

    const deleteApp = (appId: string) => {
        if (!canDeleteApps) {
            setMessage({ type: 'error', text: 'Chỉ manager/admin mới được xóa app benchmark' })
            return
        }

        if (benchmarkApps.length <= 1) {
            setMessage({ type: 'error', text: 'Cần giữ ít nhất 1 app benchmark' })
            return
        }

        const targetApp = benchmarkApps.find(app => app.id === appId)
        if (!targetApp) {
            setMessage({ type: 'error', text: 'Không tìm thấy app để xóa' })
            return
        }

        const nextVisibleApps = benchmarkApps.filter(app => app.id !== appId)
        const isCustomApp = customApps.some(app => app.id === appId)

        if (isCustomApp) {
            const nextCustomApps = customApps.filter(app => app.id !== appId)
            setCustomApps(nextCustomApps)
            saveCustomApps(nextCustomApps)
        } else {
            const nextHiddenAppIds = Array.from(new Set([...hiddenAppIds, appId]))
            setHiddenAppIds(nextHiddenAppIds)
            saveHiddenAppIds(nextHiddenAppIds)
        }

        if (selectedAppId === appId && nextVisibleApps[0]) {
            setSelectedAppId(nextVisibleApps[0].id)
        }

        const nextHistory = [
            {
                id: crypto.randomUUID(),
                appId: targetApp.id,
                appName: targetApp.name,
                category: targetApp.category,
                meta: targetApp.meta,
                deletedAt: new Date().toISOString(),
                deletedByEmail: user?.email || '',
                deletedByName: user?.fullName || user?.email || 'Unknown',
                deletedByRole: user?.roleCreative || user?.role || 'member',
                isCustom: isCustomApp,
            },
            ...loadDeleteHistory(),
        ]
        saveDeleteHistory(nextHistory)

        setMessage({ type: 'success', text: 'Đã xóa app benchmark' })
    }

    if (userLoading || !user || !canAccessIdeaCreator) {
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
                                                        onClick={() => {
                                                            if (canGoToPreviousWeek) {
                                                                setSelectedWeekStart(subDays(selectedWeekStart, 7))
                                                            }
                                                        }}
                                                        disabled={!canGoToPreviousWeek}
                                                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${canGoToPreviousWeek
                                                            ? 'bg-slate-700/60 text-slate-200 hover:bg-slate-700'
                                                            : 'bg-slate-800/60 text-slate-500 cursor-not-allowed'
                                                            }`}
                                                    >
                                                        <ChevronLeft className="w-4 h-4" />
                                                        Tuần trước
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (canGoToNextWeek) {
                                                                setSelectedWeekStart(addDays(selectedWeekStart, 7))
                                                            }
                                                        }}
                                                        disabled={!canGoToNextWeek}
                                                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm mt-2 ${canGoToNextWeek
                                                            ? 'bg-slate-700/60 text-slate-200 hover:bg-slate-700'
                                                            : 'bg-slate-800/60 text-slate-500 cursor-not-allowed'
                                                            }`}
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
                                onClick={() => {
                                    void saveRows()
                                }}
                                disabled={saving}
                                className="h-10 px-4 rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-60 disabled:cursor-not-allowed text-sm font-semibold text-white transition-colors flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                {saving ? 'Đang lưu' : 'Lưu benchmark'}
                            </button>
                        </div>
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
                                        <div
                                            key={app.id}
                                            className={`relative rounded-xl border bg-slate-900/70 transition-all ${active
                                                ? 'border-purple-400 shadow-lg shadow-purple-950/50 ring-1 ring-purple-400/40'
                                                : 'border-slate-800 hover:border-slate-600 hover:bg-slate-900'
                                                }`}
                                        >
                                            <button
                                                onClick={() => setSelectedAppId(app.id)}
                                                className="w-full text-left p-4 pr-12"
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
                                            {canDeleteApps && (
                                                <button
                                                    onClick={() => deleteApp(app.id)}
                                                    className="absolute top-3 right-3 w-8 h-8 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 transition-colors flex items-center justify-center"
                                                    aria-label="Xóa app"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
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

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 px-4 py-4 border-b border-slate-800 bg-slate-950/20">
                                    <WeeklyStatInput
                                        label="Video tạo theo tuần"
                                        value={weeklyStats.videosCreated}
                                        onChange={value => updateWeeklyStat('videosCreated', value)}
                                        fallbackValue={0}
                                    />
                                    <WeeklyStatDisplay
                                        label="Video đạt benchmark"
                                        value={`${passedCount}/${videosCreated || 0} (${benchmarkRate}%)`}
                                    />
                                    <WeeklyStatDisplay
                                        label="Qua phễu 1"
                                        value={`${funnelOneCount}/${videosCreated || 0}`}
                                        suffix={`${funnelOneRate}%`}
                                    />
                                    <WeeklyStatDisplay
                                        label="Tỉ lệ win"
                                        value={`${winRate}%`}
                                        suffix={`${winCount}/${funnelOneCount || 0}`}
                                    />
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[1000px]">
                                        <thead className="bg-slate-950/60">
                                            <tr>
                                                <th className="px-3 py-3 text-left text-xs font-bold text-slate-400 uppercase w-[36%]">Tên idea</th>
                                                <th className="px-3 py-3 text-left text-xs font-bold text-slate-400 uppercase w-[13%]">Thị trường</th>
                                                <th className="px-3 py-3 text-right text-xs font-bold text-slate-400 uppercase">CTR</th>
                                                <th className="px-3 py-3 text-right text-xs font-bold text-slate-400 uppercase">CVR</th>
                                                <th className="px-3 py-3 text-right text-xs font-bold text-slate-400 uppercase">CPI</th>
                                                <th className="px-3 py-3 text-right text-xs font-bold text-slate-400 uppercase">CPM</th>
                                                <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 uppercase">Đạt</th>
                                                <th className="px-3 py-3 text-center text-xs font-bold text-slate-400 uppercase">Win</th>
                                                <th className="px-3 py-3 w-12" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            <tr className="bg-amber-500/10 hover:bg-amber-500/15">
                                                <td className="px-3 py-2">
                                                    <div className="h-9 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 flex items-center text-sm font-bold text-amber-200">
                                                        Benchmark
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <MarketSelect
                                                        value={weeklyStats.benchmarkMarket}
                                                        onChange={value => updateWeeklyStat('benchmarkMarket', value)}
                                                        tone="benchmark"
                                                    />
                                                </td>
                                                <MetricCell value={weeklyStats.benchmarkCtr} onChange={value => updateWeeklyStat('benchmarkCtr', value)} placeholder="1.50" suffix="%" />
                                                <MetricCell value={weeklyStats.benchmarkCvr} onChange={value => updateWeeklyStat('benchmarkCvr', value)} placeholder="20" suffix="%" />
                                                <MetricCell value={weeklyStats.benchmarkCpi} onChange={value => updateWeeklyStat('benchmarkCpi', value)} placeholder="4" prefix="$" />
                                                <MetricCell value={weeklyStats.benchmarkCpm} onChange={value => updateWeeklyStat('benchmarkCpm', value)} placeholder="12" prefix="$" />
                                                <td className="px-3 py-2 text-center">
                                                    <span className="text-xs font-bold text-amber-300">Chuẩn</span>
                                                </td>
                                                <td className="px-3 py-2" />
                                                <td className="px-3 py-2" />
                                            </tr>
                                            {loadingRows ? (
                                                <tr>
                                                    <td colSpan={9} className="py-16 text-center">
                                                        <div className="inline-flex w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                                                    </td>
                                                </tr>
                                            ) : normalizedRows.map(row => (
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
                                                        <MarketSelect
                                                            value={row.market}
                                                            onChange={value => updateRow(row.id, 'market', value)}
                                                        />
                                                    </td>
                                                    <MetricCell value={row.ctr} onChange={value => updateRow(row.id, 'ctr', value)} placeholder="1.37" suffix="%" />
                                                    <MetricCell value={row.cvr} onChange={value => updateRow(row.id, 'cvr', value)} placeholder="38.20" suffix="%" />
                                                    <MetricCell value={row.cpi} onChange={value => updateRow(row.id, 'cpi', value)} placeholder="0.32" prefix="$" />
                                                    <MetricCell value={row.cpm} onChange={value => updateRow(row.id, 'cpm', value)} placeholder="1.58" prefix="$" />
                                                    <td className="px-3 py-2 text-center">
                                                        <button
                                                            type="button"
                                                            disabled
                                                            className={`mx-auto w-8 h-8 rounded-lg border flex items-center justify-center cursor-default transition-colors ${row.passed
                                                                ? 'bg-emerald-500 border-emerald-400 text-white'
                                                                : 'bg-slate-950/70 border-slate-700 text-slate-500'
                                                                }`}
                                                            aria-label="Đạt benchmark"
                                                        >
                                                            {row.passed && <Check className="w-4 h-4" />}
                                                        </button>
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => updateRow(row.id, 'win', !row.win)}
                                                            disabled={!row.passed}
                                                            className={`mx-auto w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${row.win
                                                                ? 'bg-amber-500 border-amber-400 text-white'
                                                                : row.passed
                                                                    ? 'bg-slate-950/70 border-slate-700 text-slate-500 hover:border-slate-500'
                                                                    : 'bg-slate-950/70 border-slate-800 text-slate-700 cursor-not-allowed'
                                                                }`}
                                                            aria-label="Win sau phễu 1"
                                                        >
                                                            {row.win && <Check className="w-4 h-4" />}
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

function WeeklyStatDisplay({
    label,
    value,
    suffix,
}: {
    label: string
    value: string | number
    suffix?: string
}) {
    return (
        <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span>
            <div className="relative mt-2 h-11 rounded-xl bg-slate-950/80 border border-slate-800 px-3 pr-16 flex items-center">
                <span className="text-sm font-bold text-white">{value}</span>
                {suffix && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-purple-300">
                        {suffix}
                    </span>
                )}
            </div>
        </div>
    )
}

function MarketSelect({
    value,
    onChange,
    tone = 'default',
}: {
    value: string
    onChange: (value: string) => void
    tone?: 'default' | 'benchmark'
}) {
    const customValue = value && !MARKET_OPTIONS.includes(value) ? value : null
    const className = tone === 'benchmark'
        ? 'w-full h-9 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 text-sm font-semibold text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400'
        : 'w-full h-9 bg-slate-950/70 border border-slate-800 rounded-lg px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500'
    const optionStyle = {
        backgroundColor: '#0f172a',
        color: tone === 'benchmark' ? '#fef3c7' : '#ffffff',
    }

    return (
        <select
            value={value}
            onChange={event => onChange(event.target.value)}
            className={className}
            style={{ colorScheme: 'dark' }}
        >
            {tone === 'default' && <option value="" style={optionStyle}>Chọn</option>}
            {customValue && <option value={customValue} style={optionStyle}>{customValue}</option>}
            {MARKET_OPTIONS.map(option => (
                <option key={option} value={option} style={optionStyle}>{option}</option>
            ))}
        </select>
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
