import { useEffect } from 'react'
import { RouterProvider, createRouter, createRootRoute, createRoute, redirect, Outlet } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppLayout } from '@/components/layout/AppLayout'
import { GalleryPage } from '@/components/gallery/GalleryPage'
import { EditorPage } from '@/components/editor/EditorPage'
import { GeneratePage } from '@/components/generate/GeneratePage'
import { SettingsPage } from '@/components/shared/SettingsPage'
import { I18nProvider } from '@/i18n/compat/client'
import { locales, defaultLocale, type Locale } from '@/i18n/config'
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

  // Apply theme class to <html> on mount and when it changes
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

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

// Gallery
const galleryRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: '/gallery',
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
  component: () => (
    <AppLayout>
      <GeneratePage />
    </AppLayout>
  ),
})

// Settings
const settingsRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: '/settings',
  component: () => (
    <AppLayout>
      <SettingsPage />
    </AppLayout>
  ),
})

// Build route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  localeRoute.addChildren([galleryRoute, editorRoute, generateRoute, settingsRoute]),
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
