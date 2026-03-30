'use client'

import { useState } from 'react'
import { Clock, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

interface Task {
    assignee_name: string | null
    name?: string
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
    /** Only count tasks as "late" if due_date >= this date (yyyy-MM-dd). Tasks before this are always "on time". */
    lateStartDate?: string
}

interface LateTaskDetail {
    name: string
    asanaId: string
    dueDate: string
    completedAt: string
    reason: 'deadline_changed_after_due' | 'completed_late'
    reasonDetail: string
}

export default function DueDateStats({ tasks, dueDateChanges = [], lateStartDate }: DueDateStatsProps) {
    const [expandedUser, setExpandedUser] = useState<string | null>(null)

    // Build a map: task_id → list of due_date changes
    const changesByTask = new Map<string, DueDateChange[]>()
    dueDateChanges.forEach(change => {
        const list = changesByTask.get(change.task_id) || []
        list.push(change)
        changesByTask.set(change.task_id, list)
    })

    // NEW RULE: Only late if changed_at > old_due_date
    // (Removed old Case 1: new_due_date > old_due_date)
    const getTaskLateInfo = (taskId: string): { late: boolean; detail: string } => {
        const changes = changesByTask.get(taskId)
        if (!changes || changes.length === 0) return { late: false, detail: '' }

        const lateChange = changes.find(change => {
            if (!change.old_due_date || !change.changed_at) return false
            const oldDueDay = change.old_due_date.split('T')[0]
            const changedDay = change.changed_at.split('T')[0]
            // Only late if deadline was changed AFTER it had already passed
            return changedDay > oldDueDay
        })

        if (lateChange) {
            const oldDate = lateChange.old_due_date?.split('T')[0] || ''
            const changedDate = lateChange.changed_at?.split('T')[0] || ''
            return {
                late: true,
                detail: `Dời deadline sau hạn (hạn: ${formatDateShort(oldDate)}, dời: ${formatDateShort(changedDate)})`
            }
        }
        return { late: false, detail: '' }
    }

    const formatDateShort = (dateStr: string) => {
        try {
            return format(new Date(dateStr + 'T00:00:00'), 'dd/MM', { locale: vi })
        } catch {
            return dateStr
        }
    }

    // Build stats with late task details
    const statsMap: Record<string, {
        total: number
        onTime: number
        late: number
        lateTasks: LateTaskDetail[]
    }> = {}

    tasks.forEach(task => {
        if (!task.assignee_name || task.status !== 'done' || !task.completed_at || !task.due_date) return
        // Only count tasks from Feb 2026 onwards
        const dueDate = new Date(task.due_date)
        if (dueDate.getFullYear() < 2026 || (dueDate.getFullYear() === 2026 && dueDate.getMonth() < 1)) return

        const name = task.assignee_name
        if (!statsMap[name]) statsMap[name] = { total: 0, onTime: 0, late: 0, lateTasks: [] }
        statsMap[name].total++

        const taskId = task.asana_id || ''

        // If lateStartDate is set, tasks with due_date before that date are always "on time"
        if (lateStartDate && task.due_date < lateStartDate) {
            statsMap[name].onTime++
            return
        }

        const lateInfo = taskId ? getTaskLateInfo(taskId) : { late: false, detail: '' }

        if (lateInfo.late) {
            statsMap[name].late++
            statsMap[name].lateTasks.push({
                name: task.name || 'Unnamed task',
                asanaId: taskId,
                dueDate: task.due_date,
                completedAt: task.completed_at,
                reason: 'deadline_changed_after_due',
                reasonDetail: lateInfo.detail,
            })
        } else {
            const completedDate = task.completed_at.split('T')[0]
            if (completedDate > task.due_date) {
                statsMap[name].late++
                statsMap[name].lateTasks.push({
                    name: task.name || 'Unnamed task',
                    asanaId: taskId,
                    dueDate: task.due_date,
                    completedAt: task.completed_at,
                    reason: 'completed_late',
                    reasonDetail: `Hoàn thành muộn (hạn: ${formatDateShort(task.due_date)}, xong: ${formatDateShort(completedDate)})`,
                })
            } else {
                statsMap[name].onTime++
            }
        }
    })

    const statsArray = Object.entries(statsMap)
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

    const toggleExpanded = (name: string) => {
        setExpandedUser(prev => prev === name ? null : name)
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
                        const isExpanded = expandedUser === user.name
                        const hasLateTasks = user.lateTasks.length > 0
                        return (
                            <div key={user.name}>
                                <div
                                    className={`p-3 bg-slate-700/15 rounded-xl border transition-all duration-200 ${
                                        hasLateTasks
                                            ? 'cursor-pointer hover:border-slate-500/50 border-slate-700/25'
                                            : 'border-slate-700/25'
                                    } ${isExpanded ? 'border-purple-500/40 bg-slate-700/25' : ''}`}
                                    onClick={() => hasLateTasks && toggleExpanded(user.name)}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs">{getEmoji(user.onTimeRate)}</span>
                                            <span className="text-sm font-medium text-white truncate">{user.name}</span>
                                            {hasLateTasks && (
                                                isExpanded
                                                    ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                                                    : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                                            )}
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

                                {/* Expandable late task details */}
                                {isExpanded && hasLateTasks && (
                                    <div className="mt-1 ml-2 mr-2 mb-1 space-y-1 animate-in slide-in-from-top-2 duration-200">
                                        <div className="text-xs text-slate-500 font-medium px-3 pt-2 pb-1">
                                            Chi tiết {user.lateTasks.length} task trễ:
                                        </div>
                                        {user.lateTasks.map((task, i) => (
                                            <div
                                                key={`${task.asanaId}-${i}`}
                                                className="flex items-start gap-2 px-3 py-2 bg-slate-800/40 rounded-lg border border-slate-700/30 text-xs"
                                            >
                                                <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-slate-200 truncate" title={task.name}>
                                                        {task.name}
                                                    </div>
                                                    <div className="text-slate-500 mt-0.5">
                                                        {task.reasonDetail}
                                                    </div>
                                                </div>
                                                {task.asanaId && (
                                                    <a
                                                        href={`https://app.asana.com/0/0/${task.asanaId}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="text-purple-400 hover:text-purple-300 shrink-0 mt-0.5"
                                                        title="Mở trên Asana"
                                                    >
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
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
