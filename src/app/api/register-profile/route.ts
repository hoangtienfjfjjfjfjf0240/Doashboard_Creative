import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
    try {
        const { userId, email, fullName } = await request.json() as {
            userId?: string
            email?: string
            fullName?: string
        }

        if (!userId || !email || !fullName?.trim()) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const normalizedEmail = email.trim().toLowerCase()
        const normalizedFullName = fullName.trim()

        const { data: authUserResult, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId)
        if (authUserError || !authUserResult.user) {
            return NextResponse.json({ error: 'Auth user not found' }, { status: 404 })
        }

        const authEmail = (authUserResult.user.email || '').trim().toLowerCase()
        if (!authEmail || authEmail !== normalizedEmail) {
            return NextResponse.json({ error: 'Email does not match auth user' }, { status: 400 })
        }

        const { error: upsertError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: userId,
                email: normalizedEmail,
                full_name: normalizedFullName,
                asana_email: normalizedEmail,
                asana_name: normalizedFullName,
                role: 'member',
                role_creative: 'none',
                role_graphic: 'none',
                role_dashboard: 'none',
                role_benchmark: 'none',
            }, {
                onConflict: 'id',
            })

        if (upsertError) {
            return NextResponse.json({ error: upsertError.message }, { status: 500 })
        }

        return NextResponse.json({ ok: true })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
