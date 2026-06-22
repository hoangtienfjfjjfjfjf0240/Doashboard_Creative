import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type ParsedBenchmarkRow = {
    ideaName: string
    market: string
    ctr: string
    cvr: string
    cpi: string
    cpm: string
    win: boolean
}

const MARKET_OPTIONS = ['US/Global', 'US', 'Global', 'VN', 'TH', 'ID', 'BR', 'MX', 'JP', 'KR']

function normalizeMetric(value: unknown) {
    if (value === null || value === undefined) return ''
    const raw = String(value).trim()
    if (!raw) return ''
    const normalized = raw.replace(/[$,%\s]/g, '').replace(',', '.')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? String(parsed) : ''
}

function normalizeIdeaName(value: unknown) {
    return String(value || '').trim()
}

function normalizeMarket(value: unknown, fallbackMarket: string) {
    const raw = String(value || '').trim()
    if (!raw) return fallbackMarket

    const matched = MARKET_OPTIONS.find(option => option.toLowerCase() === raw.toLowerCase())
    return matched || raw
}

function normalizeWin(value: unknown) {
    if (typeof value === 'boolean') return value
    const raw = String(value || '').trim().toLowerCase()
    return ['1', 'true', 'yes', 'y', 'win', 'won', 'x', 'check', 'checked'].includes(raw)
}

function sanitizeRow(value: unknown, fallbackMarket: string): ParsedBenchmarkRow | null {
    if (!value || typeof value !== 'object') return null

    const candidate = value as Record<string, unknown>
    const row: ParsedBenchmarkRow = {
        ideaName: normalizeIdeaName(candidate.ideaName ?? candidate.idea_name ?? candidate.name ?? candidate.idea),
        market: normalizeMarket(candidate.market, fallbackMarket),
        ctr: normalizeMetric(candidate.ctr),
        cvr: normalizeMetric(candidate.cvr),
        cpi: normalizeMetric(candidate.cpi),
        cpm: normalizeMetric(candidate.cpm),
        win: normalizeWin(candidate.win),
    }

    const hasContent = row.ideaName || row.ctr || row.cvr || row.cpi || row.cpm
    return hasContent ? row : null
}

function parseJsonPayload(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return null

    try {
        return JSON.parse(trimmed)
    } catch {
        // Try common wrapped JSON shapes next.
    }

    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (codeBlockMatch) {
        try {
            return JSON.parse(codeBlockMatch[1].trim())
        } catch {
            // Fall through.
        }
    }

    const arrayMatch = trimmed.match(/\[[\s\S]*\]/)
    if (arrayMatch) {
        try {
            return JSON.parse(arrayMatch[0])
        } catch {
            // Fall through.
        }
    }

    const objectMatch = trimmed.match(/\{[\s\S]*\}/)
    if (objectMatch) {
        try {
            return JSON.parse(objectMatch[0])
        } catch {
            return null
        }
    }

    return null
}

function extractRowsFromAiPayload(payload: unknown, fallbackMarket: string) {
    const rawRows = Array.isArray(payload)
        ? payload
        : payload && typeof payload === 'object' && Array.isArray((payload as { rows?: unknown[] }).rows)
            ? (payload as { rows: unknown[] }).rows
            : []

    return rawRows
        .map(item => sanitizeRow(item, fallbackMarket))
        .filter((item): item is ParsedBenchmarkRow => Boolean(item))
}

function splitLine(line: string) {
    if (line.includes('\t')) {
        return line.split('\t').map(part => part.trim()).filter(Boolean)
    }

    if (line.includes('|')) {
        return line.split('|').map(part => part.trim()).filter(Boolean)
    }

    if (line.includes(';')) {
        return line.split(';').map(part => part.trim()).filter(Boolean)
    }

    if (line.includes(',')) {
        return line.split(',').map(part => part.trim()).filter(Boolean)
    }

    return line.trim().split(/\s{2,}/).map(part => part.trim()).filter(Boolean)
}

