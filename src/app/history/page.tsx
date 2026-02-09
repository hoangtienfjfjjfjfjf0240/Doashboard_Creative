'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { History, Search, ArrowRight, Calendar, User } from 'lucide-react'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import DashboardLayout from '@/components/DashboardLayout'

interface DueDateChange {
    id: string
    task_id: string
    task_name: string
    assignee_name: string
    old_due_date: string | null
    new_due_date: string | null
    changed_by: string
    changed_at: string
    reason: string | null
}

export default function HistoryPage() {
    const router = useRouter()
    const supabase = createClient()

    const [loading, setLoading] = useState(true)
    const [changes, setChanges] = useState<DueDateChange[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [filterAssignee, setFilterAssignee] = useState('')
    const [assignees, setAssignees] = useState<string[]>([])

    useEffect(() => {
        const fetchHistory = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }

            // Check role — only admin/lead can view
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single()

            if (!profile || !['admin', 'lead'].includes(profile.role)) {
                router.push('/dashboard')
                return
            }

            const { data, error } = await supabase
                .from('due_date_changes')
                .select('*')
                .eq('project_type', 'creative')
                .order('changed_at', { ascending: false })
                .limit(200)

            if (data && !error) {
                setChanges(data)
                // Get unique assignees for filter
                const uniqueAssignees = [...new Set(data.map(c => c.assignee_name).filter(Boolean))]
                setAssignees(uniqueAssignees.sort())
            }
            setLoading(false)
        }
        fetchHistory()
    }, [supabase, router])

    // Filter changes
    const filteredChanges = changes.filter(c => {
        const matchesSearch = !searchQuery ||
            c.task_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.assignee_name?.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesAssignee = !filterAssignee || c.assignee_name === filterAssignee
        return matchesSearch && matchesAssignee
    })

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'Chưa có'
        try {
            return format(new Date(dateStr), 'dd/MM/yyyy', { locale: vi })
        } catch {
            return dateStr
        }
    }

    const formatDateTime = (dateStr: string) => {
        try {
            return format(new Date(dateStr), 'dd/MM/yyyy HH:mm', { locale: vi })
        } catch {
            return dateStr
        }
    }

    if (loading) {
        return (
            <DashboardLayout>
                <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-slate-400">Đang tải lịch sử...</p>
                    </div>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-slate-950">
                {/* Header */}
                <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <History className="w-6 h-6 text-amber-400" />
                            <div>
                                <h2 className="text-xl font-bold text-white">Lịch sử thay đổi Due Date</h2>
                                <p className="text-sm text-slate-400">
                                    Theo dõi ai đã thay đổi deadline của task
                                </p>
                            </div>
                        </div>
                        <div className="text-sm text-slate-500">
                            Tổng: {filteredChanges.length} thay đổi
                        </div>
                    </div>
                </header>

                <main className="p-6">
                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-4 mb-6 bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Tìm theo tên task hoặc người thực hiện..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>

                        {/* Assignee filter */}
                        <select
                            value={filterAssignee}
                            onChange={(e) => setFilterAssignee(e.target.value)}
                            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                            <option value="">Tất cả thành viên</option>
                            {assignees.map(a => (
                                <option key={a} value={a}>{a}</option>
                            ))}
                        </select>
                    </div>

                    {/* Changes Table */}
                    {filteredChanges.length === 0 ? (
                        <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-slate-700/50">
                            <History className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-slate-400">Chưa có lịch sử thay đổi</h3>
                            <p className="text-sm text-slate-500 mt-2">
                                Khi due date của task bị thay đổi, lịch sử sẽ được ghi lại tại đây
                            </p>
                        </div>
                    ) : (
                        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-700/30">
                                        <tr>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                                Task
                                            </th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                                <div className="flex items-center gap-1">
                                                    <User className="w-3.5 h-3.5" />
                                                    Người thực hiện
                                                </div>
                                            </th>
                                            <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                                Due Date cũ
                                            </th>
                                            <th className="text-center px-1 py-3 text-xs font-semibold text-slate-400">
                                            </th>
                                            <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                                Due Date mới
                                            </th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                                Thay đổi bởi
                                            </th>
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    Thời gian
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {filteredChanges.map((change) => {
                                            // Determine if due date was pushed later or earlier
                                            let arrow = 'text-slate-400'
                                            if (change.old_due_date && change.new_due_date) {
                                                const oldD = new Date(change.old_due_date)
                                                const newD = new Date(change.new_due_date)
                                                arrow = newD > oldD ? 'text-red-400' : 'text-green-400'
                                            }

                                            return (
                                                <tr key={change.id} className="hover:bg-slate-700/20 transition-colors">
                                                    <td className="px-4 py-3 text-sm text-white max-w-[300px]">
                                                        <div className="truncate" title={change.task_name}>
                                                            {change.task_name}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-300">
                                                        {change.assignee_name || '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className="inline-block px-2 py-1 bg-slate-700/50 rounded-lg text-sm text-slate-300">
                                                            {formatDate(change.old_due_date)}
                                                        </span>
                                                    </td>
                                                    <td className="px-1 py-3 text-center">
                                                        <ArrowRight className={`w-4 h-4 mx-auto ${arrow}`} />
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`inline-block px-2 py-1 rounded-lg text-sm font-medium ${arrow === 'text-red-400'
                                                            ? 'bg-red-500/20 text-red-300'
                                                            : arrow === 'text-green-400'
                                                                ? 'bg-green-500/20 text-green-300'
                                                                : 'bg-slate-700/50 text-slate-300'
                                                            }`}>
                                                            {formatDate(change.new_due_date)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-amber-300">
                                                        {change.changed_by}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                                                        {formatDateTime(change.changed_at)}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Legend */}
                    <div className="mt-4 flex flex-wrap items-center gap-6 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                            <ArrowRight className="w-4 h-4 text-red-400" />
                            <span>Due date bị dời lại (trễ hơn)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <ArrowRight className="w-4 h-4 text-green-400" />
                            <span>Due date được đẩy sớm hơn</span>
                        </div>
                    </div>
                </main>
            </div>
        </DashboardLayout>
    )
}
