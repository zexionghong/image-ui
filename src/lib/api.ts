import { supabase } from './supabase'
import { buildAuthRedirectPath, shouldRedirectOnUnauthorized } from './authRouting'

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers)

  if (supabase) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(input, { ...init, headers })

  if (
    response.status === 401 &&
    typeof window !== 'undefined' &&
    shouldRedirectOnUnauthorized(window.location.pathname)
  ) {
    window.location.assign(buildAuthRedirectPath(window.location.pathname, window.location.search, window.location.hash))
  }

  return response
}
