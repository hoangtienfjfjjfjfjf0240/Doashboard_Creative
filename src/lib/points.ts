// Point utilities — re-exports constants and provides helpers
import { CREATIVE_POINT_CONFIG } from './constants'

export { CREATIVE_POINT_CONFIG as POINT_CONFIG }

export function calculatePoints(videoType: string, videoCount: number): number {
    const points = CREATIVE_POINT_CONFIG[videoType] || 0
    return videoCount * points
}

export function getVideoTypeLabel(videoType: string): string {
    return videoType || 'Unknown'
}

export function getVideoTypeColor(videoType: string): string {
    const colors: Record<string, string> = {
        S1: '#94a3b8',
        S2A: '#60a5fa',
        S2B: '#38bdf8',
        S3A: '#34d399',
        S3B: '#4ade80',
        S4: '#fbbf24',
        S5: '#f97316',
        S6: '#ef4444',
        S7: '#dc2626',
        S8: '#a855f7',
        S9A: '#e879f9',
        S9B: '#c084fc',
        S9C: '#a78bfa',
        S10A: '#6b7280',
    }
    return colors[videoType] || '#6b7280'
}
