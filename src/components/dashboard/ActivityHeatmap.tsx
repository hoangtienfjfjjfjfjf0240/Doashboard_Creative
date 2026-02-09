'use client'

interface HeatmapData {
    day: string
    value: number
}

interface ActivityHeatmapProps {
    data: HeatmapData[]
}

export default function ActivityHeatmap({ data }: ActivityHeatmapProps) {
    const maxValue = Math.max(...data.map(d => d.value), 1)

    const getColor = (value: number) => {
        const intensity = value / maxValue
        if (intensity === 0) return 'bg-slate-700'
        if (intensity < 0.25) return 'bg-purple-900/50'
        if (intensity < 0.5) return 'bg-purple-700/60'
        if (intensity < 0.75) return 'bg-purple-500/70'
        return 'bg-purple-400'
    }

    return (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Weekly Activity</h3>
            <div className="flex items-end justify-between gap-2 h-32">
                {data.map((item) => (
                    <div key={item.day} className="flex-1 flex flex-col items-center gap-2">
                        <div
                            className={`w-full rounded-lg ${getColor(item.value)} transition-all hover:scale-105`}
                            style={{ height: `${Math.max(20, (item.value / maxValue) * 100)}%` }}
                            title={`${item.value} points`}
                        />
                        <span className="text-xs text-slate-400">{item.day}</span>
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-4">
                <span className="text-xs text-slate-500">Less</span>
                <div className="flex gap-1">
                    <div className="w-3 h-3 rounded bg-slate-700" />
                    <div className="w-3 h-3 rounded bg-purple-900/50" />
                    <div className="w-3 h-3 rounded bg-purple-700/60" />
                    <div className="w-3 h-3 rounded bg-purple-500/70" />
                    <div className="w-3 h-3 rounded bg-purple-400" />
                </div>
                <span className="text-xs text-slate-500">More</span>
            </div>
        </div>
    )
}
