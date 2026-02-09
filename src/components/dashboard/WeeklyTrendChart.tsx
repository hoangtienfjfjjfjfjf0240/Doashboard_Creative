'use client'

import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'

interface DailyData {
    day: string
    points: number
    tasks: number
}

interface WeeklyTrendChartProps {
    data: DailyData[]
}

export default function WeeklyTrendChart({ data }: WeeklyTrendChartProps) {
    return (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Điểm Trong Tuần</h3>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                        <defs>
                            <linearGradient id="pointsGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis
                            dataKey="day"
                            stroke="#64748b"
                            fontSize={11}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            stroke="#64748b"
                            fontSize={11}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1e293b',
                                border: '1px solid #475569',
                                borderRadius: '8px',
                                padding: '10px',
                            }}
                            labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                            formatter={(value: any) => [`${value} điểm`, '']}
                        />
                        <Area
                            type="monotone"
                            dataKey="points"
                            stroke="#8b5cf6"
                            strokeWidth={2}
                            fill="url(#pointsGradient)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
