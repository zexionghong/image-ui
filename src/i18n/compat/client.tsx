import { createContext, useContext, useCallback, type ReactNode } from 'react'
import type { Locale } from '../config'
import { createTranslator } from './utils'

interface I18nContextValue {
  locale: Locale
  messages: Record<string, unknown>
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale
  messages: Record<string, unknown>
  children: ReactNode
}) {
  return <I18nContext.Provider value={{ locale, messages }}>{children}</I18nContext.Provider>
}

export function useLocale(): Locale {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useLocale must be used within I18nProvider')
  return ctx.locale
}

export function useTranslations(namespace?: string) {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useTranslations must be used within I18nProvider')
  return useCallback(
    (key: string, values?: Record<string, string | number>) =>
      createTranslator(ctx.messages, namespace)(key, values),
    [ctx.messages, namespace]
  )
}
