import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Resend API (free tier: 100 emails/day)
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const FROM_EMAIL = process.env.FROM_EMAIL || 'Ikame Dashboard <onboarding@resend.dev>'

interface MemberReport {
    name: string
    email: string
    targetPoints: number
    actualPoints: number
    missingPoints: number
    completedTasks: number
    pendingTasks: number
    projectType: string
}

function getWeekStartDate(): string {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // Monday = start of week
    const monday = new Date(now)
    monday.setDate(now.getDate() + diff)
    return monday.toISOString().split('T')[0]
}

function getWeekEndDate(): string {
    const monday = getWeekStartDate()
    const end = new Date(monday)
    end.setDate(end.getDate() + 6)
    return end.toISOString().split('T')[0]
}

interface Profile {
    id: string
    email: string
    full_name: string | null
    role: string
    role_creative: string
    role_graphic: string
    asana_email: string | null
    asana_name: string | null
}

interface TargetRecord {
    user_gid: string
    week_start_date: string
    target_points: number
    project_type: string
}

interface TaskRecord {
    assignee_name: string | null
    status: string
    points: number | null
    project_type: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildReport(supabase: any): Promise<MemberReport[]> {
    const weekStart = getWeekStartDate()
    const weekEnd = getWeekEndDate()

    // Get all active members (not 'none' role)
    const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')

    const profiles = (profilesData as Profile[] | null)?.filter(
        p => (p.role_creative && p.role_creative !== 'none') || (p.role_graphic && p.role_graphic !== 'none')
    )

    if (!profiles?.length) return []

    // Get targets for this week
    const { data: targetsData } = await supabase
        .from('targets')
        .select('*')
        .eq('week_start_date', weekStart)
    const targets = targetsData as TargetRecord[] | null

    // Get tasks completed/due this week
    const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .gte('due_date', weekStart)
        .lte('due_date', weekEnd)
    const tasks = tasksData as TaskRecord[] | null

    const reports: MemberReport[] = []

    for (const profile of profiles) {
        // Check creative
        if (profile.role_creative && profile.role_creative !== 'none') {
            const memberName = profile.full_name || profile.email
            const target = targets?.find(
                t => t.user_gid === (profile.asana_name || memberName) && t.project_type === 'creative'
            )
            const memberTasks = tasks?.filter(
                t => t.assignee_name === (profile.asana_name || memberName) && t.project_type === 'creative'
            ) || []
            const completedTasks = memberTasks.filter(t => t.status === 'done')
            const pendingTasks = memberTasks.filter(t => t.status === 'not_done')
            const actualPoints = completedTasks.reduce((sum, t) => sum + (Number(t.points) || 0), 0)
            const targetPoints = Number(target?.target_points) || 0

            if (targetPoints > 0) {
                reports.push({
                    name: memberName,
                    email: profile.email,
                    targetPoints,
                    actualPoints,
                    missingPoints: Math.max(0, targetPoints - actualPoints),
                    completedTasks: completedTasks.length,
                    pendingTasks: pendingTasks.length,
                    projectType: 'Video Creative',
                })
            }
        }

        // Check graphic
        if (profile.role_graphic && profile.role_graphic !== 'none') {
            const memberName = profile.full_name || profile.email
            const target = targets?.find(
                t => t.user_gid === (profile.asana_name || memberName) && t.project_type === 'graphic'
            )
            const memberTasks = tasks?.filter(
                t => t.assignee_name === (profile.asana_name || memberName) && t.project_type === 'graphic'
            ) || []
            const completedTasks = memberTasks.filter(t => t.status === 'done')
            const pendingTasks = memberTasks.filter(t => t.status === 'not_done')
            const actualPoints = completedTasks.reduce((sum, t) => sum + (Number(t.points) || 0), 0)
            const targetPoints = Number(target?.target_points) || 0

            if (targetPoints > 0) {
                reports.push({
                    name: memberName,
                    email: profile.email,
                    targetPoints,
                    actualPoints,
                    missingPoints: Math.max(0, targetPoints - actualPoints),
                    completedTasks: completedTasks.length,
                    pendingTasks: pendingTasks.length,
                    projectType: 'Graphic Design',
                })
            }
        }
    }

    return reports
}

function buildEmailHtml(report: MemberReport, weekStart: string, weekEnd: string): string {
    const progressPercent = report.targetPoints > 0
        ? Math.round((report.actualPoints / report.targetPoints) * 100)
        : 0
    const progressColor = progressPercent >= 100 ? '#10b981' : progressPercent >= 70 ? '#f59e0b' : '#ef4444'

    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #e2e8f0; padding: 32px;">
        <div style="max-width: 520px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 32px; border: 1px solid #334155;">
            <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #a78bfa; font-size: 22px; margin: 0;">📊 Ikame Creative Dashboard</h1>
                <p style="color: #94a3b8; font-size: 14px; margin-top: 8px;">Báo cáo tuần: ${weekStart} → ${weekEnd}</p>
            </div>

            <p style="font-size: 16px; margin-bottom: 16px;">Xin chào <strong style="color: #c4b5fd;">${report.name}</strong>,</p>
            <p style="font-size: 14px; color: #94a3b8; margin-bottom: 20px;">Bộ phận: <strong>${report.projectType}</strong></p>
            
            <!-- Stats -->
            <div style="display: flex; gap: 12px; margin-bottom: 20px;">
                <div style="flex: 1; background: #0f172a; border-radius: 12px; padding: 16px; text-align: center;">
                    <div style="font-size: 28px; font-weight: bold; color: #a78bfa;">${report.actualPoints}</div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Đã đạt</div>
                </div>
                <div style="flex: 1; background: #0f172a; border-radius: 12px; padding: 16px; text-align: center;">
                    <div style="font-size: 28px; font-weight: bold; color: #60a5fa;">${report.targetPoints}</div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Mục tiêu</div>
                </div>
                <div style="flex: 1; background: #0f172a; border-radius: 12px; padding: 16px; text-align: center;">
                    <div style="font-size: 28px; font-weight: bold; color: ${progressColor};">${report.missingPoints > 0 ? '-' + report.missingPoints : '✅'}</div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">${report.missingPoints > 0 ? 'Còn thiếu' : 'Hoàn thành!'}</div>
                </div>
            </div>

            <!-- Progress bar -->
            <div style="background: #0f172a; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-size: 13px; color: #94a3b8;">Tiến độ</span>
                    <span style="font-size: 13px; font-weight: bold; color: ${progressColor};">${progressPercent}%</span>
                </div>
                <div style="background: #334155; border-radius: 4px; height: 8px; overflow: hidden;">
                    <div style="background: ${progressColor}; height: 100%; width: ${Math.min(100, progressPercent)}%; border-radius: 4px;"></div>
                </div>
            </div>

            <!-- Tasks summary -->
            <div style="background: #0f172a; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
                <p style="font-size: 13px; color: #94a3b8; margin: 0;">
                    ✅ Hoàn thành: <strong style="color: #10b981;">${report.completedTasks} tasks</strong> &nbsp;|&nbsp;
                    ⏳ Chưa xong: <strong style="color: #f59e0b;">${report.pendingTasks} tasks</strong>
                </p>
            </div>

            ${report.missingPoints > 0 ? `
            <div style="background: #7c2d12; border: 1px solid #ea580c; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
                <p style="font-size: 14px; color: #fed7aa; margin: 0;">
                    ⚠️ Bạn cần hoàn thành thêm <strong>${report.missingPoints} points</strong> trong tuần này để đạt target!
                </p>
            </div>` : ''}

            <p style="font-size: 12px; color: #475569; text-align: center; margin-top: 24px;">
                Email tự động từ Ikame Creative Dashboard - Mỗi thứ 4 hàng tuần
            </p>
        </div>
    </body>
    </html>`
}

async function sendEmail(to: string, subject: string, html: string) {
    if (!RESEND_API_KEY) {
        console.log(`[MOCK EMAIL] To: ${to}, Subject: ${subject}`)
        return { success: true, mock: true }
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: FROM_EMAIL,
            to: [to],
            subject,
            html,
        }),
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Resend error: ${response.status} - ${error}`)
    }

    return await response.json()
}

export async function GET(request: NextRequest) {
    // Verify cron secret (optional security)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const reports = await buildReport(supabase)
        const weekStart = getWeekStartDate()
        const weekEnd = getWeekEndDate()

        const results = []
        for (const report of reports) {
            try {
                const subject = report.missingPoints > 0
                    ? `⚠️ Còn thiếu ${report.missingPoints} points - ${report.projectType} (tuần ${weekStart})`
                    : `✅ Đã đạt target - ${report.projectType} (tuần ${weekStart})`

                const html = buildEmailHtml(report, weekStart, weekEnd)
                const result = await sendEmail(report.email, subject, html)
                results.push({ email: report.email, status: 'sent', ...result })
            } catch (error) {
                results.push({ email: report.email, status: 'error', error: String(error) })
            }
        }

        return NextResponse.json({
            success: true,
            weekStart,
            weekEnd,
            totalMembers: reports.length,
            membersMissingTarget: reports.filter(r => r.missingPoints > 0).length,
            results,
        })
    } catch (error) {
        console.error('Weekly reminder error:', error)
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}
