'use client'

import { Film, Image } from 'lucide-react'

interface Task {
    video_type: string | null
    video_count: number
}

interface VideoTypeMixChartProps {
    data: Task[]
    unit?: 'video' | 'image'
}

const VIDEO_TYPE_COLORS: Record<string, { badge: string; bar: string; glow: string }> = {
    S1: { badge: 'bg-slate-500', bar: 'linear-gradient(90deg, #64748b, #94a3b8)', glow: 'rgba(100,116,139,0.3)' },
    S2A: { badge: 'bg-blue-500', bar: 'linear-gradient(90deg, #3b82f6, #60a5fa)', glow: 'rgba(59,130,246,0.3)' },
    S2B: { badge: 'bg-sky-500', bar: 'linear-gradient(90deg, #0ea5e9, #38bdf8)', glow: 'rgba(14,165,233,0.3)' },
    S3A: { badge: 'bg-emerald-500', bar: 'linear-gradient(90deg, #10b981, #34d399)', glow: 'rgba(16,185,129,0.3)' },
    S3B: { badge: 'bg-green-500', bar: 'linear-gradient(90deg, #22c55e, #4ade80)', glow: 'rgba(34,197,94,0.3)' },
    S4: { badge: 'bg-amber-500', bar: 'linear-gradient(90deg, #f59e0b, #fbbf24)', glow: 'rgba(245,158,11,0.3)' },
    S5: { badge: 'bg-orange-500', bar: 'linear-gradient(90deg, #f97316, #fb923c)', glow: 'rgba(249,115,22,0.3)' },
    S6: { badge: 'bg-red-500', bar: 'linear-gradient(90deg, #ef4444, #f87171)', glow: 'rgba(239,68,68,0.3)' },
    S7: { badge: 'bg-pink-500', bar: 'linear-gradient(90deg, #ec4899, #f472b6)', glow: 'rgba(236,72,153,0.3)' },
    S8: { badge: 'bg-purple-500', bar: 'linear-gradient(90deg, #a855f7, #c084fc)', glow: 'rgba(168,85,247,0.3)' },
    S9A: { badge: 'bg-indigo-500', bar: 'linear-gradient(90deg, #6366f1, #818cf8)', glow: 'rgba(99,102,241,0.3)' },
    S9B: { badge: 'bg-violet-500', bar: 'linear-gradient(90deg, #8b5cf6, #a78bfa)', glow: 'rgba(139,92,246,0.3)' },
    S9C: { badge: 'bg-fuchsia-500', bar: 'linear-gradient(90deg, #d946ef, #e879f9)', glow: 'rgba(217,70,239,0.3)' },
    // Graphic design types
    ScreenShot: { badge: 'bg-cyan-500', bar: 'linear-gradient(90deg, #06b6d4, #22d3ee)', glow: 'rgba(6,182,212,0.3)' },
    'Deep Localize': { badge: 'bg-teal-500', bar: 'linear-gradient(90deg, #14b8a6, #2dd4bf)', glow: 'rgba(20,184,166,0.3)' },
    'Cover, Promotional Content': { badge: 'bg-rose-500', bar: 'linear-gradient(90deg, #f43f5e, #fb7185)', glow: 'rgba(244,63,94,0.3)' },
    Icon: { badge: 'bg-lime-500', bar: 'linear-gradient(90deg, #84cc16, #a3e635)', glow: 'rgba(132,204,22,0.3)' },
    'Research Doc': { badge: 'bg-yellow-500', bar: 'linear-gradient(90deg, #eab308, #facc15)', glow: 'rgba(234,179,8,0.3)' },
    'Localize Screenshot': { badge: 'bg-emerald-400', bar: 'linear-gradient(90deg, #34d399, #6ee7b7)', glow: 'rgba(52,211,153,0.3)' },
}

// Short labels for display
const VIDEO_TYPE_SHORT: Record<string, string> = {
    'ScreenShot': 'SS',
    'Deep Localize': 'DL',
    'Cover, Promotional Content': 'Cover',
    'Localize Screenshot': 'LocSS',
    'Research Doc': 'RDoc',
    'Icon': 'Icon',
}

// Per-type unit override for graphic dashboard
// These types use "bộ" instead of "image"
const UNIT_OVERRIDE_BO = new Set([
    'Localize',
    'Localize Screenshot',
    'Deep Localize',
    'Deep Localization',
    'ScreenShot',
    'Research Doc',
    'Cover, Promotional Content',
])

