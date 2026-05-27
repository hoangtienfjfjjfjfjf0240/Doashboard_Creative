import { NextRequest, NextResponse } from 'next/server'
import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subDays } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { fetchAllPages } from '@/lib/supabase/fetchAllPages'
import { FALLBACK_TARGET, WORKING_DAYS_PER_WEEK, isTargetDeductionDay } from '@/lib/constants'

export const dynamic = 'force-dynamic'

type ProjectType = 'creative' | 'graphic'
type ProjectScope = 'all' | ProjectType
type RangePreset = 'week' | 'month' | 'last_30_days' | 'all'

interface DbTask {
    id: string
    asana_id: string | null
    name: string
    assignee_name: string | null
    assignee_email: string | null
    status: 'done' | 'not_done' | string
    due_date: string | null
    completed_at: string | null
    points: number | null
    video_count: number | null
    video_type: string | null
    project_type: ProjectType | null
    updated_at: string | null
}

interface DbTarget {
    user_gid: string
    week_start_date: string
    target_points: number
    project_type: ProjectType | null
}

interface DbDayOff {
    user_email: string | null
    member_name: string | null
    date: string
    is_half_day: boolean
}

interface DbProfile {
    full_name: string | null
    asana_name: string | null
    asana_email: string | null
    role: string | null
    role_creative: string | null
    role_graphic: string | null
}

interface MemberReport {
    name: string
    project: ProjectType
    totalTasks: number
    doneTasks: number
    notDoneTasks: number
    doneRate: number
    points: number
    notDonePoints: number
    target: number
    targetAfterDayOffs: number
    targetDeduction: number
    achievedRate: number
    gap: number
    overdueTasks: number
    lateDoneTasks: number
    onTimeDoneRate: number
}

interface ProjectReport {
    project: ProjectType
    label: string
    totalTasks: number
    doneTasks: number
    notDoneTasks: number
    doneRate: number
    points: number
    notDonePoints: number
    target: number
    targetAfterDayOffs: number
    achievedRate: number
    gap: number
    overdueTasks: number
    lateDoneTasks: number
    onTimeDoneRate: number
    members: MemberReport[]
    recentDoneTasks: ReportTask[]
    overdueTaskSamples: ReportTask[]
}

interface ReportTask {
    name: string
    assignee: string | null
    dueDate: string | null
    completedAt?: string | null
    points: number
    project: ProjectType
}

interface AgentReport {
    generatedAt: string
    range: {
        preset: RangePreset
        label: string
        start: string
        end: string
    }
    projectScope: ProjectScope
    projects: ProjectReport[]
    team: Omit<ProjectReport, 'project' | 'label' | 'members' | 'recentDoneTasks' | 'overdueTaskSamples'>
    members: MemberReport[]
    highlights: {
        topMembersByPoints: MemberReport[]
        membersBehindTarget: MemberReport[]
        membersWithMostOverdue: MemberReport[]
    }
    recentDoneTasks: ReportTask[]
    overdueTaskSamples: ReportTask[]
}

const PROJECT_LABEL: Record<ProjectType, string> = {
    creative: 'Video Creative',
    graphic: 'Graphic Design',
}

function normalizeName(name = '') {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s\u200B-\u200D\uFEFF]+/g, '')
        .toLowerCase()
        .trim()
}

