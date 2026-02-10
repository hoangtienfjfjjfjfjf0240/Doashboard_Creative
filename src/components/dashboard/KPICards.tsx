'use client'

import { TrendingUp, TrendingDown, CheckCircle, XCircle, Trophy, ClipboardList, Minus } from 'lucide-react'

interface KPICardsProps {
    totalPoints: number
    totalVideos: number
    doneTasks: number
    notDoneTasks: number
    notDonePoints: number
    activeAssignees: number
    avgPointsPerVideo: number
    teamTargetPoints: number
    teamAchievedPercent: number
    weeksAchieved?: number
    totalWeeks?: number
}

export default function KPICards({
    totalPoints,
    totalVideos,
    doneTasks,
    notDoneTasks,
    notDonePoints,
    teamTargetPoints,
    weeksAchieved = 0,
    totalWeeks = 24,
}: KPICardsProps) {
    const totalTasks = doneTasks + notDoneTasks
    const projectedTotal = totalPoints + notDonePoints
    const gap = projectedTotal - teamTargetPoints

    const cards = [
        {
            title: 'Total Tasks',
            value: totalTasks.toLocaleString(),
            icon: ClipboardList,
            bgColor: 'bg-cyan-500/10',
            textColor: 'text-cyan-400',
            glowColor: 'hover:shadow-cyan-500/15',
        },
        {
            title: 'Done Tasks',
            value: doneTasks.toLocaleString(),
            icon: CheckCircle,
            bgColor: 'bg-emerald-500/10',
            textColor: 'text-emerald-400',
            glowColor: 'hover:shadow-emerald-500/15',
        },
        {
            title: 'Chưa Done',
            value: notDoneTasks.toLocaleString(),
            icon: XCircle,
            bgColor: 'bg-amber-500/10',
            textColor: 'text-amber-400',
            glowColor: 'hover:shadow-amber-500/15',
        },
    ]

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6 stagger-children">
            {/* Total Points Card - Enhanced */}
            <div className="glass-card p-4 hover:scale-[1.02] hover:shadow-lg hover:shadow-violet-500/15 transition-all duration-250 cursor-default group">
                <div className="inline-flex p-2 rounded-xl bg-violet-500/10 mb-3 group-hover:scale-110 transition-transform duration-250">
                    <TrendingUp className="w-5 h-5 text-violet-400" />
                </div>
                <div className="space-y-0.5">
                    <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold text-white">
                            {totalPoints % 1 === 0 ? totalPoints : totalPoints.toFixed(1)}
                        </p>
                        <span className="text-xs text-emerald-400">thực tế</span>
                    </div>
                    {notDonePoints > 0 && (
                        <div className="flex items-baseline gap-2">
                            <p className="text-base font-semibold text-amber-400">
                                +{notDonePoints % 1 === 0 ? notDonePoints : notDonePoints.toFixed(1)}
                            </p>
                            <span className="text-xs text-amber-400/70">chưa done</span>
                        </div>
                    )}
                    <div className="flex items-baseline gap-2">
                        <p className="text-lg font-semibold text-slate-400">
                            {teamTargetPoints}
                        </p>
                        <span className="text-xs text-purple-400">mục tiêu</span>
                    </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">Total Points</p>
            </div>

            {cards.map((card) => (
                <div
                    key={card.title}
                    className={`glass-card p-4 hover:scale-[1.02] hover:shadow-lg ${card.glowColor} transition-all duration-250 cursor-default group`}
                >
                    <div className={`inline-flex p-2 rounded-xl ${card.bgColor} mb-3 group-hover:scale-110 transition-transform duration-250`}>
                        <card.icon className={`w-5 h-5 ${card.textColor}`} />
                    </div>
                    <p className="text-2xl font-bold text-white mb-1">{card.value}</p>
                    <p className="text-xs text-slate-400">{card.title}</p>
                </div>
            ))}

            {/* Weeks Achieved Card */}
            <div className="glass-card p-4 border-purple-500/25 hover:border-purple-400/40 hover:shadow-lg hover:shadow-purple-500/15 transition-all duration-250 group">
                <div className="flex items-center justify-between mb-3">
                    <div className="inline-flex p-2 rounded-xl bg-purple-500/15 group-hover:scale-110 transition-transform duration-250">
                        <Trophy className="w-5 h-5 text-purple-400" />
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${weeksAchieved > 0
                        ? 'text-emerald-300 bg-emerald-500/15'
                        : 'text-slate-300 bg-slate-500/15'
                        }`}>
                        {weeksAchieved > 0 ? '🎉 Đạt!' : 'Chưa đạt'}
                    </span>
                </div>
                <p className="text-2xl font-bold text-white mb-1">
                    {weeksAchieved}/{totalWeeks}
                </p>
                <p className="text-xs text-slate-400">Tuần đạt target</p>
                <div className="mt-2 h-2 bg-slate-700/40 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full animate-bar-grow"
                        style={{
                            width: `${(weeksAchieved / totalWeeks) * 100}%`,
                            background: weeksAchieved > 0 ? 'linear-gradient(90deg, #10b981, #34d399)' : '#475569',
                            boxShadow: weeksAchieved > 0 ? '0 0 8px rgba(16,185,129,0.3)' : 'none',
                        }}
                    />
                </div>
            </div>
        </div>
    )
}

