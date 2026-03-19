'use client'

import { Clock, CheckCircle2, AlertTriangle } from 'lucide-react'

interface Task {
    assignee_name: string | null
    status: 'done' | 'not_done'
    completed_at: string | null
    due_date: string | null
    asana_id?: string
}

interface DueDateChange {
    task_id: string
    old_due_date: string | null
    new_due_date: string | null
    changed_at: string
}

interface DueDateStatsProps {
    tasks: Task[]
    dueDateChanges?: DueDateChange[]
}

export default function DueDateStats({ tasks, dueDateChanges = [] }: DueDateStatsProps) {
    // Build a map: task_id → list of due_date changes
    const changesByTask = new Map<string, DueDateChange[]>()
    dueDateChanges.forEach(change => {
        const list = changesByTask.get(change.task_id) || []
        list.push(change)
        changesByTask.set(change.task_id, list)
    })

    // Check if a task had a late due_date change
    // Late if:
    //   1. due_date was pushed forward (new_due_date > old_due_date) — regardless of when
    //   2. OR due_date was changed AFTER the old deadline had passed
    const isTaskLateByDueDateChange = (taskId: string): boolean => {
        const changes = changesByTask.get(taskId)
        if (!changes || changes.length === 0) return false

        return changes.some(change => {
            if (!change.old_due_date) return false
            const oldDueDay = change.old_due_date.split('T')[0]

            // Case 1: due_date pushed to a later date → always late
            if (change.new_due_date) {
                const newDueDay = change.new_due_date.split('T')[0]
                if (newDueDay > oldDueDay) return true
            }

            // Case 2: due_date changed after the old deadline passed
            if (change.changed_at) {
                const changedDay = change.changed_at.split('T')[0]
                if (changedDay > oldDueDay) return true
            }

            return false
        })
    }

    const stats = tasks.reduce((acc, task) => {
        if (!task.assignee_name || task.status !== 'done' || !task.completed_at || !task.due_date) return acc
        // Only count tasks from Feb 2026 onwards (deployed period)
        const dueDate = new Date(task.due_date)
        if (dueDate.getFullYear() < 2026 || (dueDate.getFullYear() === 2026 && dueDate.getMonth() < 1)) return acc
        if (!acc[task.assignee_name]) acc[task.assignee_name] = { total: 0, onTime: 0, late: 0 }
        acc[task.assignee_name].total++

        // Check 1: Was due_date changed after the original deadline? → Late
        const taskId = task.asana_id || ''
        if (taskId && isTaskLateByDueDateChange(taskId)) {
            acc[task.assignee_name].late++
        }
        // Check 2: Was the task completed after the due_date? → Late
        else {
            const completedDate = task.completed_at.split('T')[0]
            if (completedDate > task.due_date) {
                acc[task.assignee_name].late++
            } else {
                acc[task.assignee_name].onTime++
            }
        }

        return acc
    }, {} as Record<string, { total: number; onTime: number; late: number }>)

    const statsArray = Object.entries(stats)
        .map(([name, data]) => ({
            name,
            ...data,
            onTimeRate: data.total > 0 ? (data.onTime / data.total) * 100 : 0,
        }))
        .sort((a, b) => b.onTimeRate - a.onTimeRate)

    const getBarStyle = (rate: number) => {
        if (rate >= 80) return { gradient: 'linear-gradient(90deg, #10b981, #34d399)', glow: 'rgba(16,185,129,0.25)' }
        if (rate >= 50) return { gradient: 'linear-gradient(90deg, #f59e0b, #fbbf24)', glow: 'rgba(245,158,11,0.25)' }
        return { gradient: 'linear-gradient(90deg, #ef4444, #f87171)', glow: 'rgba(239,68,68,0.25)' }
    }

    const getRateColor = (rate: number) => {
        if (rate >= 80) return 'text-emerald-400'
        if (rate >= 50) return 'text-yellow-400'
        return 'text-red-400'
    }

    const getEmoji = (rate: number) => {
        if (rate >= 90) return '🔥'
        if (rate >= 80) return '✅'
        if (rate >= 50) return '⚠️'
        return '❌'
    }

    return (
        <div className="glass-card p-5 card-hover">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                    <Clock className="w-5 h-5 text-purple-400" />
                    <h3 className="text-base font-semibold text-white">Tỉ Lệ Đúng Deadline</h3>
                </div>
            </div>

            {statsArray.length > 0 ? (
                <div className="space-y-3 stagger-children">
                    {statsArray.map((user, index) => {
                        const barStyle = getBarStyle(user.onTimeRate)
                        return (
                            <div
                                key={user.name}
                                className="p-3 bg-slate-700/15 rounded-xl border border-slate-700/25 hover:border-slate-600/40 transition-all duration-200"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs">{getEmoji(user.onTimeRate)}</span>
                                        <span className="text-sm font-medium text-white truncate">{user.name}</span>
                                    </div>
                                    <span className={`text-lg font-bold ${getRateColor(user.onTimeRate)}`}>
                                        {user.onTimeRate.toFixed(0)}%
                                    </span>
                                </div>

                                {/* Gradient progress bar */}
                                <div className="h-2.5 bg-slate-700/40 rounded-full overflow-hidden mb-2">
                                    <div
                                        className="h-full rounded-full animate-bar-grow"
                                        style={{
                                            width: `${user.onTimeRate}%`,
                                            background: barStyle.gradient,
                                            boxShadow: `0 0 8px ${barStyle.glow}`,
                                            animationDelay: `${index * 50}ms`,
                                        }}
                                    />
                                </div>

                                <div className="flex items-center gap-4 text-xs">
                                    <div className="flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                        <span className="text-emerald-400 font-medium">{user.onTime}</span>
                                        <span className="text-slate-500">đúng hạn</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3 text-red-400" />
                                        <span className="text-red-400 font-medium">{user.late}</span>
                                        <span className="text-slate-500">trễ</span>
                                    </div>
                                    <span className="text-slate-600 ml-auto">{user.total} tasks</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="text-center py-8 text-slate-500">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Chưa có dữ liệu deadline</p>
                </div>
            )}
        </div>
    )
}
