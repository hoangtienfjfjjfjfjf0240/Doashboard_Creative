'use client'

import { useMemo } from 'react'
import { format, eachDayOfInterval, getWeek } from 'date-fns'
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
    dateField?: 'completed_at' | 'due_date'
}

const BAR_GRADIENTS = [
    { gradient: 'linear-gradient(135deg, #f97316, #fb923c)', glow: 'rgba(249,115,22,0.25)' },
    { gradient: 'linear-gradient(135deg, #22c55e, #4ade80)', glow: 'rgba(34,197,94,0.25)' },
    { gradient: 'linear-gradient(135deg, #ec4899, #f472b6)', glow: 'rgba(236,72,153,0.25)' },
    { gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)', glow: 'rgba(59,130,246,0.25)' },
    { gradient: 'linear-gradient(135deg, #06b6d4, #22d3ee)', glow: 'rgba(6,182,212,0.25)' },
    { gradient: 'linear-gradient(135deg, #a855f7, #c084fc)', glow: 'rgba(168,85,247,0.25)' },
    { gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)', glow: 'rgba(245,158,11,0.25)' },
]

const DAY_MAP: Record<number, string> = { 0: 'CN', 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7' }

export default function DailyPointsChart({ tasks, dateRange, dateField = 'due_date' }: DailyPointsChartProps) {
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

    const weekdays = allDays.filter(day => day.getDay() !== 0 && day.getDay() !== 6)

    const weekGroups = useMemo(() => {
        const groups: { weekLabel: string; days: { date: Date; dayKey: string; label: string; dateLabel: string; points: number }[] }[] = []
        let currentWeekNum = -1
        let currentGroup: typeof groups[0] | null = null

        weekdays.forEach(day => {
            const weekNum = getWeek(day, { weekStartsOn: 1 })
            const dayKey = format(day, 'yyyy-MM-dd')

            if (weekNum !== currentWeekNum) {
                currentWeekNum = weekNum
                currentGroup = { weekLabel: `Tuần ${weekNum}`, days: [] }
                groups.push(currentGroup)
            }

            currentGroup!.days.push({
                date: day,
                dayKey,
                label: DAY_MAP[day.getDay()],
                dateLabel: format(day, 'dd/MM'),
                points: pointsByDay[dayKey] || 0,
            })
        })
        return groups
    }, [weekdays.length, JSON.stringify(pointsByDay)])

    const chartData = weekGroups.flatMap(g => g.days)
    const maxPoints = Math.max(...chartData.map(d => d.points), 1)
    const totalPoints = chartData.reduce((s, d) => s + d.points, 0)
    const bestDay = chartData.length > 0 ? chartData.reduce((best, d) => d.points > best.points ? d : best, chartData[0]) : null

    const isMultiWeek = weekGroups.length > 1
    const numDays = chartData.length

    // Bar inner max-width: thin enough but visible
    const barInnerMax = numDays <= 5 ? 36 : numDays <= 10 ? 30 : numDays <= 20 ? 24 : 18

    return (
        <div className="glass-card p-4 card-hover h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-cyan-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">Points Theo Ngày</h3>
                    {isMultiWeek && (
                        <span className="text-[10px] text-slate-500">({weekGroups.length} tuần)</span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 rounded-full">
                    <span className="text-sm font-bold text-cyan-300">{totalPoints.toFixed(0)}</span>
                    <span className="text-[10px] text-cyan-400/70">pts</span>
                </div>
            </div>

            {chartData.length === 0 || chartData.every(d => d.points === 0) ? (
                <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                    Chưa có dữ liệu
                </div>
            ) : (
                <div className="flex-1 flex flex-col">
                    {/* Week labels row */}
                    {isMultiWeek && (
                        <div className="flex w-full mb-1" style={{ gap: '2px' }}>
                            {weekGroups.map(group => (
                                <div key={group.weekLabel} style={{ flex: group.days.length }} className="text-center">
                                    <span className="text-[9px] text-purple-400/80 font-semibold">{group.weekLabel}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Bars row: flex-1 per bar, spread across full width */}
                    <div className="flex-1 flex items-end w-full" style={{ minHeight: '120px', gap: '2px' }}>
                        {chartData.map((item, globalIdx) => {
                            const heightPercent = maxPoints > 0 ? (item.points / maxPoints) * 100 : 0
                            const barHeight = item.points === 0 ? '3px' : `${Math.max(heightPercent * 0.85, 6)}%`
                            const colorSet = BAR_GRADIENTS[globalIdx % BAR_GRADIENTS.length]
                            const isBest = bestDay && item === bestDay && item.points > 0
                            const isEmpty = item.points === 0

                            return (
                                <div key={item.dayKey} className="flex-1 flex flex-col items-center justify-end group min-w-0 h-full">
                                    {/* Points value */}
                                    <div className={`text-[10px] font-bold mb-0.5 whitespace-nowrap ${isEmpty ? 'text-slate-700' :
                                        isBest ? 'text-yellow-300' : 'text-white/80'
                                        }`}>
                                        {isBest && <Sparkles className="w-2.5 h-2.5 inline mr-0.5 text-yellow-400" />}
                                        {isEmpty ? '—' : item.points % 1 === 0 ? item.points : item.points.toFixed(1)}
                                    </div>
                                    {/* Bar */}
                                    <div
                                        className={`rounded-t-lg group-hover:brightness-110 transition-all duration-200 ${isEmpty ? 'bg-slate-700/20 border border-dashed border-slate-600/20' : ''}`}
                                        style={{
                                            width: `${barInnerMax}px`,
                                            height: barHeight,
                                            background: isEmpty ? undefined : colorSet.gradient,
                                            boxShadow: isEmpty ? undefined : `0 2px 12px ${colorSet.glow}`,
                                        }}
                                    />
                                </div>
                            )
                        })}
                    </div>

                    {/* Labels row */}
                    <div className="flex w-full mt-1" style={{ gap: '2px' }}>
                        {chartData.map((item) => {
                            const isBest = bestDay && item === bestDay && item.points > 0
                            const isEmpty = item.points === 0
                            return (
                                <div key={item.dayKey} className="flex-1 flex flex-col items-center min-w-0">
                                    <span className={`text-[10px] font-medium ${isBest ? 'text-yellow-300' : isEmpty ? 'text-slate-600' : 'text-slate-400'}`}>
                                        {item.label}
                                    </span>
                                    <span className={`text-[8px] leading-tight ${isEmpty ? 'text-slate-700' : 'text-slate-500'}`}>
                                        {item.dateLabel}
                                    </span>
                                </div>
                            )
                        })}
                    </div>

                    {/* Best day */}
                    {bestDay && bestDay.points > 0 && (
                        <div className="flex items-center justify-center gap-1.5 pt-2 mt-2 border-t border-slate-700/30">
                            <Sparkles className="w-3 h-3 text-yellow-400" />
                            <span className="text-[11px] text-slate-400">
                                Cao nhất: <span className="text-yellow-300 font-semibold">{bestDay.label} ({bestDay.dateLabel})</span> — <span className="text-white font-bold">{bestDay.points.toFixed(1)} pts</span>
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
