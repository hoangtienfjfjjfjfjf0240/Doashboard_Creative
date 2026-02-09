'use client'

import { format, eachDayOfInterval } from 'date-fns'
import { vi } from 'date-fns/locale'
import { TrendingUp, Sparkles } from 'lucide-react'

interface Task {
    id: string
    completed_at?: string | null
    due_date?: string | null
    points?: number | null
    assignee_name?: string | null
}

interface DailyPointsChartProps {
    tasks: Task[]
    dateRange?: { start: Date; end: Date }
    dateField?: 'completed_at' | 'due_date' // which date to group by
}

const BAR_GRADIENTS = [
    { gradient: 'linear-gradient(to top, #f97316, #fb923c)', glow: 'rgba(249,115,22,0.3)' },
    { gradient: 'linear-gradient(to top, #22c55e, #4ade80)', glow: 'rgba(34,197,94,0.3)' },
    { gradient: 'linear-gradient(to top, #ec4899, #f472b6)', glow: 'rgba(236,72,153,0.3)' },
    { gradient: 'linear-gradient(to top, #3b82f6, #60a5fa)', glow: 'rgba(59,130,246,0.3)' },
    { gradient: 'linear-gradient(to top, #06b6d4, #22d3ee)', glow: 'rgba(6,182,212,0.3)' },
    { gradient: 'linear-gradient(to top, #a855f7, #c084fc)', glow: 'rgba(168,85,247,0.3)' },
    { gradient: 'linear-gradient(to top, #f59e0b, #fbbf24)', glow: 'rgba(245,158,11,0.3)' },
]

export default function DailyPointsChart({ tasks, dateRange, dateField = 'completed_at' }: DailyPointsChartProps) {
    const start = dateRange?.start || new Date()
    const end = dateRange?.end || new Date()
    const allDays = eachDayOfInterval({ start, end })

    const getTaskDate = (task: Task): string | null => {
        if (dateField === 'due_date') {
            return task.due_date || (task.completed_at ? task.completed_at.split('T')[0] : null)
        }
        return task.completed_at ? task.completed_at.split('T')[0] : null
    }

    const pointsByDay: Record<string, number> = {}
    tasks.forEach(task => {
        const dayKey = getTaskDate(task)
        if (dayKey && task.points) {
            pointsByDay[dayKey] = (pointsByDay[dayKey] || 0) + task.points
        }
    })

    const useAggregate = allDays.length > 14

    let chartData: { label: string; points: number; colorIndex: number }[]

    if (useAggregate) {
        const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
        const dayPoints: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }

        tasks.forEach(task => {
            const dayKey = getTaskDate(task)
            if (dayKey && task.points) {
                const date = new Date(dayKey)
                const dow = date.getDay()
                dayPoints[dow] += task.points
            }
        })

        chartData = [1, 2, 3, 4, 5, 6, 0].map((dow, i) => ({
            label: DAY_LABELS[dow],
            points: Math.round(dayPoints[dow]),
            colorIndex: i
        }))
    } else {
        const DAY_MAP: Record<number, string> = { 0: 'CN', 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7' }
        chartData = allDays
            .map((day, i) => {
                const dayKey = format(day, 'yyyy-MM-dd')
                return {
                    label: DAY_MAP[day.getDay()],
                    points: pointsByDay[dayKey] || 0,
                    colorIndex: i % BAR_GRADIENTS.length
                }
            })
    }

    const maxPoints = Math.max(...chartData.map(d => d.points), 1)
    const totalPoints = chartData.reduce((s, d) => s + d.points, 0)
    const bestDay = chartData.reduce((best, d) => d.points > best.points ? d : best, chartData[0])

    return (
        <div className="glass-card p-5 card-hover">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                        <TrendingUp className="w-4.5 h-4.5 text-cyan-400" />
                    </div>
                    <h3 className="text-base font-semibold text-white">
                        {useAggregate ? 'Tổng Points Theo Thứ' : 'Points Theo Ngày'}
                    </h3>
                </div>
                <div className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-full">
                    <span className="text-sm font-bold text-cyan-300">{totalPoints.toFixed(0)}</span>
                    <span className="text-xs text-cyan-400/70">pts</span>
                </div>
            </div>

            {chartData.every(d => d.points === 0) ? (
                <div className="flex items-center justify-center h-[200px] text-slate-500 text-sm">
                    Chưa có dữ liệu
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Chart bars */}
                    <div className="flex items-end gap-2 h-[180px] px-1">
                        {chartData.map((item, index) => {
                            const heightPercent = maxPoints > 0 ? (item.points / maxPoints) * 100 : 0
                            const colorSet = BAR_GRADIENTS[item.colorIndex % BAR_GRADIENTS.length]
                            const isBest = item === bestDay && item.points > 0
                            const isEmpty = item.points === 0

                            return (
                                <div key={index} className="flex-1 flex flex-col items-center group">
                                    {/* Bar area with label on top */}
                                    <div className="w-full flex justify-center" style={{ height: '160px' }}>
                                        <div className="relative w-full max-w-[48px] h-full flex flex-col items-center justify-end">
                                            {/* Points value — sits right on top of bar */}
                                            <div className={`text-sm font-extrabold mb-1 transition-all duration-200 whitespace-nowrap ${isEmpty ? 'text-slate-600' :
                                                isBest ? 'text-yellow-300' : 'text-white'
                                                }`}>
                                                {isBest && <Sparkles className="w-3 h-3 inline mr-0.5 text-yellow-400" />}
                                                {isEmpty ? '—' : item.points % 1 === 0 ? item.points : item.points.toFixed(1)}
                                            </div>
                                            {/* Gradient bar */}
                                            <div
                                                className={`w-full rounded-t-lg animate-bar-grow-y group-hover:brightness-110 transition-all duration-200 ${isEmpty ? 'bg-slate-700/20 border border-dashed border-slate-600/30' : ''}`}
                                                style={{
                                                    height: isEmpty ? '4px' : `${Math.max(heightPercent, 8)}%`,
                                                    background: isEmpty ? undefined : colorSet.gradient,
                                                    boxShadow: isEmpty ? undefined : `0 0 12px ${colorSet.glow}`,
                                                    animationDelay: `${index * 60}ms`,
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Day label */}
                                    <span className={`text-xs font-medium mt-1.5 ${isBest ? 'text-yellow-300' : isEmpty ? 'text-slate-600' : 'text-slate-400'}`}>
                                        {item.label}
                                    </span>
                                </div>
                            )
                        })}
                    </div>

                    {/* Best day line */}
                    {bestDay && bestDay.points > 0 && (
                        <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-700/30">
                            <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                            <span className="text-xs text-slate-400">
                                Cao nhất: <span className="text-yellow-300 font-semibold">{bestDay.label}</span> — <span className="text-white font-bold">{bestDay.points.toFixed(1)} pts</span>
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
