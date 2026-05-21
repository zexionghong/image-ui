# Auth Compatibility With PropAI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add localized login/register flows, a shared auth/session/profile layer, and protected-route redirects so `image-ui` reuses the same Supabase-backed user model and account experience as `propai`.

**Architecture:** Keep TanStack Router and the current Express API, but move auth concerns into a dedicated frontend session layer. Public auth pages (`/$locale/login`, `/$locale/register`) become the only entry points for sign-in/sign-up, while protected app routes and `401` fallback redirects both target localized login with a `redirect` query.

**Tech Stack:** React 18, TanStack Router, Zustand, Supabase JS, TypeScript, tsx-based regression tests

---

## File Structure

### Create

- `src/store/useAuthStore.ts` — central client auth/session/profile state and bootstrap logic
- `src/types/auth.ts` — lightweight shared types for auth profile data used by the UI
- `src/components/auth/AuthCard.tsx` — shared auth page shell for login/register
- `src/components/auth/LoginPage.tsx` — localized login form with redirect handling
- `src/components/auth/RegisterPage.tsx` — localized register form with post-sign-up handling
- `tests/authStore.test.ts` — focused tests for auth state transitions and profile normalization helpers

### Modify

- `src/app.tsx` — add public auth routes and update protected-route guards to use login redirect
- `src/lib/authRouting.ts` — switch redirect targets from settings to login and add redirect-query helpers
- `src/lib/api.ts` — send `401` fallback to localized login with current path
- `src/components/shared/SettingsPage.tsx` — remove embedded login form; show current account summary and logout
- `src/components/layout/Sidebar.tsx` — keep settings link, but ensure labels and destinations remain valid after auth-route split
- `src/components/layout/Header.tsx` — recognize login/register titles if needed
- `src/i18n/locales/zh.json` — add auth page strings and account-summary strings
- `src/i18n/locales/en.json` — add auth page strings and account-summary strings
- `tests/authRouting.test.ts` — expand redirect expectations to `/$locale/login` and redirect query behavior

### Existing Files To Read Before Editing

- `src/lib/supabase.ts`
- `src/store/useThemeStore.ts`
- `src/components/shared/LanguageSwitch.tsx`
- `src/components/shared/SettingsPage.tsx`
- `D:\codes\propai\app\(auth)\login\page.tsx`
- `D:\codes\propai\app\(auth)\register\page.tsx`

---

### Task 1: Finish Auth Routing Helpers

**Files:**
- Modify: `src/lib/authRouting.ts`
- Test: `tests/authRouting.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict'
import {
  buildAuthRedirectPath,
  buildLoginRedirectTarget,
  getPostAuthDestination,
  shouldRedirectOnUnauthorized,
} from '../src/lib/authRouting'

assert.equal(buildAuthRedirectPath('/zh/gallery'), '/zh/login?redirect=%2Fzh%2Fgallery')
assert.equal(buildAuthRedirectPath('/en/settings'), '/en/login?redirect=%2Fen%2Fsettings')
assert.equal(buildLoginRedirectTarget('/zh/video-generate'), '/zh/login?redirect=%2Fzh%2Fvideo-generate')
assert.equal(getPostAuthDestination('/zh/login?redirect=%2Fzh%2Fresources', 'zh'), '/zh/resources')
assert.equal(getPostAuthDestination('/zh/login', 'zh'), '/zh/gallery')
assert.equal(shouldRedirectOnUnauthorized('/zh/settings'), true)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm.cmd exec tsx tests/authRouting.test.ts`  
Expected: FAIL because login redirect helpers or settings protection behavior do not match the assertions

- [ ] **Step 3: Write minimal implementation**

