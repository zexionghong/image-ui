import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'
import type { AuthProfile, AuthProfileRow } from '@/types/auth'

type AuthError = { message: string } | null

type AuthClient = {
  auth: {
    getSession: () => Promise<{ data: { session: Session | null }; error: AuthError }>
    signOut: () => Promise<{ error: AuthError }>
  }
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: AuthProfileRow | null; error: AuthError }>
      }
    }
  }
}

type AuthState = {
  initialized: boolean
  loading: boolean
  session: Session | null
  user: User | null
  profile: AuthProfile | null
  error: string | null
}

type AuthActions = {
  bootstrap: (client?: AuthClient | null) => Promise<void>
  signOut: (client?: AuthClient | null) => Promise<void>
}

export type AuthStore = AuthState & AuthActions

const PROFILE_SELECT = 'id,current_plan,full_name'

async function getDefaultAuthClient(): Promise<AuthClient | null> {
  try {
    const module = await import('@/lib/supabase')
    return (module.supabase as AuthClient | null) ?? null
  } catch {
    return null
  }
}

export function getDefaultAuthState(): AuthState {
  return {
    initialized: false,
    loading: false,
    session: null,
    user: null,
    profile: null,
    error: null,
  }
}

export function normalizeAuthProfile(profile: AuthProfileRow | null | undefined): AuthProfile | null {
  if (!profile?.id) return null

  return {
    id: profile.id,
    currentPlan: profile.current_plan ?? null,
    fullName: profile.full_name ?? null,
  }
}

export const useAuthStore = create<AuthStore>()((set) => ({
  ...getDefaultAuthState(),

  bootstrap: async (client) => {
    const resolvedClient = client ?? (await getDefaultAuthClient())
    set({ loading: true, error: null })

    if (!resolvedClient) {
      set({ ...getDefaultAuthState(), initialized: true })
      return
    }

    try {
      const { data, error } = await resolvedClient.auth.getSession()
      if (error) {
        set({ ...getDefaultAuthState(), initialized: true, error: error.message })
        return
      }

      const session = data.session ?? null
      const user = session?.user ?? null
      if (!user) {
        set({ ...getDefaultAuthState(), initialized: true })
        return
      }

      const { data: profileRow, error: profileError } = await resolvedClient
        .from('user_profiles')
        .select(PROFILE_SELECT)
        .eq('id', user.id)
        .maybeSingle()

      set({
        initialized: true,
        loading: false,
        session,
        user,
        profile: normalizeAuthProfile(profileRow),
        error: profileError?.message ?? null,
      })
    } catch (error) {
      set({
        ...getDefaultAuthState(),
        initialized: true,
        error: error instanceof Error ? error.message : 'Failed to initialize auth',
      })
    }
  },

  signOut: async (client) => {
    const resolvedClient = client ?? (await getDefaultAuthClient())
    set({ loading: true, error: null })

    if (resolvedClient) {
      const { error } = await resolvedClient.auth.signOut()
      if (error) {
        set({ loading: false, error: error.message })
        return
      }
    }

    set({ ...getDefaultAuthState(), initialized: true })
  },
}))
