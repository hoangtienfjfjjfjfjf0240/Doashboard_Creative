'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Shield, User, Loader2, Eye, Lightbulb } from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import { createClient } from '@/lib/supabase/client'

interface UserProfile {
    id: string
    email: string
    full_name: string | null
    role: string
    role_creative: string | null
    role_graphic: string | null
    created_at: string
}

function getRoleColor(role: string) {
    switch (role) {
        case 'admin':
            return 'bg-red-500/20 text-red-300 border-red-500/30'
        case 'manager':
            return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
        case 'idea_creator':
            return 'bg-violet-500/20 text-violet-300 border-violet-500/30'
        case 'none':
            return 'bg-slate-800 text-slate-400 border-slate-700'
        default:
            return 'bg-slate-500/20 text-slate-300 border-slate-500/30'
    }
}

function getRoleIcon(role: string) {
    switch (role) {
        case 'admin':
            return Shield
        case 'manager':
            return Eye
        case 'idea_creator':
            return Lightbulb
        default:
            return User
    }
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
            if (!user) {
                router.push('/login')
                return
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('role, role_creative, full_name, role_graphic')
                .eq('id', user.id)
                .single()

            const userRole = profile?.role || 'member'
            const userRoleCreative = profile?.role_creative || userRole
            const userRoleGraphic = profile?.role_graphic || 'none'
            const hasAccess =
                ['admin', 'manager'].includes(userRole)
                || ['admin', 'manager'].includes(userRoleCreative)
                || ['admin', 'manager'].includes(userRoleGraphic)

            if (!hasAccess) {
                router.push('/dashboard')
                return
            }

            setCurrentUser({ email: user.email || '', role: userRole })

            const { data: allUsers } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: true })

            if (allUsers) {
                setUsers(allUsers as UserProfile[])
            }

            setLoading(false)
        }

        void loadData()
    }, [router, supabase])

    const handleFieldChange = (userId: string, field: keyof UserProfile, value: string) => {
        setEditedUsers(prev => ({
            ...prev,
            [userId]: {
                ...prev[userId],
                [field]: value,
            },
        }))
    }

    const handleCreativeRoleChange = (userId: string, value: string, keepIdeaCreator: boolean) => {
        const baseRole = value === 'none' ? 'member' : value

        setEditedUsers(prev => ({
            ...prev,
            [userId]: {
                ...prev[userId],
                role: baseRole,
                role_creative: keepIdeaCreator ? 'idea_creator' : value,
            },
        }))
    }

    const handleIdeaCreatorChange = (userId: string, enabled: boolean, fallbackCreativeRole: string) => {
        const normalizedCreativeRole = fallbackCreativeRole === 'none' ? 'member' : fallbackCreativeRole
        const baseRole = ['admin', 'manager'].includes(normalizedCreativeRole) ? 'member' : normalizedCreativeRole

        setEditedUsers(prev => ({
            ...prev,
            [userId]: {
                ...prev[userId],
                role: enabled ? baseRole : normalizedCreativeRole,
                role_creative: enabled ? 'idea_creator' : normalizedCreativeRole,
            },
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
            setUsers(prev => prev.map(item => item.id === userId ? { ...item, ...changes } as UserProfile : item))
            setEditedUsers(prev => {
                const next = { ...prev }
                delete next[userId]
                return next
            })
            alert('Da luu thanh cong!')
        } else {
            alert(`Loi khi luu: ${error.message}`)
        }

        setSaving(null)
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
                    <div className="mb-8">
                        <h1 className="text-2xl font-bold text-white mb-2">Quan ly nguoi dung</h1>
                        <p className="text-slate-400">Phan quyen va cap nhat thong tin nguoi dung</p>
                        <p className="text-sm text-purple-400 mt-2">
                            Dang dang nhap: {currentUser?.email}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-4 mb-6">
                        <div className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <span className="text-slate-400">Creative Manager: xem ca hai team va quan ly users</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-full bg-amber-500" />
                            <span className="text-slate-400">Admin Creative: xem cac thanh vien video</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-full bg-violet-500" />
                            <span className="text-slate-400">Idea Creator: chi xem Benchmark Creative va Signal Dashboard</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-full bg-cyan-500" />
                            <span className="text-slate-400">Admin Design: xem cac thanh vien design</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-full bg-slate-500" />
                            <span className="text-slate-400">Member: chi xem duoc chinh minh</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-full bg-slate-700" />
                            <span className="text-slate-400">None: khong truy cap project</span>
                        </div>
                    </div>

                    <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1200px]">
                                <thead>
                                    <tr className="border-b border-slate-700/50">
                                        <th className="text-left py-4 px-5 text-sm font-medium text-slate-400">Email</th>
                                        <th className="text-left py-4 px-5 text-sm font-medium text-slate-400">Ten day du</th>
                                        <th className="text-center py-4 px-5 text-sm font-medium text-slate-400">Video Creative</th>
                                        <th className="text-center py-4 px-5 text-sm font-medium text-slate-400">Idea Creator</th>
                                        <th className="text-center py-4 px-5 text-sm font-medium text-slate-400">Graphic Design</th>
                                        <th className="text-right py-4 px-5 text-sm font-medium text-slate-400">Thao tac</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(user => {
                                        const edited = editedUsers[user.id]
                                        const creativeRole = (edited?.role_creative !== undefined ? edited.role_creative : user.role_creative) || user.role || 'member'
                                        const currentRole = (edited?.role || user.role) as string
                                        const currentVideoCreativeRole = creativeRole === 'idea_creator' ? 'member' : creativeRole
                                        const currentIdeaCreatorRole = creativeRole === 'idea_creator' ? 'idea_creator' : 'none'
                                        const currentRoleGraphic = (edited?.role_graphic !== undefined ? edited.role_graphic : user.role_graphic) || 'none'
                                        const currentFullName = edited?.full_name !== undefined ? (edited.full_name || '') : (user.full_name || '')
                                        const hasChanges = Boolean(edited)
                                        const displayRole = currentIdeaCreatorRole === 'idea_creator' ? 'idea_creator' : currentRole
                                        const RoleIcon = getRoleIcon(displayRole)

                                        return (
                                            <tr key={user.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                                                <td className="py-4 px-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg border ${getRoleColor(displayRole)}`}>
                                                            <RoleIcon className="w-4 h-4" />
                                                        </div>
                                                        <span className="text-white font-medium text-sm">{user.email}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-5">
                                                    <input
                                                        type="text"
                                                        value={currentFullName}
                                                        onChange={event => handleFieldChange(user.id, 'full_name', event.target.value)}
                                                        placeholder="Nhap ten khop Asana..."
                                                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                    />
                                                </td>
                                                <td className="py-4 px-5">
                                                    <select
                                                        value={currentVideoCreativeRole}
                                                        onChange={event => handleCreativeRoleChange(user.id, event.target.value, currentIdeaCreatorRole === 'idea_creator')}
                                                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${getRoleColor(currentVideoCreativeRole)} bg-slate-700/50 border-slate-600`}
                                                    >
                                                        <option value="admin">Creative Manager</option>
                                                        <option value="manager">Admin Creative</option>
                                                        <option value="member">Member</option>
                                                        <option value="none">None</option>
                                                    </select>
                                                </td>
                                                <td className="py-4 px-5">
                                                    <select
                                                        value={currentIdeaCreatorRole}
                                                        onChange={event => handleIdeaCreatorChange(user.id, event.target.value === 'idea_creator', currentVideoCreativeRole)}
                                                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 ${getRoleColor(currentIdeaCreatorRole)} bg-slate-700/50 border-slate-600`}
                                                    >
                                                        <option value="none">None</option>
                                                        <option value="idea_creator">Idea Creator</option>
                                                    </select>
                                                </td>
                                                <td className="py-4 px-5">
                                                    <select
                                                        value={currentRoleGraphic}
                                                        onChange={event => handleFieldChange(user.id, 'role_graphic', event.target.value)}
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
                                                            onClick={() => void handleSave(user.id)}
                                                            disabled={saving === user.id}
                                                            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                                                        >
                                                            {saving === user.id ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <Save className="w-4 h-4" />
                                                            )}
                                                            Luu
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
                                Chua co nguoi dung nao
                            </div>
                        )}
                    </div>

                    <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                        <p className="text-amber-300 text-sm">
                            <strong>Luu y:</strong> Ten day du phai khop voi ten trong Asana de he thong loc dung data.
                            <br />
                            <strong>Video Creative:</strong> quan ly quyen team creative thong thuong.
                            <br />
                            <strong>Idea Creator:</strong> tach rieng de de nhin va se uu tien vao 2 man Benchmark Creative, Signal Dashboard.
                            <br />
                            <strong>Graphic Design:</strong> quan ly quyen team design.
                        </p>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
