import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Cron endpoint for periodic Asana sync
// Vercel Cron calls this endpoint automatically
export async function GET(request: NextRequest) {
    // Verify cron secret (Vercel sends this automatically for cron jobs)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Get the base URL from the request
        const baseUrl = new URL(request.url).origin

        // Sync both projects
        const response = await fetch(`${baseUrl}/api/asana/sync?project=all`, {
            method: 'POST',
            cache: 'no-store',
        })

        if (!response.ok) {
            const errorText = await response.text()
            return NextResponse.json(
                { error: `Sync failed: ${errorText}` },
                { status: 500 }
            )
        }

        const result = await response.json()
        console.log('[Cron Sync] Completed:', result)

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            ...result,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('[Cron Sync] Error:', message)
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