```ts
import { defaultLocale, locales, type Locale } from '@/i18n/config'

const protectedSegments = new Set([
  'gallery',
  'generate',
  'resources',
  'video-generate',
  'workflow',
  'editor',
  'settings',
])

export function getLocaleFromPathname(pathname: string): Locale {
  const [, maybeLocale] = pathname.split('/')
  return locales.includes(maybeLocale as Locale) ? (maybeLocale as Locale) : defaultLocale
}

export function isProtectedAppPath(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean)
  const routeIndex = locales.includes(parts[0] as Locale) ? 1 : 0
  const segment = parts[routeIndex] || ''
  return protectedSegments.has(segment)
}

export function buildLoginRedirectTarget(pathname: string): string {
  const locale = getLocaleFromPathname(pathname)
  return `/${locale}/login?redirect=${encodeURIComponent(pathname)}`
}

export function buildAuthRedirectPath(pathname: string): string {
  return buildLoginRedirectTarget(pathname)
}

export function getPostAuthDestination(currentUrl: string, locale: Locale): string {
  const url = new URL(currentUrl, 'http://local.test')
  return url.searchParams.get('redirect') || `/${locale}/gallery`
}

export function shouldRedirectOnUnauthorized(pathname: string): boolean {
  return isProtectedAppPath(pathname)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm.cmd exec tsx tests/authRouting.test.ts`  
Expected: PASS with `authRouting tests passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/authRouting.ts tests/authRouting.test.ts
git commit -m "feat: route unauthenticated users to localized login"
```

---

### Task 2: Add Shared Auth Store And Profile Bootstrap

**Files:**
- Create: `src/types/auth.ts`
- Create: `src/store/useAuthStore.ts`
- Test: `tests/authStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict'
import { normalizeAuthProfile, getDefaultAuthState } from '../src/store/useAuthStore'

assert.deepEqual(getDefaultAuthState(), {
  initialized: false,
  loading: false,
  session: null,
  user: null,
  profile: null,
  error: null,
})

assert.deepEqual(
  normalizeAuthProfile({ id: 'u1', current_plan: 'pro', full_name: 'Ada' }),
  { id: 'u1', currentPlan: 'pro', fullName: 'Ada' }
)

assert.equal(normalizeAuthProfile(null), null)
console.log('authStore tests passed')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm.cmd exec tsx tests/authStore.test.ts`  
Expected: FAIL because `useAuthStore.ts` and helper exports do not exist yet

- [ ] **Step 3: Write minimal implementation**

```ts
// src/types/auth.ts
export interface AuthProfile {
  id: string
  currentPlan?: string | null
  fullName?: string | null
}

// src/store/useAuthStore.ts
import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { AuthProfile } from '@/types/auth'

export interface AuthState {
  initialized: boolean
  loading: boolean
  session: Session | null
  user: User | null
  profile: AuthProfile | null
  error: string | null
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

export function normalizeAuthProfile(row: any): AuthProfile | null {
  if (!row?.id) return null
  return {
    id: row.id,
    currentPlan: row.current_plan ?? null,
    fullName: row.full_name ?? null,
  }
}

export const useAuthStore = create<AuthState & {
  bootstrap: () => Promise<void>
  signOut: () => Promise<void>
}>((set) => ({
  ...getDefaultAuthState(),
  bootstrap: async () => {
    if (!supabase) {
      set({ initialized: true })
      return
    }
    set({ loading: true, error: null })
    const { data: sessionData } = await supabase.auth.getSession()
    const session = sessionData.session ?? null
    const user = session?.user ?? null
    let profile: AuthProfile | null = null

    if (user) {
      const { data } = await supabase.from('user_profiles').select('id,current_plan,full_name').eq('id', user.id).maybeSingle()
      profile = normalizeAuthProfile(data)
    }

    set({ initialized: true, loading: false, session, user, profile })
  },
  signOut: async () => {
    if (supabase) await supabase.auth.signOut()
    set({ ...getDefaultAuthState(), initialized: true })
  },
}))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm.cmd exec tsx tests/authStore.test.ts`  
Expected: PASS with `authStore tests passed`

- [ ] **Step 5: Commit**

```bash
git add src/types/auth.ts src/store/useAuthStore.ts tests/authStore.test.ts
git commit -m "feat: add shared auth session store"
```

---

### Task 3: Add Localized Login And Register Pages

**Files:**
- Create: `src/components/auth/AuthCard.tsx`
- Create: `src/components/auth/LoginPage.tsx`
- Create: `src/components/auth/RegisterPage.tsx`
- Modify: `src/i18n/locales/zh.json`
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: Write the failing test**

