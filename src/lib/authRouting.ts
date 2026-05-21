import { defaultLocale, locales } from '@/i18n/config'

const supportedLocales = new Set(locales)
const protectedSegments = new Set([
  'gallery',
  'editor',
  'generate',
  'resources',
  'settings',
  'video-generate',
  'workflow',
])

function normalizeLocale(locale?: string | null): string {
  return locale && supportedLocales.has(locale as any) ? locale : defaultLocale
}

function splitPath(pathname: string): string[] {
  return pathname.split('/').filter(Boolean)
}

function extractLocaleFromPath(pathname: string): string {
  const [maybeLocale] = splitPath(pathname)
  return normalizeLocale(maybeLocale)
}

function getProtectedSegment(pathname: string): string | null {
  const segments = splitPath(pathname)
  if (segments.length === 0) return null

  const [first, second] = segments
  if (second && protectedSegments.has(second)) return second
  if (supportedLocales.has(first as any)) return second ?? null
  return first
}

export function buildLoginRedirectTarget(locale: string | null | undefined, redirectPath: string): string {
  return `/${normalizeLocale(locale)}/login?redirect=${encodeURIComponent(redirectPath)}`
}

export function buildAuthRedirectPath(pathname: string, search = '', hash = ''): string {
  return buildLoginRedirectTarget(extractLocaleFromPath(pathname), `${pathname}${search}${hash}`)
}

export function getPostAuthDestination(locale: string | null | undefined, redirectParam?: string | null): string {
  const fallback = `/${normalizeLocale(locale)}/gallery`
  if (!redirectParam) return fallback

  if (
    redirectParam.startsWith('/') &&
    !redirectParam.startsWith('//') &&
    !redirectParam.includes('\\')
  ) {
    return redirectParam
  }

  return fallback
}

export function shouldRedirectOnUnauthorized(pathname: string): boolean {
  const protectedSegment = getProtectedSegment(pathname)
  return protectedSegment !== null && protectedSegments.has(protectedSegment)
}
