'use client'

import { Users, TrendingDown, TrendingUp, Minus } from 'lucide-react'

interface MemberStats {
    name: string
    doneTasks: number
    notDoneTasks: number
    points: number
    target: number
}

interface MemberSummaryTableProps {
    data: MemberStats[]
}

export default function MemberSummaryTable({ data }: MemberSummaryTableProps) {
    // Sort by gap (most behind first)
    const sorted = [...data].sort((a, b) => {
        const gapA = a.points - a.target
        const gapB = b.points - b.target
        return gapA - gapB
    })

    return (
        <div className="glass-card p-5">
            <div className="flex items-center gap-2.5 mb-4">
                <Users className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-semibold text-white">Chi Tiết Thành Viên</h3>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-700/50">
                            <th className="text-left py-2.5 px-3 text-slate-400 font-medium">Thành viên</th>
                            <th className="text-center py-2.5 px-2 text-emerald-400 font-medium">Done</th>
                            <th className="text-center py-2.5 px-2 text-amber-400 font-medium">Chưa Done</th>
                            <th className="text-right py-2.5 px-2 text-violet-400 font-medium">Điểm</th>
                            <th className="text-right py-2.5 px-2 text-slate-400 font-medium">Target</th>
                            <th className="text-right py-2.5 px-3 text-slate-400 font-medium">Thiếu/Dư</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((member, index) => {
                            const gap = member.points - member.target
                            const isOver = gap >= 0
                            const totalTasks = member.doneTasks + member.notDoneTasks

                            return (
                                <tr
                                    key={member.name}
                                    className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors"
                                    style={{ animationDelay: `${index * 30}ms` }}
                                >
                                    <td className="py-2.5 px-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                                                {member.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="text-white font-medium truncate max-w-[140px]">{member.name}</span>
                                        </div>
                                    </td>
                                    <td className="text-center py-2.5 px-2">
                                        <span className="text-emerald-400 font-semibold">{member.doneTasks}</span>
                                        <span className="text-slate-600 text-xs">/{totalTasks}</span>
                                    </td>
                                    <td className="text-center py-2.5 px-2">
                                        <span className={`font-semibold ${member.notDoneTasks > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                                            {member.notDoneTasks}
                                        </span>
                                    </td>
                                    <td className="text-right py-2.5 px-2">
                                        <span className="text-white font-bold">
                                            {member.points % 1 === 0 ? member.points : member.points.toFixed(1)}
                                        </span>
                                    </td>
                                    <td className="text-right py-2.5 px-2">
                                        <span className="text-slate-400">
                                            {member.target}
                                        </span>
                                    </td>
                                    <td className="text-right py-2.5 px-3">
                                        <div className="flex items-center justify-end gap-1">
                                            {gap === 0 ? (
                                                <Minus className="w-3.5 h-3.5 text-slate-500" />
                                            ) : isOver ? (
                                                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                                            ) : (
                                                <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                                            )}
                                            <span className={`font-bold ${gap === 0 ? 'text-slate-500' :
                                                isOver ? 'text-emerald-400' : 'text-red-400'
                                                }`}>
                                                {isOver ? '+' : ''}{gap % 1 === 0 ? gap : gap.toFixed(1)}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {data.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-4">Không có dữ liệu</p>
            )}
        </div>
    )
}
