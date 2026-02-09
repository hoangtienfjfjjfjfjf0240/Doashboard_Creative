'use client'

import { Trophy, Star, Award } from 'lucide-react'

interface LeaderboardEntry {
    name: string
    weeksAchieved: number
    totalWeeks: number
    points: number
    target: number
}

interface LeaderboardProps {
    data: LeaderboardEntry[]
}

export default function Leaderboard({ data }: LeaderboardProps) {
    const sortedData = [...data]
        .sort((a, b) => {
            if (b.weeksAchieved !== a.weeksAchieved) return b.weeksAchieved - a.weeksAchieved
            return b.points - a.points
        })

    const getRankIcon = (rank: number) => {
        if (rank === 1) return <Trophy className="w-4 h-4 text-yellow-400" />
        if (rank === 2) return <Award className="w-4 h-4 text-slate-300" />
        if (rank === 3) return <Star className="w-4 h-4 text-amber-600" />
        return null
    }

    const getRankStyle = (rank: number) => {
        if (rank === 1) return 'bg-yellow-500/8 border-yellow-500/25 hover:border-yellow-500/40 hover:bg-yellow-500/12'
        if (rank === 2) return 'bg-slate-400/5 border-slate-500/20 hover:border-slate-400/30 hover:bg-slate-400/8'
        if (rank === 3) return 'bg-amber-600/5 border-amber-600/20 hover:border-amber-600/30 hover:bg-amber-600/8'
        return 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600/40 hover:bg-slate-700/20'
    }

    const getBarGradient = (weeks: number) => {
        if (weeks >= 10) return 'linear-gradient(90deg, #8b5cf6, #06b6d4)'
        if (weeks > 0) return 'linear-gradient(90deg, #a855f7, #818cf8)'
        return '#475569'
    }

    const getBarGlow = (weeks: number) => {
        if (weeks >= 10) return '0 0 10px rgba(139,92,246,0.3)'
        if (weeks > 0) return '0 0 8px rgba(168,85,247,0.2)'
        return 'none'
    }

    const getWeeksColor = (weeks: number) => {
        if (weeks >= 20) return 'text-emerald-400'
        if (weeks >= 10) return 'text-green-400'
        if (weeks >= 5) return 'text-yellow-400'
        if (weeks > 0) return 'text-orange-400'
        return 'text-slate-500'
    }

    return (
        <div className="glass-card p-5">
            <div className="flex items-center gap-2.5 mb-4">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <h3 className="text-base font-semibold text-white">Số Tuần Đạt Target</h3>
            </div>

            <div className="space-y-1.5 stagger-children">
                {sortedData.map((entry, index) => {
                    const rank = index + 1
                    const progressPercent = (entry.weeksAchieved / entry.totalWeeks) * 100

                    return (
                        <div
                            key={entry.name}
                            className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 ${getRankStyle(rank)}`}
                        >
                            <div className="w-6 text-center flex-shrink-0">
                                {getRankIcon(rank) || (
                                    <span className="text-xs font-bold text-slate-500">{rank}</span>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{entry.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="flex-1 h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full animate-bar-grow"
                                            style={{
                                                width: `${Math.min(100, progressPercent)}%`,
                                                background: getBarGradient(entry.weeksAchieved),
                                                boxShadow: getBarGlow(entry.weeksAchieved),
                                                animationDelay: `${index * 50}ms`,
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-baseline gap-0.5 flex-shrink-0">
                                <span className={`text-lg font-bold ${getWeeksColor(entry.weeksAchieved)}`}>
                                    {entry.weeksAchieved}
                                </span>
                                <span className="text-[10px] text-slate-500">/{entry.totalWeeks}</span>
                            </div>
                        </div>
                    )
                })}

                {sortedData.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-sm">
                        Chưa có dữ liệu
                    </div>
                )}
            </div>
        </div>
    )
}
