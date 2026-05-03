import { useRouterState } from '@tanstack/react-router'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { LanguageSwitch } from '@/components/shared/LanguageSwitch'
import { useTranslations, useLocale } from '@/i18n/compat/client'

export function Header() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const t = useTranslations('header')
  const locale = useLocale()

  const pageTitle = (() => {
    if (pathname.includes('/gallery')) return t('gallery')
    if (pathname.includes('/generate')) return t('generate')
    if (pathname.includes('/settings')) return t('settings')
    if (pathname.includes('/editor')) return t('editor')
    return 'Image2'
  })()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm">
      <h1 className="text-lg font-semibold">{pageTitle}</h1>
      <div className="flex items-center gap-2">
        <LanguageSwitch />
        <ThemeToggle />
      </div>
    </header>
  )
}
