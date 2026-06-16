import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function decodeHtml(value: string) {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
}

function getMetaContent(html: string, property: string) {
    const propertyPattern = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i')
    const reversePattern = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["'][^>]*>`, 'i')
    return decodeHtml(propertyPattern.exec(html)?.[1] || reversePattern.exec(html)?.[1] || '')
}

export async function GET(request: NextRequest) {
    const rawUrl = request.nextUrl.searchParams.get('url')?.trim()
    if (!rawUrl) {
        return NextResponse.json({ error: 'Thiếu link app' }, { status: 400 })
    }

    let url: URL
    try {
        url = new URL(rawUrl)
    } catch {
        return NextResponse.json({ error: 'Link app không hợp lệ' }, { status: 400 })
    }

    if (url.hostname.includes('apps.apple.com')) {
        const idMatch = url.pathname.match(/\/id(\d+)/)
        const id = idMatch?.[1]
        if (!id) {
            return NextResponse.json({ error: 'Không tìm thấy App Store ID trong link' }, { status: 400 })
        }

        const response = await fetch(`https://itunes.apple.com/lookup?id=${id}`, { cache: 'no-store' })
        if (!response.ok) {
            return NextResponse.json({ error: 'Không đọc được App Store' }, { status: 502 })
        }

        const payload = await response.json()
        const app = payload.results?.[0]
        if (!app) {
            return NextResponse.json({ error: 'Không tìm thấy app trên App Store' }, { status: 404 })
        }

        return NextResponse.json({
            name: app.trackName,
            iconUrl: app.artworkUrl100 || app.artworkUrl60,
            storeUrl: app.trackViewUrl || rawUrl,
            source: 'app-store',
            externalId: String(id),
        })
    }

    if (url.hostname.includes('play.google.com')) {
        const id = url.searchParams.get('id')
        if (!id) {
            return NextResponse.json({ error: 'Không tìm thấy package id trong link CH Play' }, { status: 400 })
        }

        const response = await fetch(rawUrl, {
            cache: 'no-store',
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
            },
        })
        if (!response.ok) {
            return NextResponse.json({ error: 'Không đọc được CH Play' }, { status: 502 })
        }

        const html = await response.text()
        const name = getMetaContent(html, 'og:title').replace(/ - Apps on Google Play$/i, '').trim()
        const iconUrl = getMetaContent(html, 'og:image')

        return NextResponse.json({
            name: name || id,
            iconUrl,
            playUrl: rawUrl,
            source: 'google-play',
            externalId: id,
        })
    }

    return NextResponse.json({ error: 'Chỉ hỗ trợ link App Store hoặc CH Play' }, { status: 400 })
}
