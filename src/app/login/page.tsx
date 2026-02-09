'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) {
                setError(error.message)
            } else {
                // Check user profile to determine redirect destination
                try {
                    const { data: { user: authUser } } = await supabase.auth.getUser()
                    if (authUser) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('role, role_graphic')
                            .eq('id', authUser.id)
                            .single()

                        // If user has graphic design role, go to graphic dashboard
                        if (profile?.role_graphic && profile.role_graphic !== 'none') {
                            router.push('/graphic-dashboard')
                        } else {
                            router.push('/dashboard')
                        }
                    } else {
                        router.push('/dashboard')
                    }
                } catch {
                    // If profile query fails, default to dashboard
                    router.push('/dashboard')
                }
                router.refresh()
            }
        } catch {
            setError('An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center mb-8">
                        <img
                            src="/ikame-logo.png"
                            alt="Ikame Global"
                            className="w-24 h-24 object-contain rounded-2xl shadow-lg shadow-purple-500/25"
                        />
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent tracking-widest leading-relaxed">
                        Ikame Creative Dashboard
                    </h1>
                    <p className="text-slate-400 mt-4 text-base tracking-wider leading-relaxed">
                        Quản lý hiệu suất đội ngũ Creative
                    </p>
                </div>

                {/* Card */}
                <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-10 shadow-2xl border border-white/10">
                    <h2 className="text-2xl font-semibold text-white mb-8 tracking-widest text-center">
                        Đăng nhập
                    </h2>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2.5 tracking-wide">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                placeholder="you@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2.5 tracking-wide">
                                Mật khẩu
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-medium rounded-xl shadow-lg shadow-purple-500/25 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Đang đăng nhập...
                                </span>
                            ) : (
                                'Đăng nhập'
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-slate-400">
                            Chưa có tài khoản?{' '}
                            <Link href="/register" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                                Đăng ký
                            </Link>
                        </p>
                    </div>
                </div>

                <p className="mt-8 text-center text-sm text-slate-500">
                    Creative Team Performance Dashboard
                </p>
            </div>
        </div>
    )
}