function parseLocalRows(input: string, fallbackMarket: string) {
    const rows: ParsedBenchmarkRow[] = []

    for (const rawLine of input.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line) continue

        const lowered = line.toLowerCase()
        if (lowered.includes('tên idea') || lowered.includes('idea name') || lowered.includes('market')) {
            continue
        }

        const parts = splitLine(line)
        if (parts.length < 5) continue

        const ideaName = parts[0]
        let cursor = 1
        let market = fallbackMarket

        if (parts[cursor] && (MARKET_OPTIONS.includes(parts[cursor]) || parts[cursor].includes('/'))) {
            market = normalizeMarket(parts[cursor], fallbackMarket)
            cursor += 1
        }

        const metrics = parts.slice(cursor).map(part => part.trim())
        const numericValues = metrics
            .map(value => normalizeMetric(value))
            .filter(Boolean)

        if (numericValues.length < 4) continue

        const winToken = metrics.find(value => /^(win|won|true|yes|1|x|check(ed)?)$/i.test(value))

        rows.push({
            ideaName,
            market,
            ctr: numericValues[0] || '',
            cvr: numericValues[1] || '',
            cpi: numericValues[2] || '',
            cpm: numericValues[3] || '',
            win: normalizeWin(winToken),
        })
    }

    return rows
}

async function callAiParser(input: string, fallbackMarket: string) {
    const baseUrl = process.env.AI_BASE_URL?.replace(/\/+$/, '')
    const apiKey = process.env.AI_API_KEY
    if (!baseUrl || !apiKey) return null

    const model = process.env.AI_MODEL || 'gemini-2.5-flash'
    const endpoints = baseUrl.endsWith('/v1')
        ? [`${baseUrl}/chat/completions`]
        : [`${baseUrl}/v1/chat/completions`, `${baseUrl}/chat/completions`]

    const systemPrompt = [
        'Bạn là AI parser cho bảng Benchmark Creative.',
        'Nhiệm vụ: trích xuất danh sách creative từ text user paste vào.',
        'Chỉ trả về JSON hợp lệ.',
        'Schema bắt buộc: {"rows":[{"ideaName":"","market":"","ctr":"","cvr":"","cpi":"","cpm":"","win":false}]}',
        `Nếu thiếu market thì dùng "${fallbackMarket}".`,
        'Giữ số dưới dạng string không có ký hiệu % hoặc $.',
        'win = true chỉ khi text thể hiện rõ là win.',
        'Bỏ qua dòng rỗng hoặc dòng tiêu đề.',
    ].join(' ')

    const payload = {
        model,
        temperature: 0.1,
        max_tokens: 2000,
        messages: [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: [
                    'Hãy parse dữ liệu benchmark creative dưới đây.',
                    'Trả về đúng JSON, không thêm giải thích.',
                    input,
                ].join('\n\n'),
            },
        ],
    }

    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                    'x-api-key': apiKey,
                },
                body: JSON.stringify(payload),
            })

            if (!response.ok) continue
            const data = await response.json()
            const openAiText = data?.choices?.[0]?.message?.content

            if (typeof openAiText === 'string' && openAiText.trim()) {
                const payload = parseJsonPayload(openAiText)
                const rows = extractRowsFromAiPayload(payload, fallbackMarket)
                if (rows.length > 0) return rows
            }

            const geminiParts = data?.candidates?.[0]?.content?.parts
            if (Array.isArray(geminiParts)) {
                const text = geminiParts.map((part: { text?: string }) => part.text || '').join('').trim()
                if (!text) continue
                const payload = parseJsonPayload(text)
                const rows = extractRowsFromAiPayload(payload, fallbackMarket)
                if (rows.length > 0) return rows
            }
        } catch {
            // Try the next compatible endpoint.
        }
    }

    return null
}

export async function POST(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const input = typeof body.input === 'string' ? body.input.trim() : ''
    const defaultMarket = normalizeMarket(body.defaultMarket, 'US')

    if (!input) {
        return NextResponse.json({ error: 'Thiếu dữ liệu để phân tích' }, { status: 400 })
    }

    if (input.length > 20000) {
        return NextResponse.json({ error: 'Dữ liệu dán vào quá dài, hãy chia nhỏ hơn' }, { status: 400 })
    }

    const aiRows = await callAiParser(input, defaultMarket)
    const rows = aiRows && aiRows.length > 0 ? aiRows : parseLocalRows(input, defaultMarket)
    const source = aiRows && aiRows.length > 0 ? 'ai' : 'local'

    if (rows.length === 0) {
        return NextResponse.json(
            {
                error: 'Chưa nhận diện được creative nào. Bạn hãy dán theo dạng bảng hoặc mỗi dòng 1 creative kèm CTR, CVR, CPI, CPM.',
            },
            { status: 422 }
        )
    }

    return NextResponse.json({ rows, source })
}
