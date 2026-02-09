'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp, Target, Award, Calendar, Users, Zap, BarChart3 } from 'lucide-react'
import { getWeek } from 'date-fns'
import DashboardLayout from '@/components/DashboardLayout'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    LineChart, Line, ResponsiveContainer, Cell
} from 'recharts'

// Point configuration
const POINT_CONFIG: Record<string, number> = {
    S1: 3, S2A: 2, S2B: 2.5, S3A: 2,
    S3B: 5, S4: 5, S5: 6, S6: 7,
    S7: 10, S8: 48, S9A: 2.5, S9B: 4, S9C: 7, S10A: 1,
}

// EKS Target (6 months)
const EKS_TARGET = 4200
const WEEKLY_TARGET_DEFAULT = 160

interface Task {
    id: string
    name: string
    assignee_name: string | null
    video_type: string | null
    video_count: number
    points: number
    status: string
    completed_at: string | null
}

interface MemberStats {
    name: string
    totalPoints: number
    totalVideos: number
    weeklyData: { week: number; points: number }[]
    avgPointsPerWeek: number
    targetHitRate: number
    bestWeek: number
    worstWeek: number
    consistency: number
    eksProgress: number
    videoTypeMix: Record<string, number>
}

const COLORS = [
    '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444',
    '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16'
]