function formatPoint(value: number) {
    const rounded = Math.round(value * 10) / 10
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function percent(numerator: number, denominator: number) {
    if (!denominator) return 0
    return Math.round((numerator / denominator) * 1000) / 10
}

function getRange(preset: RangePreset) {
    const today = new Date()
    if (preset === 'week') {
        const start = startOfWeek(today, { weekStartsOn: 1 })
        const end = endOfWeek(today, { weekStartsOn: 1 })
        return { start, end, label: 'tuần này' }
    }

    if (preset === 'last_30_days') {
        return { start: subDays(today, 29), end: today, label: '30 ngày gần nhất' }
    }

    if (preset === 'all') {
        return { start: new Date(2026, 1, 1), end: today, label: 'từ 01/02/2026 đến hôm nay' }
    }

    return { start: startOfMonth(today), end: endOfMonth(today), label: 'tháng này' }
}

function weekStartsBetween(start: Date, end: Date) {
    const weeks: string[] = []
    let cursor = startOfWeek(start, { weekStartsOn: 1 })
    while (cursor <= end) {
        weeks.push(format(cursor, 'yyyy-MM-dd'))
        cursor = addDays(cursor, 7)
    }
    return weeks
}

function taskReportDate(task: DbTask) {
    return task.due_date || task.completed_at?.split('T')[0] || task.updated_at?.split('T')[0] || null
}

function isTaskInRange(task: DbTask, preset: RangePreset, startStr: string, endStr: string) {
    if (preset === 'all') return true
    const date = taskReportDate(task)
    return Boolean(date && date >= startStr && date <= endStr)
}

function isLateDoneTask(task: DbTask) {
    if (task.status !== 'done' || !task.due_date || !task.completed_at) return false
    return task.completed_at.split('T')[0] > task.due_date
}

function hasProjectAccess(role: string | null | undefined) {
    return Boolean(role && role !== 'none')
}

function canManageRole(role: string | null | undefined) {
    return Boolean(role && ['admin', 'lead', 'manager'].includes(role))
}

function inferProjectScope(message: string, requested: ProjectScope | undefined): ProjectScope {
    if (requested) return requested
    const normalized = normalizeName(message)
    if (normalized.includes('graphic') || normalized.includes('design')) return 'graphic'
    if (normalized.includes('creative') || normalized.includes('video')) return 'creative'
    return 'all'
}

function inferRangePreset(message: string, requested: RangePreset | undefined): RangePreset {
    if (requested) return requested
    const normalized = normalizeName(message)
    if (normalized.includes('tuan') || normalized.includes('week')) return 'week'
    if (normalized.includes('30') || normalized.includes('gan day')) return 'last_30_days'
    if (normalized.includes('tat ca') || normalized.includes('all') || normalized.includes('tu dau')) return 'all'
    return 'month'
}

function taskToReportTask(task: DbTask): ReportTask {
    return {
        name: task.name,
        assignee: task.assignee_name,
        dueDate: task.due_date,
        completedAt: task.completed_at,
        points: Number(task.points) || 0,
        project: task.project_type || 'creative',
    }
}

function mergeMemberReports(members: MemberReport[]): MemberReport[] {
    const byName = new Map<string, MemberReport>()
    members.forEach(member => {
        const key = normalizeName(member.name)
        const existing = byName.get(key)
        if (!existing) {
            byName.set(key, { ...member, project: member.project })
            return
        }
        existing.totalTasks += member.totalTasks
        existing.doneTasks += member.doneTasks
        existing.notDoneTasks += member.notDoneTasks
        existing.points += member.points
        existing.notDonePoints += member.notDonePoints
        existing.target += member.target
        existing.targetAfterDayOffs += member.targetAfterDayOffs
        existing.targetDeduction += member.targetDeduction
        existing.gap = existing.points - existing.targetAfterDayOffs
        existing.overdueTasks += member.overdueTasks
        existing.lateDoneTasks += member.lateDoneTasks
        existing.doneRate = percent(existing.doneTasks, existing.totalTasks)
        existing.achievedRate = percent(existing.points, existing.targetAfterDayOffs)
        existing.onTimeDoneRate = percent(existing.doneTasks - existing.lateDoneTasks, existing.doneTasks)
    })
    return [...byName.values()].sort((a, b) => b.points - a.points)
}

function buildProjectReport(
    project: ProjectType,
    tasks: DbTask[],
    targets: DbTarget[],
    dayOffs: DbDayOff[],
    profiles: DbProfile[],
    weekStarts: string[],
    range: { preset: RangePreset; startStr: string; endStr: string },
    canSeeAll: boolean,
    self: { names: string[]; email: string }
): ProjectReport {
    const projectTasks = tasks
        .filter(task => task.project_type === project)
        .filter(task => isTaskInRange(task, range.preset, range.startStr, range.endStr))
        .filter(task => {
            if (canSeeAll) return true
            const taskName = normalizeName(task.assignee_name || '')
            const taskEmail = (task.assignee_email || '').toLowerCase().trim()
            return self.names.map(normalizeName).includes(taskName) || taskEmail === self.email.toLowerCase().trim()
        })

    const projectTargets = targets.filter(target => target.project_type === project)
    const profileNames = profiles
        .filter(profile => {
            const role = project === 'creative' ? profile.role_creative : profile.role_graphic
            if (!hasProjectAccess(role)) return false
            if (profile.role === 'admin' && !profile.asana_name) return false
            return true
        })
        .map(profile => profile.asana_name || profile.full_name)

    let memberNames = [...new Set([
        ...projectTasks.map(task => task.assignee_name),
        ...projectTargets.map(target => target.user_gid),
        ...profileNames,
    ].filter(Boolean))] as string[]

    if (!canSeeAll) {
        const selfNames = self.names.map(normalizeName)
        memberNames = memberNames.filter(name => selfNames.includes(normalizeName(name)))
        if (memberNames.length === 0 && self.names[0]) memberNames = [self.names[0]]
    }

    memberNames.sort((a, b) => a.localeCompare(b, 'vi'))

    const dedupedDayOffs = new Map<string, DbDayOff>()
    dayOffs.forEach(dayOff => {
        if (!dayOff.member_name || !dayOff.date) return
        if (dayOff.date < range.startStr || dayOff.date > range.endStr) return
        const key = `${normalizeName(dayOff.member_name)}|${dayOff.date}`
        const existing = dedupedDayOffs.get(key)
        if (!existing || dayOff.user_email === 'system@holiday') {
            dedupedDayOffs.set(key, dayOff)
        }
    })

    const getTargetForMemberWeek = (member: string, weekStart: string) => {
        const normalizedMember = normalizeName(member)
        const target = projectTargets.find(item =>
            normalizeName(item.user_gid) === normalizedMember &&
            item.week_start_date === weekStart
        )
        return Number(target?.target_points) || FALLBACK_TARGET
    }

    const members = memberNames.map((member): MemberReport => {
        const normalizedMember = normalizeName(member)
        const memberTasks = projectTasks.filter(task => normalizeName(task.assignee_name || '') === normalizedMember)
        const doneTasks = memberTasks.filter(task => task.status === 'done')
        const notDoneTasks = memberTasks.filter(task => task.status !== 'done')
        const points = doneTasks.reduce((sum, task) => sum + (Number(task.points) || 0), 0)
        const notDonePoints = notDoneTasks.reduce((sum, task) => sum + (Number(task.points) || 0), 0)
        const target = weekStarts.reduce((sum, weekStart) => sum + getTargetForMemberWeek(member, weekStart), 0)

        let targetDeduction = 0
        dedupedDayOffs.forEach(dayOff => {
            if (normalizeName(dayOff.member_name || '') !== normalizedMember) return
            const date = new Date(`${dayOff.date}T00:00:00`)
            if (!isTargetDeductionDay(date)) return
            const weekStart = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
            const ptsPerDay = getTargetForMemberWeek(member, weekStart) / WORKING_DAYS_PER_WEEK
            targetDeduction += dayOff.is_half_day ? ptsPerDay / 2 : ptsPerDay
        })

        const targetAfterDayOffs = Math.max(0, target - targetDeduction)
        const overdueTasks = notDoneTasks.filter(task => task.due_date && task.due_date < format(new Date(), 'yyyy-MM-dd')).length
        const lateDoneTasks = doneTasks.filter(isLateDoneTask).length

        return {
            name: member,
            project,
            totalTasks: memberTasks.length,
            doneTasks: doneTasks.length,
            notDoneTasks: notDoneTasks.length,
            doneRate: percent(doneTasks.length, memberTasks.length),
            points,
            notDonePoints,
            target,
            targetAfterDayOffs,
            targetDeduction,
            achievedRate: percent(points, targetAfterDayOffs),
            gap: points - targetAfterDayOffs,
            overdueTasks,
            lateDoneTasks,
            onTimeDoneRate: percent(doneTasks.length - lateDoneTasks, doneTasks.length),
        }
    })

    const doneTasks = projectTasks.filter(task => task.status === 'done')
    const notDoneTasks = projectTasks.filter(task => task.status !== 'done')
    const points = members.reduce((sum, member) => sum + member.points, 0)
    const notDonePoints = members.reduce((sum, member) => sum + member.notDonePoints, 0)
    const target = members.reduce((sum, member) => sum + member.target, 0)
    const targetAfterDayOffs = members.reduce((sum, member) => sum + member.targetAfterDayOffs, 0)
    const lateDoneTasks = members.reduce((sum, member) => sum + member.lateDoneTasks, 0)
    const overdueTasks = members.reduce((sum, member) => sum + member.overdueTasks, 0)

    return {
        project,
        label: PROJECT_LABEL[project],
        totalTasks: projectTasks.length,
        doneTasks: doneTasks.length,
        notDoneTasks: notDoneTasks.length,
        doneRate: percent(doneTasks.length, projectTasks.length),
        points,
        notDonePoints,
        target,
        targetAfterDayOffs,
        achievedRate: percent(points, targetAfterDayOffs),
        gap: points - targetAfterDayOffs,
        overdueTasks,
        lateDoneTasks,
        onTimeDoneRate: percent(doneTasks.length - lateDoneTasks, doneTasks.length),
        members,
        recentDoneTasks: doneTasks
            .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))
            .slice(0, 8)
            .map(taskToReportTask),
        overdueTaskSamples: notDoneTasks
            .filter(task => task.due_date && task.due_date < format(new Date(), 'yyyy-MM-dd'))
            .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
            .slice(0, 10)
            .map(taskToReportTask),
    }
}

