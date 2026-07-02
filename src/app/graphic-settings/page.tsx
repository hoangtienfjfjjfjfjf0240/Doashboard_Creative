'use client'

import TargetSettingsPage from '@/components/TargetSettingsPage'

const graphicTheme = {
    accentText: 'text-cyan-400',
    accentButton: 'bg-emerald-600',
    accentButtonHover: 'hover:bg-emerald-500',
    accentSoftBg: 'bg-cyan-600/20',
    accentSoftHover: 'hover:bg-cyan-600/30',
    accentSoftBorder: 'border-cyan-500/30',
    accentSoftText: 'text-cyan-300',
    accentToggle: 'bg-cyan-600',
    accentToggleShadow: 'shadow-cyan-900/40',
    accentFocus: 'focus:ring-cyan-500',
    accentMonthText: 'text-blue-300',
    accentCurrentBg: 'bg-cyan-600/20',
    accentCurrentText: 'text-cyan-300',
    accentCurrentBorder: 'rgb(6, 182, 212)',
    accentCurrentShadow: 'inset 0 0 12px rgba(6, 182, 212, 0.3), 0 0 8px rgba(6, 182, 212, 0.2)',
    accentLoadingBorder: 'border-cyan-500',
    title: 'Mục tiêu Target — Graphic Design',
    loadingText: 'Đang tải cài đặt Graphic Design...',
    allMembersLabel: 'Tất cả designer',
    memberColumnLabel: '👤 Designer',
} as const

export default function GraphicSettingsPage() {
    return <TargetSettingsPage projectType="graphic" theme={graphicTheme} />
}
