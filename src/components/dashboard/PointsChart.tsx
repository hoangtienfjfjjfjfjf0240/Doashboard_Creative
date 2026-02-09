'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList, ReferenceLine } from 'recharts'

interface AssigneeData {
    name: string
    points: number
    videos: number
}

interface PointsChartProps {
    data: AssigneeData[]
    weeklyTarget?: number
}

const COLORS = [
    '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444',
    '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16',
]

const WEEKLY_TARGET = 160

export default function PointsChart({ data, weeklyTarget = WEEKLY_TARGET }: PointsChartProps) {
    const sortedData = [...data].sort((a, b) => b.points - a.points).slice(0, 10)

    return (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600/50 transition-all duration-300">
            <h3 className="text-lg font-semibold text-white mb-4">Điểm Theo Thành Viên</h3>
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={sortedData}
                        layout="vertical"
                        margin={{ left: 10, right: 70, top: 5, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                        <XAxis
                            type="number"
                            stroke="#64748b"
                            fontSize={11}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            type="category"
                            dataKey="name"
                            stroke="#64748b"
                            fontSize={11}
                            width={90}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(value) => value.length > 10 ? value.slice(0, 10) + '...' : value}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1e293b',
                                border: '1px solid #475569',
                                borderRadius: '8px',
                                padding: '10px',
                            }}
                            labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                            formatter={(value) => [`${value}/${weeklyTarget} điểm`, '']}
                        />
                        {/* Target Reference Line */}
                        <ReferenceLine
                            x={weeklyTarget}
                            stroke="#ef4444"
                            strokeDasharray="5 5"
                            strokeWidth={2}
                            label={{
                                value: `Target: ${weeklyTarget}`,
                                position: 'top',
                                fill: '#ef4444',
                                fontSize: 10,
                                fontWeight: 600
                            }}
                        />
                        <Bar dataKey="points" radius={[0, 6, 6, 0]} barSize={24} animationDuration={800} animationEasing="ease-out">
                            {sortedData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.points >= weeklyTarget ? '#10b981' : COLORS[index % COLORS.length]}
                                />
                            ))}
                            <LabelList
                                dataKey="points"
                                position="right"
                                fill="#e2e8f0"
                                fontSize={11}
                                fontWeight={600}
                                formatter={(value) => `${value}/${weeklyTarget}`}
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center justify-end gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-emerald-500" />
                    <span>Đạt mục tiêu</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-purple-500" />
                    <span>Chưa đạt</span>
                </div>
            </div>
        </div>
    )
}
