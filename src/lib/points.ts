// Point configuration for video types
export const POINT_CONFIG: Record<string, number> = {
    S1: 1,
    S2A: 2,
    S2B: 2,
    S3A: 3,
    S3B: 5,
    S4: 8,
    S5: 12,
    S6: 20,
    S10A: 1,
}

export function calculatePoints(videoType: string, quantity: number): number {
    const points = POINT_CONFIG[videoType] || 0
    return quantity * points
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
    }
    return colors[videoType] || '#6b7280'
}
