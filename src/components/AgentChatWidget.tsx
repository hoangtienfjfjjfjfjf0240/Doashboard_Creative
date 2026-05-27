'use client'

import { FormEvent, useMemo, useState } from 'react'
import { BarChart3, Bot, ChevronDown, Loader2, Maximize2, Minimize2, Send, Sparkles, X } from 'lucide-react'
import { useUser } from '@/contexts/UserContext'

type ProjectScope = 'all' | 'creative' | 'graphic'
type RangePreset = 'week' | 'month' | 'last_30_days' | 'all'

interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
    aiUsed?: boolean
}

interface MemberReport {
    name: string
    project: 'creative' | 'graphic'
    totalTasks: number
    doneTasks: number
    notDoneTasks: number
    doneRate: number
    points: number
    targetAfterDayOffs: number
    achievedRate: number
    gap: number
    overdueTasks: number
}

interface AgentReport {
    range: {
        label: string
        start: string
        end: string
    }
    team: {
        totalTasks: number
        doneTasks: number
        notDoneTasks: number
        doneRate: number
        points: number
        targetAfterDayOffs: number
        achievedRate: number
        gap: number
        overdueTasks: number
    }
    members: MemberReport[]
}

interface AgentResponse {
    answer: string
    aiUsed: boolean
    report: AgentReport
}

interface AgentChatWidgetProps {
    mode?: 'floating' | 'page'
}

const quickPrompts = [
    {
        icon: '📊',
        text: 'Tóm tắt tình hình team tháng này',
    },
    {
        icon: '✅',
        text: 'Tỉ lệ done từng member ra sao?',
    },
    {
        icon: '🎯',
        text: 'Ai đang thiếu target nhiều nhất?',
    },
    {
        icon: '⚠️',
        text: 'Task overdue nào cần xử lý gấp?',
    },
    {
        icon: '🔁',
        text: 'So sánh Creative và Graphic',
    },
]

const baseProjectOptions: { value: ProjectScope; label: string }[] = [
    { value: 'all', label: 'Team của bạn' },
    { value: 'creative', label: 'Creative' },
    { value: 'graphic', label: 'Graphic' },
]

const rangeOptions: { value: RangePreset; label: string }[] = [
    { value: 'month', label: 'Tháng này' },
    { value: 'week', label: 'Tuần này' },
    { value: 'last_30_days', label: '30 ngày' },
    { value: 'all', label: 'Từ đầu kỳ' },
]

