import { useMemo, useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { AlertCircle, CheckCircle2, UserPlus } from 'lucide-react'
import { AuthCard } from './AuthCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { getPostAuthDestination } from '@/lib/authRouting'
import { useLocale } from '@/i18n/compat/client'
import { useAuthStore } from '@/store/useAuthStore'

export function RegisterPage() {
  const locale = useLocale()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  const bootstrap = useAuthStore((s) => s.bootstrap)
  const redirect = useMemo(() => new URL(href, window.location.origin).searchParams.get('redirect'), [href])
  const loginTo = `/${locale}/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (!supabase) {
      setError('Supabase is not configured.')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (data.session) {
      await bootstrap()
      await navigate({ to: getPostAuthDestination(locale, redirect) })
      return
    }

    setLoading(false)
    setDone(true)
  }

  if (done) {
    return (
      <AuthCard title="Check your email" description={email}>
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link. After confirming, you can sign in.
          </p>
          <Button asChild className="w-full">
            <Link to={loginTo}>Sign in</Link>
          </Button>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Get started" description="Create your Image2 account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="register-email">Email</Label>
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="register-password">Password</Label>
          <Input
            id="register-password"
            type="password"
            autoComplete="new-password"
            minLength={6}
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
          <UserPlus className="mr-2 h-4 w-4" />
          {loading ? 'Creating account...' : 'Create account'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to={loginTo} className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  )
}
