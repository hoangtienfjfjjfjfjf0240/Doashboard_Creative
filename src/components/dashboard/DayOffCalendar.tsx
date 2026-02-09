'use client'

import { useState, useEffect } from 'react'
import { format, addDays, startOfWeek, isSameDay } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Calendar, Plus, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface DayOff {
    id: string
    user_email: string
    date: string
    reason: string | null
}

interface DayOffCalendarProps {
    userEmail: string
    weekStart: Date
    onTargetChange?: (adjustedTarget: number) => void
}

const DEFAULT_TARGET = 160
const POINTS_PER_DAY = 32 // 160 / 5 days

export default function DayOffCalendar({ userEmail, weekStart, onTargetChange }: DayOffCalendarProps) {
    const [dayOffs, setDayOffs] = useState<DayOff[]>([])
    const [loading, setLoading] = useState(true)
    const [adding, setAdding] = useState(false)
    const [selectedDate, setSelectedDate] = useState<Date | null>(null)
    const [reason, setReason] = useState('')
    const supabase = createClient()

    // Get weekdays (Mon-Fri)
    const weekdays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i))

    useEffect(() => {
        fetchDayOffs()
    }, [weekStart, userEmail])

    const fetchDayOffs = async () => {
        setLoading(true)
        const startStr = format(weekStart, 'yyyy-MM-dd')
        const endStr = format(addDays(weekStart, 4), 'yyyy-MM-dd')

        const { data } = await supabase
            .from('day_offs')
            .select('*')
            .eq('user_email', userEmail)
            .gte('date', startStr)
            .lte('date', endStr)

        if (data) {
            setDayOffs(data)
            // Calculate adjusted target
            const adjustedTarget = DEFAULT_TARGET - (data.length * POINTS_PER_DAY)
            onTargetChange?.(Math.max(0, adjustedTarget))
        }
        setLoading(false)
    }

    const isDayOff = (date: Date) => {
        return dayOffs.some(d => d.date === format(date, 'yyyy-MM-dd'))
    }

    const getDayOffReason = (date: Date) => {
        const dayOff = dayOffs.find(d => d.date === format(date, 'yyyy-MM-dd'))
        return dayOff?.reason || ''
    }

    const handleDayClick = async (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd')
        const existing = dayOffs.find(d => d.date === dateStr)

        if (existing) {
            // Remove day off
            await supabase.from('day_offs').delete().eq('id', existing.id)
            setDayOffs(prev => prev.filter(d => d.id !== existing.id))
            onTargetChange?.(DEFAULT_TARGET - ((dayOffs.length - 1) * POINTS_PER_DAY))
        } else {
            // Show reason input
            setSelectedDate(date)
        }
    }

    const addDayOff = async () => {
        if (!selectedDate) return
        setAdding(true)

        const { data, error } = await supabase
            .from('day_offs')
            .insert({
                user_email: userEmail,
                date: format(selectedDate, 'yyyy-MM-dd'),
                reason: reason || null
            })
            .select()
            .single()

        if (data && !error) {
            setDayOffs(prev => [...prev, data])
            onTargetChange?.(DEFAULT_TARGET - ((dayOffs.length + 1) * POINTS_PER_DAY))
        }

        setSelectedDate(null)
        setReason('')
        setAdding(false)
    }

    const adjustedTarget = DEFAULT_TARGET - (dayOffs.length * POINTS_PER_DAY)

    return (
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-semibold text-white">Ngày Nghỉ</h3>
                </div>
                <div className="text-xs text-slate-400">
                    Target: <span className={adjustedTarget < DEFAULT_TARGET ? 'text-yellow-400' : 'text-emerald-400'}>
                        {adjustedTarget} pts
                    </span>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                </div>
            ) : (
                <>
                    {/* Calendar Grid */}
                    <div className="grid grid-cols-5 gap-1 text-center mb-2">
                        {['T2', 'T3', 'T4', 'T5', 'T6'].map(day => (
                            <div key={day} className="text-[10px] text-slate-500 font-medium py-1">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-5 gap-1">
                        {weekdays.map(date => {
                            const isOff = isDayOff(date)
                            const offReason = getDayOffReason(date)
                            const isToday = isSameDay(date, new Date())

                            return (
                                <button
                                    key={date.toISOString()}
                                    onClick={() => handleDayClick(date)}
                                    title={offReason || 'Click để đánh dấu nghỉ'}
                                    className={`
                                        relative p-2 rounded-lg text-xs font-medium transition-all
                                        ${isOff
                                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                            : 'bg-slate-700/30 text-slate-300 hover:bg-slate-700/50 border border-transparent'}
                                        ${isToday ? 'ring-1 ring-purple-500' : ''}
                                    `}
                                >
                                    <div className="text-sm font-bold">{format(date, 'd')}</div>
                                    <div className="text-[9px] text-slate-500">{format(date, 'MMM', { locale: vi })}</div>
                                    {isOff && (
                                        <X className="absolute -top-1 -right-1 w-3 h-3 text-red-400" />
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {/* Add Reason Modal */}
                    {selectedDate && (
                        <div className="mt-3 p-3 bg-slate-700/50 rounded-lg">
                            <p className="text-xs text-slate-300 mb-2">
                                Nghỉ ngày {format(selectedDate, 'dd/MM')}
                            </p>
                            <input
                                type="text"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Lý do (không bắt buộc)"
                                className="w-full px-2 py-1.5 text-xs bg-slate-800 border border-slate-600 rounded text-white placeholder:text-slate-500"
                            />
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={addDayOff}
                                    disabled={adding}
                                    className="flex-1 px-2 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded flex items-center justify-center gap-1"
                                >
                                    {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                    Thêm
                                </button>
                                <button
                                    onClick={() => { setSelectedDate(null); setReason('') }}
                                    className="px-2 py-1.5 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded"
                                >
                                    Hủy
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Legend */}
                    <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-400">
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded bg-red-500/50" />
                            <span>Ngày nghỉ (-{POINTS_PER_DAY} pts)</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded ring-1 ring-purple-500 bg-slate-600" />
                            <span>Hôm nay</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
