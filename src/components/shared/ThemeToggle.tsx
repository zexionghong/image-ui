import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useThemeStore } from '@/store/useThemeStore'

export function ThemeToggle() {
  const { theme, toggle } = useThemeStore()

  return (
    <Button variant="ghost" size="icon" onClick={toggle} className="h-8 w-8">
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
