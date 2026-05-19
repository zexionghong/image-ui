import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { NextFunction, Request, Response } from 'express'

export type AuthenticatedRequest = Request & {
  user: User
  supabase: SupabaseClient
}

type HeaderLike = Record<string, string | string[] | undefined>

function envValue(key: string) {
  return process.env[key]?.trim() || ''
}

export function getBearerToken(headers: HeaderLike) {
  const raw = headers.authorization ?? headers.Authorization
  const value = Array.isArray(raw) ? raw[0] : raw
  const match = value?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || ''
}

export function createRequestSupabaseClient(accessToken: string) {
  const url = envValue('SUPABASE_URL') || envValue('VITE_SUPABASE_URL')
  const anonKey = envValue('SUPABASE_ANON_KEY') || envValue('VITE_SUPABASE_ANON_KEY')

  if (!url || !anonKey) {
    throw new Error('Supabase is not configured')
  }

  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = getBearerToken(req.headers)
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const supabase = createRequestSupabaseClient(token)
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) return res.status(401).json({ error: 'Unauthorized' })

    const authed = req as AuthenticatedRequest
    authed.user = data.user
    authed.supabase = supabase
    next()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Supabase auth failed'
    res.status(500).json({ error: message })
  }
}
