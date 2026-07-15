// Shared constants - single source of truth

/** Video Creative legacy point config (before H2 2026) */
export const LEGACY_CREATIVE_POINT_CONFIG: Record<string, number> = {
    S1: 3,      // Bumper Ads (6s)
    S2A: 2,     // Gen Hook Prompt to video
    S2C: 2,     // Gen Hook Prompt to video + voice character sync
    S2B: 2.5,   // Gen Hook Image to video
    S3A: 2,     // Json_Button
    S3B: 5,     // Json_Tutorial
    S4: 3,      // UGC
    S5: 6,      // Motion shot ads
    S6: 7,      // Source + Roto/Tracking
    S7: 10,     // Quay dung + Roto/Tracking
    S7A: 5,     // Quay dung dang A
    S8: 48,     // Video HomePage
    S9A: 2.5,   // Drama: Duration < 10 min
    S9B: 4,     // Drama: Duration 11 - 20 min
    S9C: 7,     // Drama: Duration > 21 min
    S10A: 1,    // Translate: Voice + Sub Text
    S10B: 1,    // Translate: Text Body
}

/** Video Creative point config (from H2 2026 onward) */
export const CREATIVE_POINT_CONFIG: Record<string, number> = {
    S1: 3,      // Bumper Ads (6s)
    S2A: 2,     // Gen Hook Prompt to video
    S2C: 2,     // Gen Hook Prompt to video + voice character sync
    S2B: 2.5,   // Gen Hook Image to video
    S3A: 2,     // Json_Button
    S3B: 5,     // Json_Tutorial
    S4: 3,      // UGC
    S5: 6,      // Motion shot ads
    S6: 7,      // Source + Roto/Tracking
    S7: 10,     // Quay dung + Roto/Tracking
    S7A: 5,     // Quay dung dang A
    S8: 48,     // Video HomePage
    S9A: 2.5,   // Drama: Duration < 10 min
    S9B: 4,     // Drama: Duration 11 - 20 min
    S9C: 7,     // Drama: Duration > 21 min
    S10A: 1,    // Translate: Voice + Sub Text
    S10B: 1,    // Translate: Text Body
}

/** H2 2026 cutover date for new Video Creative point rule */
export const CREATIVE_POINT_RULE_H2_START_DATE = '2026-07-01'

/**
 * Graphic Design point config - keys must match Asana "Asset" enum values.
 * Keep old aliases as well so existing tasks do not lose points after renaming.
 */
export const DESIGN_POINT_CONFIG: Record<string, number> = {
    'Research Doc': 6,
    'ScreenShot': 24,
    'Screenshot': 24,
    'ScreenShot (loai 2)': 12,
    'ScreenShot (loại 2)': 12,
    'Screenshot (loai 2)': 12,
    'Screenshot (loại 2)': 12,
    'ScreenShot (loai 3)': 6,
    'ScreenShot (loại 3)': 6,
    'Screenshot (loai 3)': 6,
    'Screenshot (loại 3)': 6,
    Icon: 2,
    'Cover, Promotional Content': 6,
    'Localize Screenshot': 3,
    Localize: 3,
    'Deep Localize': 18,
    'Image Ads (1size)': 0.1,
    'Image Ads (3size)': 0.3,
}

/** Canonical Graphic Design asset types for UI filters/forms */
export const DESIGN_ASSET_TYPES = [
    'Research Doc',
    'Screenshot',
    'Screenshot (loại 2)',
    'Screenshot (loại 3)',
    'Icon',
    'Cover, Promotional Content',
    'Localize Screenshot',
    'Localize',
    'Deep Localize',
    'Image Ads (1size)',
    'Image Ads (3size)',
] as const

/** All creative video type keys */
export const VIDEO_TYPES = Object.keys(CREATIVE_POINT_CONFIG)

/** Day-off deduction divisor */
export const WORKING_DAYS_PER_WEEK = 4

export function isTargetDeductionDay(date: Date): boolean {
    const dayOfWeek = date.getDay()
    return dayOfWeek >= 1 && dayOfWeek <= 5
}

/** Default fallback target points per member per week */
export const FALLBACK_TARGET = 160

/** EKS target (6 months total) */
export const EKS_TARGET = 4200

/** Total planned weeks (Feb-Jul 2026) */
export const TOTAL_WEEKS = 24

/** Asana API base URL */
export const ASANA_API_BASE = 'https://app.asana.com/api/1.0'
