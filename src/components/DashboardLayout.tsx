'use client'

import React from 'react'
import Sidebar from './Sidebar'
import AgentChatWidget from './AgentChatWidget'

interface DashboardLayoutProps {
    children: React.ReactNode
    hideAgent?: boolean
}

export default function DashboardLayout({ children, hideAgent = false }: DashboardLayoutProps) {
    return (
        <div className="flex h-screen bg-slate-950 overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto min-w-0 bg-slate-950">
                {children}
            </main>
            {!hideAgent && <AgentChatWidget />}
        </div>
    )
}