function formatPoint(value: number) {
    const rounded = Math.round(value * 10) / 10
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function formatPercent(value: number) {
    return `${formatPoint(value)}%`
}

function isManagerRole(role?: string | null) {
    return Boolean(role && ['admin', 'lead', 'manager'].includes(role))
}

function canManageProject(
    user: { role: string; roleCreative: string; roleGraphic: string } | null,
    project: 'creative' | 'graphic'
) {
    if (!user) return false
    if (project === 'creative') {
        return isManagerRole(user.role) || isManagerRole(user.roleCreative)
    }
    return ['admin', 'lead'].includes(user.role) || isManagerRole(user.roleGraphic)
}

export default function AgentChatWidget({ mode = 'floating' }: AgentChatWidgetProps) {
    const { user, loading: userLoading } = useUser()
    const [open, setOpen] = useState(mode === 'page')
    const [expanded, setExpanded] = useState(mode === 'page')
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState('')
    const [project, setProject] = useState<ProjectScope>('all')
    const [range, setRange] = useState<RangePreset>('month')
    const [loading, setLoading] = useState(false)
    const [lastReport, setLastReport] = useState<AgentReport | null>(null)
    const [error, setError] = useState<string | null>(null)

    const canManageCreative = canManageProject(user, 'creative')
    const canManageGraphic = canManageProject(user, 'graphic')
    const canUseAgent = canManageCreative || canManageGraphic

    const projectOptions = useMemo(() => {
        return baseProjectOptions.filter(option => {
            if (option.value === 'all') return canUseAgent
            if (option.value === 'creative') return canManageCreative
            return canManageGraphic
        })
    }, [canManageCreative, canManageGraphic, canUseAgent])

    const membersToWatch = useMemo(() => {
        return [...(lastReport?.members || [])].sort((a, b) => a.gap - b.gap).slice(0, 4)
    }, [lastReport])

    async function askAgent(question: string) {
        if (!question.trim() || loading) return
        const userMessage = question.trim()
        setOpen(true)
        setInput('')
        setError(null)
        setLoading(true)
        setMessages(prev => [...prev, { role: 'user', content: userMessage }])

        try {
            const response = await fetch('/api/agent/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage, project, range }),
            })

            const payload = await response.json()
            if (!response.ok) {
                throw new Error(payload?.error || 'Agent request failed')
            }

            const result = payload as AgentResponse
            setLastReport(result.report)
            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    content: result.answer,
                    aiUsed: result.aiUsed,
                },
            ])
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Không gọi được agent'
            setError(message)
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Không lấy được report: ${message}`,
                aiUsed: false,
            }])
        } finally {
            setLoading(false)
        }
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        askAgent(input)
    }

    const panelClass = mode === 'page'
        ? 'relative w-full h-[calc(100vh-140px)] max-h-[820px]'
        : `${expanded ? 'w-[min(720px,calc(100vw-32px))] h-[min(760px,calc(100vh-32px))]' : 'w-[min(430px,calc(100vw-24px))] h-[min(640px,calc(100vh-24px))]'} fixed bottom-6 right-6 z-50 shadow-2xl shadow-purple-950/40`

    if (userLoading) {
        return mode === 'floating'
            ? null
            : (
                <section className={`${panelClass} flex items-center justify-center rounded-[28px] border border-slate-800 bg-slate-900 text-slate-300`}>
                    <div className="flex items-center gap-3 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                        Đang kiểm tra quyền truy cập...
                    </div>
                </section>
            )
    }

    if (!canUseAgent) {
        return mode === 'floating'
            ? null
            : (
                <section className={`${panelClass} flex items-center justify-center rounded-[28px] border border-slate-800 bg-slate-900 p-6 text-center`}>
                    <div>
                        <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-purple-500/15 flex items-center justify-center">
                            <Bot className="w-6 h-6 text-purple-300" />
                        </div>
                        <h2 className="text-lg font-bold text-white">Chưa có quyền dùng AI Report Agent</h2>
                        <p className="mt-2 max-w-md text-sm text-slate-400">
                            Phần report tổng hợp đang chỉ mở cho manager/admin/lead của team.
                        </p>
                    </div>
                </section>
            )
    }

    if (mode === 'floating' && !open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="fixed bottom-6 right-6 z-50 group flex items-center gap-3 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-4 text-white shadow-2xl shadow-purple-950/40 hover:from-violet-500 hover:to-purple-500 transition-all"
            >
                <div className="relative">
                    <Bot className="w-6 h-6" />
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-300 ring-2 ring-purple-600" />
                </div>
                <div className="text-left">
                    <div className="text-sm font-bold leading-none">AI Report</div>
                    <div className="text-xs text-purple-100/80">Hỏi tình hình team</div>
                </div>
            </button>
        )
    }

    return (
        <section className={`${panelClass} overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 text-slate-900`}>
            <div className="flex h-full flex-col">
                <header className="bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-4 text-white">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-base font-bold leading-tight">AI Report Agent</h2>
                                <p className="text-xs text-purple-100 truncate">Supabase data · Gemini · Team report</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {mode === 'floating' && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setExpanded(prev => !prev)}
                                        className="h-9 w-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center"
                                        title={expanded ? 'Thu nhỏ' : 'Phóng to'}
                                    >
                                        {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setOpen(false)}
                                        className="h-9 w-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center"
                                        title="Đóng"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
                    <SelectPill value={project} onChange={value => setProject(value as ProjectScope)} options={projectOptions} />
                    <SelectPill value={range} onChange={value => setRange(value as RangePreset)} options={rangeOptions} />
                    {lastReport && (
                        <div className="ml-auto hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
                            <BarChart3 className="w-3.5 h-3.5" />
                            {lastReport.range.label}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-5">
                    {messages.length === 0 && (
                        <div className="mb-5 text-center">
                            <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-purple-100 flex items-center justify-center">
                                <Bot className="w-7 h-7 text-purple-500" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">AI Report Agent sẵn sàng!</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                Chọn câu hỏi gợi ý hoặc hỏi về member, task, target, overdue.
                            </p>
                            <div className="mt-5 space-y-2">
                                {quickPrompts.map(prompt => (
                                    <button
                                        key={prompt.text}
                                        onClick={() => askAgent(prompt.text)}
                                        disabled={loading}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm hover:border-purple-200 hover:bg-purple-50 disabled:opacity-60 transition-colors"
                                    >
                                        <span className="mr-2">{prompt.icon}</span>
                                        {prompt.text}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        {messages.map((message, index) => (
                            <div
                                key={`${message.role}-${index}`}
                                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {message.role === 'assistant' && (
                                    <div className="h-8 w-8 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                                        <Bot className="w-4 h-4 text-purple-500" />
                                    </div>
                                )}
                                <div className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${message.role === 'user'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-white text-slate-800 border border-slate-200'
                                    }`}>
                                    <div className="whitespace-pre-wrap">{message.content}</div>
                                    {message.role === 'assistant' && message.aiUsed !== undefined && (
                                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                                            <Sparkles className="w-3 h-3" />
                                            {message.aiUsed ? 'AI + dữ liệu dashboard' : 'Fallback dữ liệu dashboard'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                                <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                                Đang tổng hợp dữ liệu và gọi AI...
                            </div>
                        )}
                    </div>

                    {lastReport && (
                        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="mb-3 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                                    <BarChart3 className="w-4 h-4 text-purple-500" />
                                    Snapshot
                                </div>
                                <div className="text-xs text-slate-400">
                                    {lastReport.range.start} → {lastReport.range.end}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <MetricCard label="Done" value={`${lastReport.team.doneTasks}/${lastReport.team.totalTasks}`} />
                                <MetricCard label="Done rate" value={formatPercent(lastReport.team.doneRate)} />
                                <MetricCard label="Points" value={`${formatPoint(lastReport.team.points)}/${formatPoint(lastReport.team.targetAfterDayOffs)}`} />
                                <MetricCard label="Overdue" value={String(lastReport.team.overdueTasks)} />
                            </div>
                            {membersToWatch.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {membersToWatch.map(member => (
                                        <div key={`${member.project}-${member.name}`} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                                            <div>
                                                <div className="font-semibold text-slate-800">{member.name}</div>
                                                <div className="text-slate-500">Done {member.doneTasks}/{member.totalTasks}</div>
                                            </div>
                                            <div className={member.gap >= 0 ? 'font-bold text-emerald-600' : 'font-bold text-red-500'}>
                                                {member.gap >= 0 ? '+' : ''}{formatPoint(member.gap)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-4">
                    {error && (
                        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                            {error}
                        </div>
                    )}
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-purple-300">
                        <input
                            value={input}
                            onChange={event => setInput(event.target.value)}
                            placeholder="Hỏi về member, task, done rate..."
                            className="min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            className="h-10 w-10 rounded-xl bg-purple-600 text-white flex items-center justify-center hover:bg-purple-500 disabled:bg-slate-200 disabled:text-slate-400"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                    </div>
                    <div className="mt-2 text-center text-[11px] text-slate-300">
                        Gemini · Supabase · Creative Dashboard
                    </div>
                </form>
            </div>
        </section>
    )
}

function SelectPill({
    value,
    onChange,
    options,
}: {
    value: string
    onChange: (value: string) => void
    options: { value: string; label: string }[]
}) {
    return (
        <label className="relative">
            <select
                value={value}
                onChange={event => onChange(event.target.value)}
                className="appearance-none rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-3 pr-8 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-200"
            >
                {options.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </label>
    )
}

function MetricCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-[11px] text-slate-500">{label}</div>
            <div className="text-sm font-bold text-slate-900">{value}</div>
        </div>
    )
}