function buildFallbackAnswer(question: string, report: AgentReport) {
    const normalizedQuestion = normalizeName(question)
    const mentionedMember = report.members.find(member => normalizedQuestion.includes(normalizeName(member.name)))

    if (mentionedMember) {
        return [
            `Report nhanh cho ${mentionedMember.name} (${PROJECT_LABEL[mentionedMember.project]}):`,
            `- Done: ${mentionedMember.doneTasks}/${mentionedMember.totalTasks} task (${formatPoint(mentionedMember.doneRate)}%).`,
            `- Points: ${formatPoint(mentionedMember.points)}/${formatPoint(mentionedMember.targetAfterDayOffs)} pts (${formatPoint(mentionedMember.achievedRate)}%).`,
            `- Gap target: ${mentionedMember.gap >= 0 ? '+' : ''}${formatPoint(mentionedMember.gap)} pts.`,
            `- Chưa done: ${mentionedMember.notDoneTasks} task, overdue: ${mentionedMember.overdueTasks} task.`,
            `- On-time done rate: ${formatPoint(mentionedMember.onTimeDoneRate)}%.`,
        ].join('\n')
    }

    const behind = report.highlights.membersBehindTarget
        .slice(0, 5)
        .map(member => `${member.name}: ${formatPoint(member.points)}/${formatPoint(member.targetAfterDayOffs)} pts (${member.gap >= 0 ? '+' : ''}${formatPoint(member.gap)})`)
        .join('; ')

    const overdue = report.highlights.membersWithMostOverdue
        .slice(0, 5)
        .filter(member => member.overdueTasks > 0)
        .map(member => `${member.name}: ${member.overdueTasks}`)
        .join('; ')

    return [
        `Report ${report.range.label} (${report.range.start} -> ${report.range.end}):`,
        `- Team done: ${report.team.doneTasks}/${report.team.totalTasks} task (${formatPoint(report.team.doneRate)}%).`,
        `- Team points: ${formatPoint(report.team.points)}/${formatPoint(report.team.targetAfterDayOffs)} pts (${formatPoint(report.team.achievedRate)}%).`,
        `- Gap target: ${report.team.gap >= 0 ? '+' : ''}${formatPoint(report.team.gap)} pts.`,
        `- Chưa done: ${report.team.notDoneTasks} task, overdue: ${report.team.overdueTasks} task.`,
        `- On-time done rate: ${formatPoint(report.team.onTimeDoneRate)}%.`,
        behind ? `- Member cần chú ý: ${behind}.` : '- Chưa có member nào thiếu target trong phạm vi này.',
        overdue ? `- Overdue nhiều nhất: ${overdue}.` : '- Không có overdue task trong phạm vi này.',
    ].join('\n')
}