export default function ReportsPage() {
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [tasks, setTasks] = useState<Task[]>([])
    const [targets, setTargets] = useState<Record<string, Record<number, number>>>({})
    const [timeRange, setTimeRange] = useState<'1month' | '3months' | '6months'>('6months')
    const [selectedMember, setSelectedMember] = useState<string>('all')
    const [user, setUser] = useState<{ role: string; fullName: string; email: string } | null>(null)

    const now = new Date()
    const currentWeek = getWeek(now, { weekStartsOn: 1 })

    const getWeekRange = () => {
        switch (timeRange) {
            case '1month': return 4
            case '3months': return 13
            case '6months': return 26
        }
    }

    const weeksToShow = getWeekRange()
    const startWeek = Math.max(1, currentWeek - weeksToShow + 1)

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            try {
                // Fetch user profile
                const { data: { user: authUser } } = await supabase.auth.getUser()
                if (authUser) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('role, full_name')
                        .eq('id', authUser.id)
                        .single()

                    setUser({
                        role: profile?.role || 'member',
                        fullName: profile?.full_name || '',
                        email: authUser.email || '',
                    })
                }

                const { data: taskData } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('status', 'done')

                if (taskData) setTasks(taskData)

                const { data: targetData } = await supabase.from('targets').select('*')

                if (targetData) {
                    const targetsMap: Record<string, Record<number, number>> = {}
                    targetData.forEach(t => {
                        const weekNum = getWeek(new Date(t.week_start_date), { weekStartsOn: 1 })
                        if (!targetsMap[t.user_gid]) targetsMap[t.user_gid] = {}
                        targetsMap[t.user_gid][weekNum] = t.target_points
                    })
                    setTargets(targetsMap)
                }
            } catch (error) {
                console.error('Error:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [supabase])

    // Role-based filtering: show all data if no profile or no fullName set
    const isManager = !user?.role || user?.role === 'admin' || user?.role === 'lead' || !user?.fullName

    const memberStats = useMemo(() => {
        const assigneeMap = new Map<string, MemberStats>()
        const assignees = [...new Set(tasks.map(t => t.assignee_name).filter(Boolean))] as string[]

        assignees.forEach(name => {
            const memberTasks = tasks.filter(t => t.assignee_name === name)
            const weeklyPoints: Record<number, number> = {}
            const videoTypeMix: Record<string, number> = {}

            memberTasks.forEach(task => {
                if (task.completed_at) {
                    const weekNum = getWeek(new Date(task.completed_at), { weekStartsOn: 1 })
                    weeklyPoints[weekNum] = (weeklyPoints[weekNum] || 0) + (task.points || 0)
                }
                if (task.video_type) {
                    videoTypeMix[task.video_type] = (videoTypeMix[task.video_type] || 0) + (task.video_count || 0)
                }
            })

            const totalPoints = memberTasks.reduce((sum, t) => sum + (t.points || 0), 0)
            const totalVideos = memberTasks.reduce((sum, t) => sum + (t.video_count || 0), 0)

            const weeklyData = []
            for (let w = startWeek; w <= currentWeek; w++) {
                weeklyData.push({ week: w, points: weeklyPoints[w] || 0 })
            }

            const activeWeeks = Object.keys(weeklyPoints).length
            const avgPointsPerWeek = activeWeeks > 0 ? totalPoints / activeWeeks : 0

            const memberTargets = targets[name] || {}
            let hitsCount = 0
            let totalTargetWeeks = 0
            Object.entries(weeklyPoints).forEach(([week, points]) => {
                const target = memberTargets[parseInt(week)] || WEEKLY_TARGET_DEFAULT
                totalTargetWeeks++
                if (points >= target) hitsCount++
            })
            const targetHitRate = totalTargetWeeks > 0 ? (hitsCount / totalTargetWeeks) * 100 : 0

            const pointsArray = Object.values(weeklyPoints)
            const bestWeek = Math.max(...pointsArray, 0)
            const worstWeek = pointsArray.length > 0 ? Math.min(...pointsArray) : 0

            const mean = avgPointsPerWeek
            const variance = pointsArray.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / (pointsArray.length || 1)
            const consistency = mean > 0 ? Math.max(0, 100 - (Math.sqrt(variance) / mean) * 100) : 0
            const eksProgress = (totalPoints / EKS_TARGET) * 100

            assigneeMap.set(name, {
                name, totalPoints, totalVideos, weeklyData, avgPointsPerWeek,
                targetHitRate, bestWeek, worstWeek, consistency, eksProgress, videoTypeMix,
            })
        })

        return Array.from(assigneeMap.values()).sort((a, b) => b.totalPoints - a.totalPoints)
    }, [tasks, targets, startWeek, currentWeek])

    // Get list of all members for filter dropdown
    const allMembers = useMemo(() => {
        return memberStats.map(m => m.name)
    }, [memberStats])

    // Filter memberStats based on selectedMember
    const filteredMemberStats = useMemo(() => {
        if (selectedMember === 'all') return memberStats
        return memberStats.filter(m => m.name === selectedMember)
    }, [memberStats, selectedMember])

    const weeklyComparisonData = useMemo(() => {
        const weeks = []
        for (let w = startWeek; w <= currentWeek; w++) {
            const weekData: Record<string, number | string> = { week: `T${w}` }
            filteredMemberStats.forEach(m => {
                const weekPoints = m.weeklyData.find(d => d.week === w)
                weekData[m.name] = weekPoints?.points || 0
            })
            weeks.push(weekData)
        }
        return weeks
    }, [filteredMemberStats, startWeek, currentWeek])

    // Filter memberStats for members
    const roleFilteredMemberStats = isManager ? filteredMemberStats : filteredMemberStats.filter(m => m.name === user?.fullName)
    const roleFilteredAllMembers = isManager ? allMembers : allMembers.filter(m => m === user?.fullName)

    if (loading) {
        return (
            <DashboardLayout>
                <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-slate-400">Đang tải báo cáo...</p>
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
                        <div>
                            <h2 className="text-xl font-bold text-white">Báo Cáo & Thống Kê</h2>
                            <p className="text-sm text-slate-400">So sánh hiệu suất thành viên • Mục tiêu EKS: {EKS_TARGET.toLocaleString()} điểm</p>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Member Filter */}
                            <select
                                value={selectedMember}
                                onChange={(e) => setSelectedMember(e.target.value)}
                                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="all">Tất cả thành viên</option>
                                {allMembers.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>

                            {/* Time Range Filter */}
                            <div className="flex items-center gap-1 bg-slate-800 rounded-xl p-1">
                                {(['1month', '3months', '6months'] as const).map(range => (
                                    <button
                                        key={range}
                                        onClick={() => setTimeRange(range)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${timeRange === range ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'
                                            }`}
                                    >
                                        {range === '1month' ? '1 Tháng' : range === '3months' ? '3 Tháng' : '6 Tháng'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </header>

                <main className="px-6 py-6 space-y-6">
                    {/* BIỂU ĐỒ CỘT - HIỆU SUẤT TỪNG THÀNH VIÊN THEO TUẦN */}
                    <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-cyan-400" />
                            Hiệu Suất Theo Tuần (Tuần {startWeek} - {currentWeek})
                        </h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {filteredMemberStats.map((member, memberIndex) => (
                                <div key={member.name} className="bg-slate-700/30 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-4 h-4 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: COLORS[memberIndex % COLORS.length] }}
                                            />
                                            <span className="font-semibold text-white text-base">{member.name}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm text-slate-400">TB: </span>
                                            <span className="text-white font-bold">{member.avgPointsPerWeek.toFixed(0)}</span>
                                            <span className="text-sm text-slate-400"> điểm/tuần</span>
                                        </div>
                                    </div>
                                    <div className="h-48">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={member.weeklyData} margin={{ top: 25, right: 10, left: 0, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                                <XAxis
                                                    dataKey="week"
                                                    stroke="#64748b"
                                                    fontSize={11}
                                                    tickFormatter={(w) => `T${w}`}
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <YAxis
                                                    stroke="#64748b"
                                                    fontSize={11}
                                                    axisLine={false}
                                                    tickLine={false}
                                                    width={35}
                                                />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: '#1e293b',
                                                        border: '1px solid #475569',
                                                        borderRadius: '8px',
                                                        fontSize: '12px'
                                                    }}
                                                    formatter={(value) => [`${value} điểm`, 'Điểm']}
                                                    labelFormatter={(week) => `Tuần ${week}`}
                                                />
                                                <Bar
                                                    dataKey="points"
                                                    radius={[4, 4, 0, 0]}
                                                    label={{
                                                        position: 'top',
                                                        fill: '#e2e8f0',
                                                        fontSize: 11,
                                                        fontWeight: 600,
                                                        formatter: (value) => value && Number(value) > 0 ? value : ''
                                                    }}
                                                >
                                                    {member.weeklyData.map((entry, index) => (
                                                        <Cell
                                                            key={`cell-${index}`}
                                                            fill={entry.points >= WEEKLY_TARGET_DEFAULT
                                                                ? '#10b981'
                                                                : COLORS[memberIndex % COLORS.length]
                                                            }
                                                        />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between text-sm border-t border-slate-600/50 pt-3">
                                        <span className="text-slate-400">
                                            🎯 Mục tiêu: {WEEKLY_TARGET_DEFAULT} điểm
                                        </span>
                                        <span className="text-green-400 font-medium">
                                            ✓ Đạt {member.weeklyData.filter(w => w.points >= WEEKLY_TARGET_DEFAULT).length} tuần
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* TỔNG QUAN */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Users className="w-4 h-4 text-purple-400" />
                                <span className="text-xs text-slate-400">Thành viên</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{filteredMemberStats.length}</p>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Zap className="w-4 h-4 text-yellow-400" />
                                <span className="text-xs text-slate-400">Tổng điểm</span>
                            </div>
                            <p className="text-2xl font-bold text-white">
                                {filteredMemberStats.reduce((sum, m) => sum + m.totalPoints, 0).toLocaleString()}
                            </p>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <BarChart3 className="w-4 h-4 text-cyan-400" />
                                <span className="text-xs text-slate-400">TB/Người</span>
                            </div>
                            <p className="text-2xl font-bold text-white">
                                {filteredMemberStats.length > 0
                                    ? Math.round(filteredMemberStats.reduce((sum, m) => sum + m.totalPoints, 0) / filteredMemberStats.length).toLocaleString()
                                    : 0}
                            </p>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Target className="w-4 h-4 text-green-400" />
                                <span className="text-xs text-slate-400">Tỷ lệ đạt</span>
                            </div>
                            <p className="text-2xl font-bold text-white">
                                {filteredMemberStats.length > 0
                                    ? Math.round(filteredMemberStats.reduce((sum, m) => sum + m.targetHitRate, 0) / filteredMemberStats.length)
                                    : 0}%
                            </p>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Calendar className="w-4 h-4 text-orange-400" />
                                <span className="text-xs text-slate-400">Số tuần</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{weeksToShow}</p>
                        </div>
                        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Award className="w-4 h-4 text-pink-400" />
                                <span className="text-xs text-slate-400">Top 1</span>
                            </div>
                            <p className="text-lg font-bold text-white truncate">
                                {filteredMemberStats[0]?.name.split(' ').slice(-1)[0] || 'N/A'}
                            </p>
                        </div>
                    </div>

                    {/* TIẾN ĐỘ EKS */}
                    <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Target className="w-5 h-5 text-purple-400" />
                            Tiến Độ EKS (Mục tiêu: 4.200 điểm / 6 tháng)
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {filteredMemberStats.map((member, index) => (
                                <div key={member.name} className="bg-slate-700/30 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="font-medium text-white text-sm">{member.name}</span>
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${member.eksProgress >= 100 ? 'bg-green-500/20 text-green-400' :
                                            member.eksProgress >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-red-500/20 text-red-400'
                                            }`}>
                                            {member.eksProgress.toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="mb-2">
                                        <span className="text-2xl font-bold text-white">{member.totalPoints.toLocaleString()}</span>
                                        <span className="text-slate-500 text-sm"> / {EKS_TARGET.toLocaleString()}</span>
                                    </div>
                                    <div className="w-full bg-slate-600 rounded-full h-2.5">
                                        <div
                                            className="h-2.5 rounded-full transition-all duration-500"
                                            style={{
                                                width: `${Math.min(100, member.eksProgress)}%`,
                                                backgroundColor: COLORS[index % COLORS.length]
                                            }}
                                        />
                                    </div>
                                    <div className="mt-2 text-xs text-slate-400">
                                        Còn thiếu {Math.max(0, EKS_TARGET - member.totalPoints).toLocaleString()} điểm
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* BIỂU ĐỒ XU HƯỚNG */}
                    <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-purple-400" />
                            Xu Hướng Theo Tuần
                        </h2>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={weeklyComparisonData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="week" stroke="#94a3b8" fontSize={12} />
                                    <YAxis stroke="#94a3b8" fontSize={12} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1e293b',
                                            border: '1px solid #475569',
                                            borderRadius: '8px'
                                        }}
                                        formatter={(value) => [`${value} điểm`, '']}
                                    />
                                    <Legend />
                                    {filteredMemberStats.slice(0, 6).map((member, index) => (
                                        <Line
                                            key={member.name}
                                            type="monotone"
                                            dataKey={member.name}
                                            stroke={COLORS[index % COLORS.length]}
                                            strokeWidth={2}
                                            dot={{ r: 4 }}
                                            activeDot={{ r: 6 }}
                                        />
                                    ))}
                                    <Line
                                        type="monotone"
                                        dataKey={() => WEEKLY_TARGET_DEFAULT}
                                        stroke="#ef4444"
                                        strokeDasharray="5 5"
                                        strokeWidth={2}
                                        name="Mục tiêu (160)"
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* BẢNG HIỆU SUẤT */}
                    <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
                        <h2 className="text-lg font-bold text-white mb-4">Bảng Xếp Hạng Thành Viên</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-700">
                                        <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase w-12">#</th>
                                        <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase">Thành viên</th>
                                        <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">Tổng điểm</th>
                                        <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">EKS %</th>
                                        <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">TB/Tuần</th>
                                        <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">Đạt target</th>
                                        <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">Tuần tốt nhất</th>
                                        <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">Độ ổn định</th>
                                        <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase">Số video</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {filteredMemberStats.map((member, index) => (
                                        <tr key={member.name} className="hover:bg-slate-700/20">
                                            <td className="px-4 py-3">
                                                <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                                                    index === 1 ? 'bg-slate-400/20 text-slate-300' :
                                                        index === 2 ? 'bg-orange-500/20 text-orange-400' :
                                                            'bg-slate-700 text-slate-400'
                                                    }`}>
                                                    {index + 1}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="font-medium text-white">{member.name}</span>
                                            </td>
                                            <td className="text-right px-4 py-3 font-bold text-white">
                                                {member.totalPoints.toLocaleString()}
                                            </td>
                                            <td className="text-right px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${member.eksProgress >= 100 ? 'bg-green-500/20 text-green-400' :
                                                    member.eksProgress >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                                                        'bg-red-500/20 text-red-400'
                                                    }`}>
                                                    {member.eksProgress.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="text-right px-4 py-3 text-slate-300">
                                                {member.avgPointsPerWeek.toFixed(0)}
                                            </td>
                                            <td className="text-right px-4 py-3">
                                                <span className={member.targetHitRate >= 80 ? 'text-green-400' : member.targetHitRate >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                                                    {member.targetHitRate.toFixed(0)}%
                                                </span>
                                            </td>
                                            <td className="text-right px-4 py-3 text-slate-300">
                                                {member.bestWeek.toLocaleString()}
                                            </td>
                                            <td className="text-right px-4 py-3">
                                                <div className="flex items-center justify-end gap-2">
                                                    <div className="w-16 bg-slate-700 rounded-full h-1.5">
                                                        <div
                                                            className="h-1.5 rounded-full bg-purple-500"
                                                            style={{ width: `${Math.min(100, member.consistency)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-slate-400 w-8">{member.consistency.toFixed(0)}%</span>
                                                </div>
                                            </td>
                                            <td className="text-right px-4 py-3 text-slate-300">
                                                {member.totalVideos}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* QUY TẮC ĐIỂM */}
                    <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
                        <h2 className="text-lg font-bold text-white mb-4">Bảng Quy Đổi Điểm</h2>
                        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-3">
                            {Object.entries(POINT_CONFIG).map(([type, points]) => (
                                <div key={type} className="bg-slate-700/30 rounded-xl p-3 text-center">
                                    <span className="text-base font-bold text-purple-400">{type}</span>
                                    <p className="text-xl font-bold text-white">{points}</p>
                                    <p className="text-xs text-slate-500">điểm</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </main>
            </div>
        </DashboardLayout>
    )
}
