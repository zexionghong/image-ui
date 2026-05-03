import { Languages, Check } from 'lucide-react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { locales, localeNames, type Locale } from '@/i18n/config'
import { useLocale } from '@/i18n/compat/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function LanguageSwitch() {
  const locale = useLocale()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const switchLocale = (newLocale: Locale) => {
    if (newLocale === locale) return
    // Replace locale segment in path: /zh/gallery -> /en/gallery
    const segments = pathname.split('/')
    segments[1] = newLocale
    const newPath = segments.join('/')
    navigate({ to: newPath })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => switchLocale(loc)}
            className="flex items-center justify-between gap-4"
          >
            {localeNames[loc]}
            {loc === locale && <Check className="h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
