'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Save, Users, Shield, User, Loader2, Eye, Lightbulb } from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'

interface UserProfile {
    id: string
    email: string
    full_name: string | null
    role: string
    role_graphic: string | null
    created_at: string
}

export default function UsersPage() {
    const router = useRouter()
    const supabase = createClient()

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)
    const [currentUser, setCurrentUser] = useState<{ email: string; role: string } | null>(null)
    const [users, setUsers] = useState<UserProfile[]>([])
    const [editedUsers, setEditedUsers] = useState<Record<string, Partial<UserProfile>>>({})

    useEffect(() => {
        const loadData = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/login'); return }

            const { data: profile } = await supabase
                .from('profiles')
                .select('role, full_name, role_graphic')
                .eq('id', user.id)
                .single()

            const userRole = profile?.role || 'member'
            const userRoleGraphic = profile?.role_graphic || 'none'
            // Manager can access Users page if manager in either project
            const hasAccess = ['admin', 'manager'].includes(userRole) || ['admin', 'manager'].includes(userRoleGraphic)
            if (!hasAccess) {
                router.push('/dashboard')
                return
            }

            setCurrentUser({ email: user.email || '', role: userRole })

            const { data: allUsers } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: true })

            if (allUsers) setUsers(allUsers)
            setLoading(false)
        }
        loadData()
    }, [supabase, router])

    const handleFieldChange = (userId: string, field: string, value: string) => {
        setEditedUsers(prev => ({
            ...prev,
            [userId]: { ...prev[userId], [field]: value }
        }))
    }

    const handleSave = async (userId: string) => {
        const changes = editedUsers[userId]
        if (!changes) return
        setSaving(userId)

        const { error } = await supabase
            .from('profiles')
            .update(changes)
            .eq('id', userId)

        if (!error) {
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...changes } as UserProfile : u))
            setEditedUsers(prev => { const n = { ...prev }; delete n[userId]; return n })
            alert('Đã lưu thành công!')
        } else {
            alert('Lỗi khi lưu: ' + error.message)
        }
        setSaving(null)
    }

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'admin': return 'bg-red-500/20 text-red-300 border-red-500/30'
            case 'manager': return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            case 'idea_creator': return 'bg-violet-500/20 text-violet-300 border-violet-500/30'
            default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30'
        }
    }

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'admin': return Shield
            case 'manager': return Eye
            case 'idea_creator': return Lightbulb
            default: return User
        }
    }

    if (loading) {
        return (
            <DashboardLayout>
                <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-slate-400">Loading users...</p>
                    </div>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-slate-950">
                <div className="px-6 py-8">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-2xl font-bold text-white mb-2">Quản lý người dùng</h1>
                        <p className="text-slate-400">Phân quyền và cập nhật thông tin người dùng</p>
                        <p className="text-sm text-purple-400 mt-2">
                            Đang đăng nhập: {currentUser?.email}
                        </p>
                    </div>

                    {/* Role Legend */}
                    <div className="flex flex-wrap gap-4 mb-6">
                        <div className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <span className="text-slate-400">Creative Manager — Xem được cả hai team + Quản lý users</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                            <span className="text-slate-400">Admin Creative — Xem được các thành viên video</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
                            <span className="text-slate-400">Admin Design — Xem được các thành viên design</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-full bg-slate-500"></div>
                            <span className="text-slate-400">Member — Chỉ xem được chính mình</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                            <span className="text-slate-400">None — Không truy cập project</span>
                        </div>
                    </div>

                    {/* Users Table */}
                    <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-700/50">
                                        <th className="text-left py-4 px-5 text-sm font-medium text-slate-400">Email</th>
                                        <th className="text-left py-4 px-5 text-sm font-medium text-slate-400">Tên đầy đủ</th>
                                        <th className="text-center py-4 px-5 text-sm font-medium text-slate-400">
                                            <div className="flex items-center justify-center gap-1">
                                                🎬 <span>Video Creative</span>
                                            </div>
                                        </th>
                                        <th className="text-center py-4 px-5 text-sm font-medium text-slate-400">
                                            <div className="flex items-center justify-center gap-1">
                                                🎨 <span>Graphic Design</span>
                                            </div>
                                        </th>
                                        <th className="text-right py-4 px-5 text-sm font-medium text-slate-400">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(user => {
                                        const edited = editedUsers[user.id]
                                        const currentRole = (edited?.role || user.role) as string
                                        const currentRoleGraphic = (edited?.role_graphic !== undefined ? edited.role_graphic : user.role_graphic) as string || 'none'
                                        const currentFullName = edited?.full_name !== undefined ? (edited.full_name || '') : (user.full_name || '')
                                        const hasChanges = !!edited
                                        const RoleIcon = getRoleIcon(currentRole)

                                        return (
                                            <tr key={user.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                                                <td className="py-4 px-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg ${getRoleColor(currentRole)}`}>
                                                            <RoleIcon className="w-4 h-4" />
                                                        </div>
                                                        <span className="text-white font-medium text-sm">{user.email}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-5">
                                                    <input
                                                        type="text"
                                                        value={currentFullName}
                                                        onChange={e => handleFieldChange(user.id, 'full_name', e.target.value)}
                                                        placeholder="Nhập tên khớp Asana..."
                                                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    />
                                                </td>
                                                <td className="py-4 px-5">
                                                    <select
                                                        value={currentRole}
                                                        onChange={e => handleFieldChange(user.id, 'role', e.target.value)}
                                                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${getRoleColor(currentRole)} bg-slate-700/50 border-slate-600`}
                                                    >
                                                        <option value="admin">Creative Manager</option>
                                                        <option value="manager">Admin Creative</option>
                                                        <option value="member">Member</option>
                                                        <option value="idea_creator">Idea Creator</option>
                                                        <option value="none">None</option>
                                                    </select>
                                                </td>
                                                <td className="py-4 px-5">
                                                    <select
                                                        value={currentRoleGraphic}
                                                        onChange={e => handleFieldChange(user.id, 'role_graphic', e.target.value)}
                                                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${getRoleColor(currentRoleGraphic)} bg-slate-700/50 border-slate-600`}
                                                    >
                                                        <option value="admin">Admin Design</option>
                                                        <option value="manager">Manager</option>
                                                        <option value="member">Member</option>
                                                        <option value="none">None</option>
                                                    </select>
                                                </td>
                                                <td className="py-4 px-5 text-right">
                                                    {hasChanges && (
                                                        <button
                                                            onClick={() => handleSave(user.id)}
                                                            disabled={saving === user.id}
                                                            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                                                        >
                                                            {saving === user.id ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <Save className="w-4 h-4" />
                                                            )}
                                                            Lưu
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {users.length === 0 && (
                            <div className="text-center py-12 text-slate-500">
                                Chưa có người dùng nào
                            </div>
                        )}
                    </div>

                    {/* Note */}
                    <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                        <p className="text-amber-300 text-sm">
                            <strong>Lưu ý:</strong> Tên đầy đủ phải khớp chính xác với tên trong Asana để hệ thống lọc đúng data.
                            <br />
                            <strong>Creative Manager:</strong> Xem được cả hai team (Creative + Design) + Quản lý users.
                            <br />
                            <strong>Admin Creative:</strong> Xem được các thành viên video creative.
                            <br />
                            <strong>Admin Design:</strong> Xem được các thành viên design.
                            <br />
                            <strong>Member:</strong> Chỉ xem được chính mình.
                            <br />
                            <strong>None:</strong> Không truy cập project đó.
                        </p>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
