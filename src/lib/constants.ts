// ──────────────────────────────────────────────────
// Shared constants — single source of truth
// ──────────────────────────────────────────────────

/** Video Creative point config */
export const CREATIVE_POINT_CONFIG: Record<string, number> = {
    S1: 3,      // Bumper Ads (6s)
    S2A: 2,     // Gen Hook Prompt to video
    S2B: 2.5,   // Gen Hook Image to video
    S3A: 2,     // Json_Button
    S3B: 5,     // Json_Tutorial
    S4: 5,      // UGC
    S5: 6,      // Motion shot ads
    S6: 7,      // Source + Roto/Tracking
    S7: 10,     // Quay dựng + Roto/Tracking
    S8: 48,     // Video HomePage
    S9A: 2.5,   // Drama: Duration < 10 min
    S9B: 4,     // Drama: Duration 11 - 20 min
    S9C: 7,     // Drama: Duration > 21 min
    S10A: 1,    // Translate
}

/** Graphic Design point config — keys must match Asana "Asset" enum values */
export const DESIGN_POINT_CONFIG: Record<string, number> = {
    'Research Doc': 12,
    'ScreenShot': 24,
    'Icon': 2,
    'Cover, Promotional Content': 12,
    'Localize Screenshot': 6,
    'Localize': 6,
    'Deep Localize': 24,
    'Deep Localization': 24,
}

/** All creative video type keys */
export const VIDEO_TYPES = Object.keys(CREATIVE_POINT_CONFIG)

/** Working days per week (Mon–Thu, excluding Fri) */
export const WORKING_DAYS_PER_WEEK = 4

/** Default fallback target points per member per week */
export const FALLBACK_TARGET = 160

/** EKS target (6 months total) */
export const EKS_TARGET = 4200

/** Total planned weeks (Feb-Jul 2026) */
export const TOTAL_WEEKS = 24

/** Asana API base URL */
export const ASANA_API_BASE = 'https://app.asana.com/api/1.0'
