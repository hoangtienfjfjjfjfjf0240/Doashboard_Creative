'use client'

import { useMemo } from 'react'
import { Wrench } from 'lucide-react'

interface Task {
    assignee_name: string | null
    ctst: string | null
    status: 'done' | 'not_done'
}

interface CTSTChartProps {
    tasks: Task[]
}

const TOOL_STYLES: Record<string, { gradient: string; glow: string; dot: string }> = {
    'Translate Tool': { gradient: 'linear-gradient(90deg, #ef4444, #f87171)', glow: 'rgba(239,68,68,0.25)', dot: 'bg-red-500' },
    'Media tool': { gradient: 'linear-gradient(90deg, #f59e0b, #fbbf24)', glow: 'rgba(245,158,11,0.25)', dot: 'bg-yellow-500' },
    'Voice Clone': { gradient: 'linear-gradient(90deg, #22c55e, #4ade80)', glow: 'rgba(34,197,94,0.25)', dot: 'bg-green-500' },
    'Flow veo3': { gradient: 'linear-gradient(90deg, #3b82f6, #60a5fa)', glow: 'rgba(59,130,246,0.25)', dot: 'bg-blue-500' },
    'Sora': { gradient: 'linear-gradient(90deg, #f97316, #fb923c)', glow: 'rgba(249,115,22,0.25)', dot: 'bg-orange-500' },
}

const DEFAULT_STYLE = { gradient: 'linear-gradient(90deg, #64748b, #94a3b8)', glow: 'rgba(100,116,139,0.25)', dot: 'bg-slate-500' }

export default function CTSTChart({ tasks }: CTSTChartProps) {
    const stats = useMemo(() => {
        const toolTotals: Record<string, number> = {}
        let totalCTST = 0

        tasks.forEach(task => {
            if (!task.ctst || task.status !== 'done') return
            toolTotals[task.ctst] = (toolTotals[task.ctst] || 0) + 1
            totalCTST++
        })

        const toolsWithPercent = Object.entries(toolTotals)
            .map(([name, count]) => ({
                name,
                count,
                percent: totalCTST > 0 ? (count / totalCTST) * 100 : 0
            }))
            .sort((a, b) => b.count - a.count)

        return { toolsWithPercent, totalCTST }
    }, [tasks])

    if (stats.toolsWithPercent.length === 0) {
        return (
            <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-4">
                    <Wrench className="w-5 h-5 text-purple-400" />
                    <h3 className="text-base font-semibold text-white">Cải Tiến Sáng Tạo (CTST)</h3>
                </div>
                <p className="text-slate-500 text-sm text-center py-4">Chưa có dữ liệu CTST</p>
            </div>
        )
    }

    const maxPercent = Math.max(...stats.toolsWithPercent.map(t => t.percent), 1)

    return (
        <div className="glass-card p-5 card-hover">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                    <Wrench className="w-5 h-5 text-purple-400" />
                    <h3 className="text-base font-semibold text-white">Cải Tiến Sáng Tạo (CTST)</h3>
                </div>
                <span className="text-xs text-slate-500 bg-slate-700/40 px-2.5 py-1 rounded-lg">
                    {stats.totalCTST} tasks
                </span>
            </div>

            <div className="space-y-3 stagger-children">
                {stats.toolsWithPercent.map((tool, i) => {
                    const style = TOOL_STYLES[tool.name] || DEFAULT_STYLE
                    return (
                        <div key={tool.name} className="group">
                            <div className="flex items-center justify-between text-sm mb-1">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2.5 h-2.5 rounded-sm ${style.dot}`} />
                                    <span className="text-slate-300 group-hover:text-white transition-colors duration-200">{tool.name}</span>
                                </div>
                                <span className="text-slate-400 font-medium">
                                    {tool.percent.toFixed(1)}% <span className="text-slate-600">({tool.count})</span>
                                </span>
                            </div>
                            <div className="h-6 bg-slate-700/30 rounded-lg overflow-hidden border border-slate-700/20">
                                <div
                                    className="h-full rounded-lg animate-bar-grow flex items-center justify-end pr-2 transition-shadow duration-200"
                                    style={{
                                        width: `${(tool.percent / maxPercent) * 100}%`,
                                        background: style.gradient,
                                        boxShadow: `0 0 10px ${style.glow}`,
                                        animationDelay: `${i * 60}ms`,
                                    }}
                                >
                                    {tool.percent >= 15 && (
                                        <span className="text-xs text-white font-medium drop-shadow-lg">
                                            {tool.percent.toFixed(0)}%
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