function cleanAgentAnswer(answer: string) {
    return answer
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^\s*[*]\s+/gm, '- ')
        .replace(/^\s*[-]\s*[*]\s+/gm, '- ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

function compactReportForAi(report: AgentReport) {
    return {
        generatedAt: report.generatedAt,
        range: report.range,
        projectScope: report.projectScope,
        team: report.team,
        projects: report.projects.map(project => ({
            project: project.project,
            label: project.label,
            totalTasks: project.totalTasks,
            doneTasks: project.doneTasks,
            notDoneTasks: project.notDoneTasks,
            doneRate: project.doneRate,
            points: project.points,
            targetAfterDayOffs: project.targetAfterDayOffs,
            achievedRate: project.achievedRate,
            gap: project.gap,
            overdueTasks: project.overdueTasks,
            onTimeDoneRate: project.onTimeDoneRate,
        })),
        members: report.members.map(member => ({
            name: member.name,
            project: member.project,
            totalTasks: member.totalTasks,
            doneTasks: member.doneTasks,
            notDoneTasks: member.notDoneTasks,
            doneRate: member.doneRate,
            points: member.points,
            targetAfterDayOffs: member.targetAfterDayOffs,
            achievedRate: member.achievedRate,
            gap: member.gap,
            overdueTasks: member.overdueTasks,
            onTimeDoneRate: member.onTimeDoneRate,
        })),
        highlights: report.highlights,
        recentDoneTasks: report.recentDoneTasks,
        overdueTaskSamples: report.overdueTaskSamples,
    }
}

async function callAi(question: string, report: AgentReport) {
    const baseUrl = process.env.AI_BASE_URL?.replace(/\/+$/, '')
    const apiKey = process.env.AI_API_KEY
    if (!baseUrl || !apiKey) return null

    const model = process.env.AI_MODEL || 'gemini-2.5-flash'
    const endpoints = baseUrl.endsWith('/v1')
        ? [`${baseUrl}/chat/completions`]
        : [`${baseUrl}/v1/chat/completions`, `${baseUrl}/chat/completions`]

    const systemPrompt = [
        'Bạn là AI report agent cho Creative Dashboard.',
        'Chỉ dùng dữ liệu JSON được cung cấp, không bịa số liệu.',
        'Trả lời tiếng Việt tự nhiên, ngắn gọn, đúng ngữ cảnh dashboard.',
        'Không dùng Markdown bold, không dùng dấu sao, không bọc tên bằng **.',
        'Nếu cần liệt kê thì mỗi dòng bắt đầu bằng dấu gạch ngang "-".',
        'Nếu user hỏi về member/task/tỉ lệ done/target/overdue, nêu số cụ thể và kết luận hành động.',
        'Nếu dữ liệu không có trong JSON, nói rõ là chưa có dữ liệu trong phạm vi đang xem.',
    ].join(' ')

    const payload = {
        model,
        temperature: 0.2,
        max_tokens: 1600,
        messages: [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: [
                    `Câu hỏi: ${question}`,
                    `Dữ liệu report JSON: ${JSON.stringify(compactReportForAi(report))}`,
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
            if (typeof openAiText === 'string' && openAiText.trim()) return cleanAgentAnswer(openAiText)

            const geminiParts = data?.candidates?.[0]?.content?.parts
            if (Array.isArray(geminiParts)) {
                const text = geminiParts.map((part: { text?: string }) => part.text || '').join('').trim()
                if (text) return cleanAgentAnswer(text)
            }
        } catch {
            // Try the next compatible endpoint before falling back.
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
    const question = typeof body.message === 'string' && body.message.trim()
        ? body.message.trim()
        : 'Tóm tắt tình hình team hiện tại'

    const projectScope = inferProjectScope(question, body.project as ProjectScope | undefined)
    const rangePreset = inferRangePreset(question, body.range as RangePreset | undefined)
    const rangeDates = getRange(rangePreset)
    const range = {
        preset: rangePreset,
        label: rangeDates.label,
        startStr: format(rangeDates.start, 'yyyy-MM-dd'),
        endStr: format(rangeDates.end, 'yyyy-MM-dd'),
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, asana_name, asana_email, role, role_creative, role_graphic')
        .eq('id', user.id)
        .maybeSingle()

    const globalRole = profile?.role || 'member'
    const accessibleProjects: ProjectType[] = []
    if (globalRole === 'admin' || hasProjectAccess(profile?.role_creative) || hasProjectAccess(globalRole)) {
        accessibleProjects.push('creative')
    }
    if (globalRole === 'admin' || hasProjectAccess(profile?.role_graphic)) {
        accessibleProjects.push('graphic')
    }

    const requestedProjects = projectScope === 'all' ? accessibleProjects : [projectScope]
    const projects = requestedProjects.filter((project, index, array) =>
        accessibleProjects.includes(project) && array.indexOf(project) === index
    )

    if (projects.length === 0) {
        return NextResponse.json({ error: 'No project access' }, { status: 403 })
    }

    const canSeeAll = canManageRole(globalRole) ||
        projects.some(project => canManageRole(project === 'creative' ? profile?.role_creative : profile?.role_graphic))

    const self = {
        names: [profile?.asana_name, profile?.full_name, user.email].filter(Boolean) as string[],
        email: profile?.asana_email || user.email || '',
    }

    const [tasks, targets, dayOffs, profiles] = await Promise.all([
        fetchAllPages<DbTask>((from, to) =>
            supabase
                .from('tasks')
                .select('id, asana_id, name, assignee_name, assignee_email, status, due_date, completed_at, points, video_count, video_type, project_type, updated_at')
                .in('project_type', projects)
                .order('updated_at', { ascending: false })
                .range(from, to)
        ),
        fetchAllPages<DbTarget>((from, to) =>
            supabase
                .from('targets')
                .select('user_gid, week_start_date, target_points, project_type')
                .in('project_type', projects)
                .order('week_start_date', { ascending: true })
                .range(from, to)
        ),
        fetchAllPages<DbDayOff>((from, to) =>
            supabase
                .from('day_offs')
                .select('user_email, member_name, date, is_half_day')
                .order('date', { ascending: true })
                .range(from, to)
        ),
        fetchAllPages<DbProfile>((from, to) =>
            supabase
                .from('profiles')
                .select('full_name, asana_name, asana_email, role, role_creative, role_graphic')
                .order('full_name', { ascending: true })
                .range(from, to)
        ),
    ])

    const weekStarts = weekStartsBetween(rangeDates.start, rangeDates.end)
    const projectReports = projects.map(project =>
        buildProjectReport(project, tasks, targets, dayOffs, profiles, weekStarts, range, canSeeAll, self)
    )

    const allMembers = mergeMemberReports(projectReports.flatMap(project => project.members))
    const totalTasks = projectReports.reduce((sum, project) => sum + project.totalTasks, 0)
    const doneTasks = projectReports.reduce((sum, project) => sum + project.doneTasks, 0)
    const notDoneTasks = projectReports.reduce((sum, project) => sum + project.notDoneTasks, 0)
    const points = projectReports.reduce((sum, project) => sum + project.points, 0)
    const notDonePoints = projectReports.reduce((sum, project) => sum + project.notDonePoints, 0)
    const target = projectReports.reduce((sum, project) => sum + project.target, 0)
    const targetAfterDayOffs = projectReports.reduce((sum, project) => sum + project.targetAfterDayOffs, 0)
    const overdueTasks = projectReports.reduce((sum, project) => sum + project.overdueTasks, 0)
    const lateDoneTasks = projectReports.reduce((sum, project) => sum + project.lateDoneTasks, 0)

    const report: AgentReport = {
        generatedAt: new Date().toISOString(),
        range: {
            preset: rangePreset,
            label: rangeDates.label,
            start: range.startStr,
            end: range.endStr,
        },
        projectScope,
        projects: projectReports,
        team: {
            totalTasks,
            doneTasks,
            notDoneTasks,
            doneRate: percent(doneTasks, totalTasks),
            points,
            notDonePoints,
            target,
            targetAfterDayOffs,
            achievedRate: percent(points, targetAfterDayOffs),
            gap: points - targetAfterDayOffs,
            overdueTasks,
            lateDoneTasks,
            onTimeDoneRate: percent(doneTasks - lateDoneTasks, doneTasks),
        },
        members: allMembers,
        highlights: {
            topMembersByPoints: [...allMembers].sort((a, b) => b.points - a.points).slice(0, 5),
            membersBehindTarget: [...allMembers].filter(member => member.gap < 0).sort((a, b) => a.gap - b.gap).slice(0, 5),
            membersWithMostOverdue: [...allMembers].sort((a, b) => b.overdueTasks - a.overdueTasks).slice(0, 5),
        },
        recentDoneTasks: projectReports.flatMap(project => project.recentDoneTasks).slice(0, 10),
        overdueTaskSamples: projectReports.flatMap(project => project.overdueTaskSamples).slice(0, 12),
    }

    const aiAnswer = await callAi(question, report)
    const answer = cleanAgentAnswer(aiAnswer || buildFallbackAnswer(question, report))

    return NextResponse.json({
        answer,
        aiUsed: Boolean(aiAnswer),
        report,
    })
}
