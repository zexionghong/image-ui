import { useMemo, useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { AlertCircle, LogIn } from 'lucide-react'
import { AuthCard } from './AuthCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { getPostAuthDestination } from '@/lib/authRouting'
import { useLocale } from '@/i18n/compat/client'
import { useAuthStore } from '@/store/useAuthStore'

export function LoginPage() {
  const locale = useLocale()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  const bootstrap = useAuthStore((s) => s.bootstrap)
  const redirect = useMemo(() => new URL(href, window.location.origin).searchParams.get('redirect'), [href])
  const registerTo = `/${locale}/register${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (!supabase) {
      setError('Supabase is not configured.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    await bootstrap()
    await navigate({ to: getPostAuthDestination(locale, redirect) })
  }

  return (
    <AuthCard title="Welcome back" description="Sign in to your Image2 account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 6 characters"
          />
        </div>
        {error && (
          <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <Button type="submit" className="w-full" disabled={loading}>
          <LogIn className="mr-2 h-4 w-4" />
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {"Don't have an account? "}
        <Link to={registerTo} className="font-medium text-primary hover:underline">
          Create one free
        </Link>
      </p>
    </AuthCard>
  )
}
