'use client'

import DashboardLayout from '@/components/DashboardLayout'
import AgentChatWidget from '@/components/AgentChatWidget'

export default function AgentPage() {
    return (
        <DashboardLayout hideAgent>
            <div className="min-h-screen bg-slate-950 p-6">
                <div className="mx-auto max-w-4xl">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-white">AI Report Agent</h1>
                        <p className="mt-1 text-sm text-slate-400">
                            Bản mở rộng của bot chat. Bot nổi vẫn nằm ở góc phải dưới các màn dashboard.
                        </p>
                    </div>
                    <AgentChatWidget mode="page" />
                </div>
            </div>
        </DashboardLayout>
    )
}
