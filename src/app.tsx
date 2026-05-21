import { useEffect } from 'react'
import { RouterProvider, createRouter, createRootRoute, createRoute, redirect, Outlet } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/components/auth/LoginPage'
import { RegisterPage } from '@/components/auth/RegisterPage'
import { GalleryPage } from '@/components/gallery/GalleryPage'
import { EditorPage } from '@/components/editor/EditorPage'
import { GeneratePage } from '@/components/generate/GeneratePage'
import { VideoGeneratePage } from '@/components/video/VideoGeneratePage'
import { WorkflowPage } from '@/components/workflow/WorkflowPage'
import { ResourceLibraryPage } from '@/components/resources/ResourceLibraryPage'
import { SettingsPage } from '@/components/shared/SettingsPage'
import { I18nProvider } from '@/i18n/compat/client'
import { locales, defaultLocale, type Locale } from '@/i18n/config'
import { buildAuthRedirectPath } from '@/lib/authRouting'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import { useThemeStore } from '@/store/useThemeStore'
import zhMessages from '@/i18n/locales/zh.json'
import enMessages from '@/i18n/locales/en.json'

const messagesMap: Record<Locale, Record<string, unknown>> = {
  zh: zhMessages,
  en: enMessages,
}

// Root layout
function RootLayout() {
  const theme = useThemeStore((s) => s.theme)
  const bootstrap = useAuthStore((s) => s.bootstrap)

  // Apply theme class to <html> on mount and when it changes
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background text-foreground">
        <Outlet />
      </div>
    </TooltipProvider>
  )
}

// Locale layout - loads i18n messages and wraps children
function LocaleLayout() {
  const { locale } = localeRoute.useParams()
  const validLocale = locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale
  const messages = messagesMap[validLocale]

  return (
    <I18nProvider locale={validLocale} messages={messages}>
      <Outlet />
    </I18nProvider>
  )
}

// Root route
const rootRoute = createRootRoute({ component: RootLayout })

// Index - redirect to default locale gallery
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/$locale/gallery', params: { locale: defaultLocale } })
  },
  component: () => null,
})

// Locale parent route
const localeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$locale',
  component: LocaleLayout,
})

async function requireAuthBeforeLoad(location: { pathname: string; searchStr?: string; hash?: string }) {
  if (supabase) {
    const { data } = await supabase.auth.getSession()
    if (data.session?.access_token) return
  }

  throw redirect({ href: buildAuthRedirectPath(location.pathname, location.searchStr ?? '', location.hash ?? '') })
}

const loginRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: '/login',
  component: LoginPage,
})

const registerRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: '/register',
  component: RegisterPage,
})

// Gallery
const galleryRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: '/gallery',
  beforeLoad: ({ location }) => requireAuthBeforeLoad(location),
  component: () => (
    <AppLayout>
      <GalleryPage />
    </AppLayout>
  ),
})

// Editor
const editorRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: '/editor/$id',
  beforeLoad: ({ location }) => requireAuthBeforeLoad(location),
  component: () => {
    const { id } = editorRoute.useParams()
    return (
      <AppLayout>
        <EditorPage imageId={id} />
      </AppLayout>
    )
  },
})

// Generate
const generateRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: '/generate',
  beforeLoad: ({ location }) => requireAuthBeforeLoad(location),
  component: () => (
    <AppLayout>
      <GeneratePage />
    </AppLayout>
  ),
})

// Resource Library
const resourcesRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: '/resources',
  beforeLoad: ({ location }) => requireAuthBeforeLoad(location),
  component: () => (
    <AppLayout>
      <ResourceLibraryPage />
    </AppLayout>
  ),
})

// Settings
const settingsRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: '/settings',
  beforeLoad: ({ location }) => requireAuthBeforeLoad(location),
  component: () => (
    <AppLayout>
      <SettingsPage />
    </AppLayout>
  ),
})

// Video Generate
const videoGenerateRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: '/video-generate',
  beforeLoad: ({ location }) => requireAuthBeforeLoad(location),
  component: () => (
    <AppLayout>
      <VideoGeneratePage />
    </AppLayout>
  ),
})

// Workflow
const workflowRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: '/workflow',
  beforeLoad: ({ location }) => requireAuthBeforeLoad(location),
  component: () => (
    <AppLayout>
      <WorkflowPage />
    </AppLayout>
  ),
})

// Build route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  localeRoute.addChildren([
    loginRoute,
    registerRoute,
    galleryRoute,
    editorRoute,
    generateRoute,
    resourcesRoute,
    videoGenerateRoute,
    workflowRoute,
    settingsRoute,
  ]),
])

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster theme="dark" position="bottom-right" richColors closeButton />
    </>
  )
}
