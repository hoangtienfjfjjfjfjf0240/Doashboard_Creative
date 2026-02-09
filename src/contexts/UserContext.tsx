'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UserData {
    email: string
    role: string
    roleCreative: string
    roleGraphic: string
    fullName: string
    asanaEmail: string
    asanaName: string
}

interface UserContextType {
    user: UserData | null
    loading: boolean
    canAccessProject: (project: 'creative' | 'graphic') => boolean
    getProjectRole: (project: 'creative' | 'graphic') => string
}

const UserContext = createContext<UserContextType>({
    user: null,
    loading: true,
    canAccessProject: () => false,
    getProjectRole: () => 'none',
})

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserData | null>(null)
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    const fetchUserProfile = async () => {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('role, full_name, asana_email, asana_name, role_creative, role_graphic')
                .eq('id', authUser.id)
                .single()

            const userData: UserData = {
                email: authUser.email || '',
                role: profile?.role || 'member',
                roleCreative: profile?.role_creative || profile?.role || 'member',
                roleGraphic: profile?.role_graphic || 'none',
                fullName: profile?.full_name || '',
                asanaEmail: profile?.asana_email || authUser.email || '',
                asanaName: profile?.asana_name || profile?.full_name || '',
            }
            setUser(userData)
            localStorage.setItem('user_role_cache', JSON.stringify(userData))
            return userData
        }
        return null
    }

    useEffect(() => {
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
    }, [])

    const canAccessProject = (project: 'creative' | 'graphic'): boolean => {
        if (!user) return false
        // admin can access everything
        if (user.role === 'admin') return true
        const projectRole = project === 'creative' ? user.roleCreative : user.roleGraphic
        return projectRole !== 'none' && projectRole !== ''
    }

    const getProjectRole = (project: 'creative' | 'graphic'): string => {
        if (!user) return 'none'
        if (user.role === 'admin') return 'admin'
        return project === 'creative' ? user.roleCreative : user.roleGraphic
    }

    return (
        <UserContext.Provider value={{ user, loading, canAccessProject, getProjectRole }}>
            {children}
        </UserContext.Provider>
    )
}

export function useUser() {
    return useContext(UserContext)
}