```ts
// Extend tests/authRouting.test.ts with redirect fallback coverage
import assert from 'node:assert/strict'
import { getPostAuthDestination } from '../src/lib/authRouting'

assert.equal(getPostAuthDestination('/en/register?redirect=%2Fen%2Fworkflow', 'en'), '/en/workflow')
assert.equal(getPostAuthDestination('/en/register', 'en'), '/en/gallery')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm.cmd exec tsx tests/authRouting.test.ts`  
Expected: FAIL because register/login redirect parsing is incomplete or untranslated labels are not yet wired

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/auth/LoginPage.tsx
import { useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { getPostAuthDestination } from '@/lib/authRouting'
import { useLocale, useTranslations } from '@/i18n/compat/client'
import { useAuthStore } from '@/store/useAuthStore'

export function LoginPage() {
  const locale = useLocale()
  const t = useTranslations('auth')
  const navigate = useNavigate()
  const location = useRouterState({ select: (s) => s.location.href })
  const bootstrap = useAuthStore((s) => s.bootstrap)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supabase) return setError(t('supabaseUnavailable'))
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    await bootstrap()
    await navigate({ to: getPostAuthDestination(location, locale) })
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* email, password, error text, submit button, link to `/${locale}/register` */}
    </form>
  )
}

// src/components/auth/RegisterPage.tsx
import { useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { getPostAuthDestination } from '@/lib/authRouting'
import { useLocale, useTranslations } from '@/i18n/compat/client'
import { useAuthStore } from '@/store/useAuthStore'

export function RegisterPage() {
  const locale = useLocale()
  const t = useTranslations('auth')
  const navigate = useNavigate()
  const location = useRouterState({ select: (s) => s.location.href })
  const bootstrap = useAuthStore((s) => s.bootstrap)
  const [done, setDone] = useState(false)
  // same field state as login

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const { data, error } = await supabase!.auth.signUp({ email, password })
    if (error) return setError(error.message)
    if (data.session) {
      await bootstrap()
      await navigate({ to: getPostAuthDestination(location, locale) })
      return
    }
    setDone(true)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm.cmd exec tsx tests/authRouting.test.ts`  
Expected: PASS with redirect fallback assertions still green

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/AuthCard.tsx src/components/auth/LoginPage.tsx src/components/auth/RegisterPage.tsx src/i18n/locales/zh.json src/i18n/locales/en.json tests/authRouting.test.ts
git commit -m "feat: add localized login and register pages"
```

---

### Task 4: Wire Routes, Session Bootstrap, And 401 Fallback

**Files:**
- Modify: `src/app.tsx`
- Modify: `src/lib/api.ts`
- Modify: `src/lib/authRouting.ts`

- [ ] **Step 1: Write the failing test**

```ts
// Keep using tests/authRouting.test.ts
import assert from 'node:assert/strict'
import { shouldRedirectOnUnauthorized } from '../src/lib/authRouting'

assert.equal(shouldRedirectOnUnauthorized('/zh/login'), false)
assert.equal(shouldRedirectOnUnauthorized('/zh/register'), false)
assert.equal(shouldRedirectOnUnauthorized('/zh/settings'), true)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm.cmd exec tsx tests/authRouting.test.ts`  
Expected: FAIL if login/register are treated like protected app pages or settings is not yet protected consistently

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/app.tsx
import { useEffect } from 'react'
import { LoginPage } from '@/components/auth/LoginPage'
import { RegisterPage } from '@/components/auth/RegisterPage'
import { useAuthStore } from '@/store/useAuthStore'
import { buildLoginRedirectTarget } from '@/lib/authRouting'

function RootLayout() {
  const bootstrap = useAuthStore((s) => s.bootstrap)
  useEffect(() => {
    void bootstrap()
  }, [bootstrap])
  return <Outlet />
}

async function requireAuthBeforeLoad(pathname: string) {
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  if (data.session?.access_token) return
  throw redirect({ to: buildLoginRedirectTarget(pathname) })
}

const loginRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: '/login',
  component: () => <LoginPage />,
})

const registerRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: '/register',
  component: () => <RegisterPage />,
})
```

```ts
// src/lib/api.ts
const response = await fetch(input, { ...init, headers })
if (response.status === 401 && typeof window !== 'undefined' && shouldRedirectOnUnauthorized(window.location.pathname)) {
  window.location.assign(buildLoginRedirectTarget(window.location.pathname))
}
return response
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm.cmd exec tsx tests/authRouting.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app.tsx src/lib/api.ts src/lib/authRouting.ts
git commit -m "feat: protect routes with localized auth redirects"
```

---

### Task 5: Convert Settings Into An Authenticated Account Page

**Files:**
- Modify: `src/components/shared/SettingsPage.tsx`
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/i18n/locales/zh.json`
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 1: Write the failing test**

```ts
// Extend tests/authRouting.test.ts to lock settings behavior
import assert from 'node:assert/strict'
import { shouldRedirectOnUnauthorized } from '../src/lib/authRouting'

assert.equal(shouldRedirectOnUnauthorized('/zh/settings'), true)
console.log('settings must remain protected')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm.cmd exec tsx tests/authRouting.test.ts`  
Expected: FAIL if settings is still conceptually treated as the public login surface

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/shared/SettingsPage.tsx
import { useAuthStore } from '@/store/useAuthStore'
import { useLocale, useTranslations } from '@/i18n/compat/client'
import { useNavigate } from '@tanstack/react-router'

export function SettingsPage() {
  const t = useTranslations('settings')
  const locale = useLocale()
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuthStore()

  const handleSignOut = async () => {
    await signOut()
    await navigate({ to: `/${locale}/login` })
  }

  return (
    <div>
      {/* remove email/password inputs */}
      {/* show current email */}
      {/* show currentPlan from profile when present */}
      {/* keep existing app config cards */}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm.cmd exec tsx tests/authRouting.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/SettingsPage.tsx src/components/layout/Header.tsx src/components/layout/Sidebar.tsx src/i18n/locales/zh.json src/i18n/locales/en.json
git commit -m "feat: turn settings into authenticated account page"
```

---

### Task 6: Run Focused Verification

**Files:**
- Test: `tests/authRouting.test.ts`
- Test: `tests/authStore.test.ts`
- Verify: `src/app.tsx`
- Verify: `src/components/auth/LoginPage.tsx`
- Verify: `src/components/auth/RegisterPage.tsx`
- Verify: `src/components/shared/SettingsPage.tsx`

- [ ] **Step 1: Run auth routing regression**

Run: `pnpm.cmd exec tsx tests/authRouting.test.ts`  
Expected: PASS with `authRouting tests passed`

- [ ] **Step 2: Run auth store regression**

Run: `pnpm.cmd exec tsx tests/authStore.test.ts`  
Expected: PASS with `authStore tests passed`

- [ ] **Step 3: Run TypeScript check**

Run: `pnpm.cmd exec tsc --noEmit`  
Expected: no new auth-related type errors; if pre-existing project errors remain, document them separately instead of masking them

- [ ] **Step 4: Manual verification**

Run the dev app and confirm:

```text
1. Open /zh/gallery while logged out -> redirected to /zh/login?redirect=%2Fzh%2Fgallery
2. Sign in -> returned to /zh/gallery
3. Open /zh/settings while logged out -> redirected to /zh/login?redirect=%2Fzh%2Fsettings
4. Open /zh/register and create an account
5. If session is created immediately, redirected to original page; otherwise shown email-confirmation state
6. Open settings while logged in -> see account summary and sign-out button, no login form
7. Sign out from settings -> redirected to /zh/login
```

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "test: verify propai-compatible auth flow"
```

---

## Self-Review

### Spec Coverage

- dedicated login/register routes: Tasks 3 and 4
- protected routes including settings: Tasks 1 and 4
- redirect-after-login flow: Tasks 1, 3, and 4
- shared auth/session/profile layer: Task 2
- `user_profiles` reuse: Task 2
- settings conversion to authenticated account page: Task 5
- `401` fallback alignment: Task 4

No spec gaps remain.

### Placeholder Scan

- No `TODO` / `TBD`
- Each task includes concrete files, commands, and code samples
- Verification commands are explicit

### Type Consistency

- `AuthProfile`, `getDefaultAuthState`, and `normalizeAuthProfile` are introduced in Task 2 and reused consistently afterward
- `buildLoginRedirectTarget` and `getPostAuthDestination` are introduced in Task 1 and reused consistently afterward

