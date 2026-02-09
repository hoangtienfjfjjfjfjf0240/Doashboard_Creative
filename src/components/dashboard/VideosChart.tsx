'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'

interface AssigneeData {
    name: string
    points: number
    videos: number
}

interface VideosChartProps {
    data: AssigneeData[]
}

const COLORS = [
    '#06b6d4', '#22d3ee', '#0891b2', '#0e7490', '#14b8a6',
    '#2dd4bf', '#5eead4', '#0284c7', '#0ea5e9', '#38bdf8',
]

export default function VideosChart({ data }: VideosChartProps) {
    const sortedData = [...data].sort((a, b) => b.videos - a.videos).slice(0, 10)

    return (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600/50 transition-all duration-300">
            <h3 className="text-lg font-semibold text-white mb-4">Video Theo Thành Viên</h3>
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={sortedData}
                        layout="vertical"
                        margin={{ left: 10, right: 50, top: 5, bottom: 5 }}
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
                            formatter={(value) => [`${value} video`, '']}
                        />
                        <Bar dataKey="videos" radius={[0, 6, 6, 0]} barSize={24} animationDuration={800} animationEasing="ease-out">
                            {sortedData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                            <LabelList
                                dataKey="videos"
                                position="right"
                                fill="#e2e8f0"
                                fontSize={11}
                                fontWeight={600}
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