const DEFAULT_COLORS = { badge: 'bg-slate-500', bar: 'linear-gradient(90deg, #64748b, #94a3b8)', glow: 'rgba(100,116,139,0.3)' }

export default function VideoTypeMixChart({ data, unit = 'video' }: VideoTypeMixChartProps) {
    const isImageMode = unit === 'image'
    const unitTitle = isImageMode ? 'Phân Bổ Loại Ảnh' : 'Phân Bổ Loại Video'
    const UnitIcon = isImageMode ? Image : Film

    const videoTypeStats = data.reduce((acc, task) => {
        if (!task.video_type) return acc
        if (!acc[task.video_type]) acc[task.video_type] = { count: 0, videos: 0 }
        acc[task.video_type].count++
        acc[task.video_type].videos += task.video_count || 0
        return acc
    }, {} as Record<string, { count: number; videos: number }>)

    const chartData = Object.entries(videoTypeStats)
        .map(([type, stats]) => ({
            name: type,
            count: stats.count,
            videos: stats.videos,
            colors: VIDEO_TYPE_COLORS[type] || DEFAULT_COLORS
        }))
        .sort((a, b) => b.videos - a.videos)

    const maxVideos = Math.max(...chartData.map(d => d.videos), 1)
    const totalVideos = chartData.reduce((sum, d) => sum + d.videos, 0)

    // Determine unit label per type
    const getUnitLabel = (typeName: string) => {
        if (!isImageMode) return 'videos'
        return UNIT_OVERRIDE_BO.has(typeName) ? 'bộ' : 'image'
    }

    // For the header total, use a generic label
    const defaultUnitLabel = isImageMode ? 'items' : 'videos'

    return (
        <div className="glass-card p-5 card-hover h-full">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center">
                        <UnitIcon className="w-4.5 h-4.5 text-purple-400" />
                    </div>
                    <h3 className="text-base font-semibold text-white">{unitTitle}</h3>
                </div>
                <div className="flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">
                    <span className="text-sm font-bold text-purple-300">{totalVideos}</span>
                    <span className="text-xs text-purple-400/70">{defaultUnitLabel}</span>
                </div>
            </div>

            {chartData.length > 0 ? (
                <div className="space-y-2 stagger-children">
                    {chartData.map((item) => {
                        const widthPercent = (item.videos / maxVideos) * 100
                        const sharePercent = totalVideos > 0 ? ((item.videos / totalVideos) * 100).toFixed(1) : '0'
                        const itemUnit = getUnitLabel(item.name)

                        return (
                            <div key={item.name} className="group relative">
                                <div className="flex items-center gap-3">
                                    {/* Badge */}
                                    <div className={`w-16 flex-shrink-0 text-center px-1.5 py-1.5 rounded-lg ${item.colors.badge} transition-transform duration-200 group-hover:scale-105 shadow-md`}>
                                        <span className="text-xs font-bold text-white drop-shadow-md">{VIDEO_TYPE_SHORT[item.name] || item.name}</span>
                                    </div>

                                    {/* Bar track */}
                                    <div className="flex-1 h-8 bg-slate-700/25 rounded-lg overflow-hidden relative border border-slate-700/30">
                                        <div
                                            className="h-full rounded-lg animate-bar-grow transition-shadow duration-300"
                                            style={{
                                                width: `${Math.max(widthPercent, 6)}%`,
                                                background: item.colors.bar,
                                                boxShadow: `0 0 12px ${item.colors.glow}`,
                                            }}
                                        />
                                        <div className="absolute inset-0 flex items-center px-3">
                                            <span
                                                className={`text-sm font-bold drop-shadow-lg ${widthPercent > 30 ? 'text-white' : 'text-slate-200'}`}
                                                style={{ marginLeft: widthPercent > 30 ? '0' : `${Math.max(widthPercent, 6) + 1}%` }}
                                            >
                                                {item.videos} {itemUnit}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Percentage */}
                                    <div className="w-14 flex-shrink-0 text-right">
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${parseFloat(sharePercent) >= 50 ? 'bg-green-500/15 text-green-300' :
                                            parseFloat(sharePercent) >= 20 ? 'bg-blue-500/15 text-blue-300' :
                                                'bg-slate-600/25 text-slate-400'
                                            }`}>
                                            {sharePercent}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
                    Chưa có dữ liệu
                </div>
            )
            }
        </div>
    )
}
