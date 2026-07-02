'use client'

import TargetSettingsPage from '@/components/TargetSettingsPage'

const creativeTheme = {
    accentText: 'text-purple-400',
    accentButton: 'bg-emerald-600',
    accentButtonHover: 'hover:bg-emerald-500',
    accentSoftBg: 'bg-purple-600/20',
    accentSoftHover: 'hover:bg-purple-600/30',
    accentSoftBorder: 'border-purple-500/30',
    accentSoftText: 'text-purple-300',
    accentToggle: 'bg-purple-600',
    accentToggleShadow: 'shadow-purple-900/40',
    accentFocus: 'focus:ring-purple-500',
    accentMonthText: 'text-blue-300',
    accentCurrentBg: 'bg-purple-600/20',
    accentCurrentText: 'text-purple-300',
    accentCurrentBorder: 'rgb(168, 85, 247)',
    accentCurrentShadow: 'inset 0 0 12px rgba(168, 85, 247, 0.3), 0 0 8px rgba(168, 85, 247, 0.2)',
    accentLoadingBorder: 'border-purple-500',
    title: 'Mục tiêu Target',
    loadingText: 'Đang tải cài đặt Video Creative...',
    allMembersLabel: 'Tất cả thành viên',
    memberColumnLabel: '👤 Thành viên',
} as const

export default function SettingsPage() {
    return <TargetSettingsPage projectType="creative" theme={creativeTheme} />
}
