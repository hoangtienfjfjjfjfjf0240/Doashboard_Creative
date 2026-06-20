'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UserData {
    email: string
    role: string
    roleCreative: string
    roleGraphic: string
    roleDashboard: string
    roleBenchmark: string
    fullName: string
    asanaEmail: string
    asanaName: string
}

interface UserContextType {
    user: UserData | null
    loading: boolean
    canAccessProject: (project: 'creative' | 'graphic') => boolean
    canAccessFeature: (feature: 'dashboard' | 'benchmark') => boolean
    getProjectRole: (project: 'creative' | 'graphic') => string
}

const UserContext = createContext<UserContextType>({
    user: null,
    loading: true,
    canAccessProject: () => false,
    canAccessFeature: () => false,
    getProjectRole: () => 'none',
})

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserData | null>(null)
    const [loading, setLoading] = useState(true)
    const supabase = useMemo(() => createClient(), [])

    const fetchUserProfile = useCallback(async () => {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
            const profileResult = await supabase
                .from('profiles')
                .select('role, full_name, asana_email, asana_name, role_creative, role_graphic')
                .eq('id', authUser.id)
                .single()

            const profile = profileResult.data as {
                role?: string | null
                role_creative?: string | null
                role_graphic?: string | null
                full_name?: string | null
                asana_email?: string | null
                asana_name?: string | null
            } | null
            const hasProfile = Boolean(profile)
            const globalRole = profile?.role || 'member'
            const creativeRole = hasProfile ? (profile?.role_creative || globalRole) : 'none'
            const graphicRole = hasProfile ? (profile?.role_graphic || 'none') : 'none'
            const dashboardRole = globalRole === 'admin'
                ? 'admin'
                : creativeRole && creativeRole !== 'none' && creativeRole !== 'idea_creator'
                    ? creativeRole
                    : 'none'
            const benchmarkRole = globalRole === 'admin'
                ? 'admin'
                : creativeRole && creativeRole !== 'none'
                    ? creativeRole
                    : graphicRole && graphicRole !== 'none'
                        ? graphicRole
                        : 'none'
            const userData: UserData = {
                email: authUser.email || '',
                role: globalRole,
                roleCreative: creativeRole,
                roleGraphic: graphicRole,
                roleDashboard: dashboardRole,
                roleBenchmark: benchmarkRole,
                fullName: profile?.full_name || '',
                asanaEmail: profile?.asana_email || authUser.email || '',
                asanaName: profile?.asana_name || profile?.full_name || '',
            }
            setUser(userData)
            localStorage.setItem('user_role_cache', JSON.stringify(userData))
            return userData
        }
        return null
    }, [supabase])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchUserProfile().finally(() => setLoading(false))

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT' || !session) {
                setUser(null)
                localStorage.removeItem('user_role_cache')
            } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                localStorage.removeItem('user_role_cache')
                fetchUserProfile()
            }
        })

        return () => subscription.unsubscribe()
    }, [fetchUserProfile, supabase.auth])

    const canAccessProject = (project: 'creative' | 'graphic'): boolean => {
        if (!user) return false
        // admin can access everything
        if (user.role === 'admin') return true
        const projectRole = project === 'creative' ? user.roleCreative : user.roleGraphic
        return projectRole !== 'none' && projectRole !== ''
    }

    const canAccessFeature = (feature: 'dashboard' | 'benchmark'): boolean => {
        if (!user) return false
        if (user.role === 'admin') return true
        if (feature === 'dashboard') {
            return user.roleCreative !== 'none' && user.roleCreative !== '' && user.roleCreative !== 'idea_creator'
        }
        return (
            (user.roleCreative !== 'none' && user.roleCreative !== '')
            || (user.roleGraphic !== 'none' && user.roleGraphic !== '')
        )
    }

    const getProjectRole = (project: 'creative' | 'graphic'): string => {
        if (!user) return 'none'
        if (user.role === 'admin') return 'admin'
        return project === 'creative' ? user.roleCreative : user.roleGraphic
    }

    return (
        <UserContext.Provider value={{ user, loading, canAccessProject, canAccessFeature, getProjectRole }}>
            {children}
        </UserContext.Provider>
    )
}

export function useUser() {
    return useContext(UserContext)
}
