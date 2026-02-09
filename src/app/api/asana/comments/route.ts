import { NextRequest, NextResponse } from 'next/server'

const ASANA_API_BASE = 'https://app.asana.com/api/1.0'

export async function GET(request: NextRequest) {
    const taskGid = request.nextUrl.searchParams.get('taskGid')

    if (!taskGid) {
        return NextResponse.json({ error: 'taskGid is required' }, { status: 400 })
    }

    const token = process.env.ASANA_ACCESS_TOKEN
    if (!token) {
        return NextResponse.json({ error: 'ASANA_ACCESS_TOKEN not configured' }, { status: 500 })
    }

    try {
        const response = await fetch(
            `${ASANA_API_BASE}/tasks/${taskGid}/stories?opt_fields=created_at,created_by,created_by.name,text,type,resource_subtype`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                },
            }
        )

        if (!response.ok) {
            return NextResponse.json(
                { error: `Asana API error: ${response.status}` },
                { status: response.status }
            )
        }

        const data = await response.json()

        // Filter only comments (not system stories)
        const comments = data.data
            .filter((story: { resource_subtype: string }) => story.resource_subtype === 'comment_added')
            .map((story: { gid: string; text: string; created_at: string; created_by: { name: string } }) => ({
                id: story.gid,
                text: story.text,
                created_at: story.created_at,
                author: story.created_by?.name || 'Unknown',
            }))

        return NextResponse.json({ comments })
    } catch (error) {
        console.error('Error fetching Asana comments:', error)
        return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
    }
}
