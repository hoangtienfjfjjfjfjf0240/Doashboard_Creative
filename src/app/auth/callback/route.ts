import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const token_hash = requestUrl.searchParams.get('token_hash')
    const type = requestUrl.searchParams.get('type')

    const supabase = await createClient()

    if (code) {
        // OAuth or magic link flow
        await supabase.auth.exchangeCodeForSession(code)
    } else if (token_hash && type) {
        // Email confirmation or invite flow
        const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as 'invite' | 'signup' | 'email' | 'recovery' | 'email_change'
        })

        if (error) {
            console.error('Error verifying OTP:', error)
            // For invite, redirect to set password page
            if (type === 'invite') {
                return NextResponse.redirect(new URL('/set-password?error=' + encodeURIComponent(error.message), requestUrl.origin))
            }
            return NextResponse.redirect(new URL('/login?error=' + encodeURIComponent(error.message), requestUrl.origin))
        }

        // For invite, redirect to set password
        if (type === 'invite') {
            return NextResponse.redirect(new URL('/set-password', requestUrl.origin))
        }
    }

    return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
}
