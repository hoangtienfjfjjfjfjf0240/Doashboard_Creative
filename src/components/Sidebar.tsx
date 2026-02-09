'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutTemplate, Target, Users, Calendar, History, Film, Palette, LogOut } from 'lucide-react'
import { useUser } from '@/contexts/UserContext'
import { createClient } from '@/lib/supabase/client'

export default function Sidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()
    const { user, canAccessProject } = useUser()
    const userRole = user?.role || 'member'
    const userRoleGraphic = user?.roleGraphic || 'member'
    const isGlobalAdmin = userRole === 'admin'
    const isCreativeAdmin = isGlobalAdmin || ['manager'].includes(userRole)
    const isGraphicAdmin = isGlobalAdmin || ['admin', 'manager'].includes(userRoleGraphic)

    const creativeItems = [
        { title: 'Overview', path: '/dashboard', icon: LayoutTemplate },
        { title: 'Mục tiêu Target', path: '/settings', icon: Target },
        ...(isCreativeAdmin ? [
            { title: 'Lịch sử Due Date', path: '/history', icon: History },
        ] : []),
    ]

    const graphicItems = [
        { title: 'Overview', path: '/graphic-dashboard', icon: LayoutTemplate },
        { title: 'Mục tiêu Target', path: '/graphic-settings', icon: Target },
        ...(isGraphicAdmin ? [
            { title: 'Lịch sử Due Date', path: '/graphic-history', icon: History },
        ] : []),
    ]

    const commonItems = [
        {
            title: 'Ngày Nghỉ',
            path: '/day-offs',
            icon: Calendar,
            roles: ['member', 'admin', 'manager', 'editor'],
        },
        {
            title: 'Quản lý Users',
            path: '/users',
            icon: Users,
            roles: ['admin'],
        },
    ]

    const filteredCommonItems = commonItems.filter(item =>
        item.roles.includes(userRole) || userRole === 'admin'
    )

    const showCreative = canAccessProject('creative')
    const showGraphic = canAccessProject('graphic')

    const renderMenuItem = (item: { title: string; path: string; icon: React.ComponentType<{ className?: string }> }) => {
        const isActive = pathname === item.path
        const Icon = item.icon
        return (
            <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${isActive
                    ? 'bg-purple-600 shadow-lg shadow-purple-900/50 text-white'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                    }`}
            >
                <Icon className={`w-5 h-5 transition-colors duration-200 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                <span className="font-medium text-sm">{item.title}</span>
                {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-sm animate-pulse" />
                )}
            </Link>
        )
    }

    return (
        <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0">
            {/* Logo Area */}
            <div className="p-6 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <Image
                        src="/ikame-logo.png"
                        alt="iKame Logo"
                        width={44}
                        height={44}
                        className="rounded-xl"
                    />
                    <div>
                        <h1 className="text-lg font-bold text-white leading-none">Creative</h1>
                        <span className="text-xs text-purple-400 font-medium">Dashboard</span>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {/* Video Creative Section */}
                {showCreative && (
                    <>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2 pt-1">
                            <Film className="w-3.5 h-3.5 text-orange-400" />
                            <span>Video Creative</span>
                        </div>
                        {creativeItems.map(renderMenuItem)}
                        <div className="my-3 border-b border-slate-800/70" />
                    </>
                )}

                {/* Graphic Design Section */}
                {showGraphic && (
                    <>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2 pt-1">
                            <Palette className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Graphic Design</span>
                        </div>
                        {graphicItems.map(renderMenuItem)}
                        <div className="my-3 border-b border-slate-800/70" />
                    </>
                )}

                {/* Common Section */}
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2 pt-1">
                    Chung
                </div>
                {filteredCommonItems.map(renderMenuItem)}
            </nav>

        </aside>
    )
}
