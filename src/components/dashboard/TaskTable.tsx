'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { ChevronDown, ChevronUp, ChevronRight, AlertCircle, CheckCircle, ExternalLink, MessageCircle, Loader2 } from 'lucide-react'

interface AsanaComment {
    id: string
    text: string
    created_at: string
    author: string
}

interface Task {
    id: string
    asana_id?: string
    name: string
    assignee_name: string | null
    video_type: string | null
    video_count: number
    points: number
    due_date: string | null
    completed_at: string | null
    status: string
    description?: string | null
}

interface TaskTableProps {
    doneTasks: Task[]
    notDoneTasks: Task[]
    showOverdueOnly?: boolean
}

export default function TaskTable({ doneTasks, notDoneTasks, showOverdueOnly = false }: TaskTableProps) {
    const [activeTab, setActiveTab] = useState<'not_done' | 'done'>('not_done')
    const [sortField, setSortField] = useState<'due_date' | 'points' | 'assignee_name'>('due_date')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
    const [filterOverdue, setFilterOverdue] = useState(showOverdueOnly)
    const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
    const [comments, setComments] = useState<Record<string, AsanaComment[]>>({})
    const [commentsLoading, setCommentsLoading] = useState<string | null>(null)

    // Fetch comments when task is expanded
    useEffect(() => {
        if (!expandedTaskId) return

        // Find the task to get asana_id
        const allTasks = [...doneTasks, ...notDoneTasks]
        const task = allTasks.find(t => t.id === expandedTaskId)
        if (!task?.asana_id || comments[expandedTaskId]) return

        setCommentsLoading(expandedTaskId)
        fetch(`/api/asana/comments?taskGid=${task.asana_id}`)
            .then(res => res.json())
            .then(data => {
                if (data.comments) {
                    setComments(prev => ({ ...prev, [expandedTaskId]: data.comments }))
                }
            })
            .catch(err => {
                console.error('Failed to load comments:', err)
                setComments(prev => ({ ...prev, [expandedTaskId]: [] }))
            })
            .finally(() => setCommentsLoading(null))
    }, [expandedTaskId, doneTasks, notDoneTasks])

    const today = new Date().toISOString().split('T')[0]

    const filteredNotDone = notDoneTasks.filter(task => {
        if (filterOverdue && task.due_date) {
            return task.due_date < today
        }
        return true
    })

    const sortTasks = (tasks: Task[]) => {
        return [...tasks].sort((a, b) => {
            let aVal: string | number = ''
            let bVal: string | number = ''

            if (sortField === 'due_date') {
                aVal = a.due_date || '9999-12-31'
                bVal = b.due_date || '9999-12-31'
            } else if (sortField === 'points') {
                aVal = a.points
                bVal = b.points
            } else {
                aVal = a.assignee_name || ''
                bVal = b.assignee_name || ''
            }

            if (sortDir === 'asc') {
                return aVal < bVal ? -1 : 1
            }
            return aVal > bVal ? -1 : 1
        })
    }

    const toggleSort = (field: typeof sortField) => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDir('asc')
        }
    }

    const toggleExpand = (taskId: string) => {
        setExpandedTaskId(expandedTaskId === taskId ? null : taskId)
    }

    const SortIcon = ({ field }: { field: typeof sortField }) => {
        if (sortField !== field) return null
        return sortDir === 'asc' ?
            <ChevronUp className="w-4 h-4" /> :
            <ChevronDown className="w-4 h-4" />
    }

    const getVideoTypeColor = (type: string | null) => {
        const colors: Record<string, string> = {
            S1: 'bg-slate-500/20 text-slate-300',
            S2A: 'bg-blue-500/20 text-blue-300',
            S2B: 'bg-cyan-500/20 text-cyan-300',
            S3A: 'bg-emerald-500/20 text-emerald-300',
            S3B: 'bg-green-500/20 text-green-300',
            S4: 'bg-yellow-500/20 text-yellow-300',
            S5: 'bg-orange-500/20 text-orange-300',
            S6: 'bg-red-500/20 text-red-300',
        }
        return colors[type || ''] || 'bg-slate-600/20 text-slate-400'
    }

    const getAsanaUrl = (asanaId?: string) => {
        if (!asanaId) return null
        return `https://app.asana.com/0/0/${asanaId}`
    }

    const currentTasks = activeTab === 'done' ? sortTasks(doneTasks) : sortTasks(filteredNotDone)

    return (
        <div className="glass-card overflow-hidden">
            {/* Tabs */}
            <div className="flex items-center border-b border-slate-700/40">
                <button
                    onClick={() => setActiveTab('not_done')}
                    className={`flex-1 px-6 py-4 text-sm font-medium transition-all duration-200 ${activeTab === 'not_done'
                        ? 'text-white bg-slate-700/25 border-b-2 border-purple-500'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/10'
                        }`}
                >
                    <span className="flex items-center justify-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400" />
                        Chưa Done ({filteredNotDone.length})
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('done')}
                    className={`flex-1 px-6 py-4 text-sm font-medium transition-all duration-200 ${activeTab === 'done'
                        ? 'text-white bg-slate-700/25 border-b-2 border-purple-500'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/10'
                        }`}
                >
                    <span className="flex items-center justify-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        Done ({doneTasks.length})
                    </span>
                </button>
            </div>

            {/* Filter for Not Done */}
            {activeTab === 'not_done' && (
                <div className="px-4 py-2 border-b border-slate-700/50 bg-slate-800/30">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={filterOverdue}
                            onChange={(e) => setFilterOverdue(e.target.checked)}
                            className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-purple-500 focus:ring-purple-500"
                        />
                        <span className="text-sm text-slate-400">Show overdue tasks only</span>
                    </label>
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-700/30">
                        <tr>
                            <th className="w-10 px-2 py-3"></th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Task Name
                            </th>
                            <th
                                className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white"
                                onClick={() => toggleSort('assignee_name')}
                            >
                                <span className="flex items-center gap-1">
                                    Assignee <SortIcon field="assignee_name" />
                                </span>
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Video Type
                            </th>
                            <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Qty
                            </th>
                            <th
                                className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white"
                                onClick={() => toggleSort('points')}
                            >
                                <span className="flex items-center justify-center gap-1">
                                    Points <SortIcon field="points" />
                                </span>
                            </th>
                            <th
                                className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider cursor-pointer hover:text-white"
                                onClick={() => toggleSort('due_date')}
                            >
                                <span className="flex items-center gap-1">
                                    {activeTab === 'done' ? 'Due Date' : 'Due Date'} <SortIcon field="due_date" />
                                </span>
                            </th>
                            <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                                Asana
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {currentTasks.map((task) => {
                            const isOverdue = activeTab === 'not_done' && task.due_date && task.due_date < today
                            const isExpanded = expandedTaskId === task.id
                            const asanaUrl = getAsanaUrl(task.asana_id)

                            return (
                                <React.Fragment key={task.id}>
                                    <tr key={task.id} className="hover:bg-slate-700/15 transition-colors duration-150">
                                        <td className="px-2 py-3">
                                            <button
                                                onClick={() => toggleExpand(task.id)}
                                                className="p-1 hover:bg-slate-600/50 rounded transition-colors"
                                                title={isExpanded ? 'Thu gọn' : 'Xem chi tiết'}
                                            >
                                                <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-sm text-white truncate max-w-xs" title={task.name}>
                                                {task.name}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-slate-300">{task.assignee_name || '—'}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {task.video_type ? (
                                                <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium ${getVideoTypeColor(task.video_type)}`}>
                                                    {task.video_type}
                                                </span>
                                            ) : (
                                                <span className="text-slate-500">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-sm text-slate-300">{task.video_count}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-sm font-medium text-purple-400">{(task.points || 0) % 1 === 0 ? (task.points || 0) : (task.points || 0).toFixed(1)}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {task.due_date ? (
                                                <span className={`text-sm ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
                                                    {format(parseISO(task.due_date), 'MMM d, yyyy')}
                                                    {isOverdue && ' ⚠️'}
                                                </span>
                                            ) : (
                                                <span className="text-slate-500">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {asanaUrl ? (
                                                <a
                                                    href={asanaUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-xs transition-colors"
                                                    title="Mở trong Asana"
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                    Mở
                                                </a>
                                            ) : (
                                                <span className="text-slate-500">—</span>
                                            )}
                                        </td>
                                    </tr>
                                    {/* Expandable Description + Comments Row */}
                                    {isExpanded && (
                                        <tr key={`${task.id}-desc`} className="bg-slate-700/10">
                                            <td colSpan={8} className="px-6 py-4">
                                                <div className="flex flex-col gap-4">
                                                    {/* Description + Asana Link */}
                                                    <div className="flex gap-4">
                                                        <div className="flex-1">
                                                            <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Mô tả</h4>
                                                            <p className="text-sm text-slate-300 whitespace-pre-wrap">
                                                                {task.description || 'Không có mô tả'}
                                                            </p>
                                                        </div>
                                                        {asanaUrl && (
                                                            <div className="shrink-0">
                                                                <a
                                                                    href={asanaUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-all"
                                                                >
                                                                    <ExternalLink className="w-4 h-4" />
                                                                    Xem trong Asana
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Comments Section */}
                                                    <div className="border-t border-slate-700/50 pt-4">
                                                        <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3 flex items-center gap-2">
                                                            <MessageCircle className="w-4 h-4" />
                                                            Bình luận Asana
                                                            {comments[task.id] && (
                                                                <span className="text-purple-400">({comments[task.id].length})</span>
                                                            )}
                                                        </h4>

                                                        {commentsLoading === task.id ? (
                                                            <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                                Đang tải bình luận...
                                                            </div>
                                                        ) : comments[task.id]?.length ? (
                                                            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                                                                {comments[task.id].map((comment) => (
                                                                    <div key={comment.id} className="bg-slate-800/60 rounded-xl px-4 py-3 border border-slate-700/40">
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <span className="text-xs font-semibold text-purple-300">{comment.author}</span>
                                                                            <span className="text-xs text-slate-500">
                                                                                {format(parseISO(comment.created_at), 'dd/MM/yyyy HH:mm')}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{comment.text}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm text-slate-500 py-1">Chưa có bình luận</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )
                        })}
                        {currentTasks.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                                    No tasks found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
