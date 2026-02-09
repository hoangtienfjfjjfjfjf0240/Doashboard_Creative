'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

interface StatusDonutProps {
    done: number
    notDone: number
}

export default function StatusDonut({ done, notDone }: StatusDonutProps) {
    const data = [
        { name: 'Done', value: done, color: '#10b981' },
        { name: 'Not Done', value: notDone, color: '#f59e0b' },
    ]

    const total = done + notDone
    const donePercent = total > 0 ? ((done / total) * 100).toFixed(0) : 0

    return (
        <div className="glass-card p-6 card-hover">
            <h3 className="text-lg font-semibold text-white mb-4">Task Status</h3>
            <div className="h-64 relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.color}
                                    style={{ filter: `drop-shadow(0 0 6px ${entry.color}40)` }}
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#0f172a',
                                border: '1px solid rgba(51,65,85,0.5)',
                                borderRadius: '12px',
                                padding: '12px',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                            }}
                            labelStyle={{ color: '#f1f5f9', fontWeight: 600 }}
                        />
                        <Legend
                            verticalAlign="bottom"
                            formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>}
                        />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginTop: '-20px' }}>
                    <div className="text-center">
                        <p className="text-3xl font-bold text-white">{donePercent}%</p>
                        <p className="text-xs text-slate-400">Complete</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
