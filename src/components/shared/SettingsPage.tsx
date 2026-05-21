import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { LogOut, Save, Eye, EyeOff, UserCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useTranslations, useLocale } from '@/i18n/compat/client'
import { useApiConfigStore } from '@/store/useApiConfigStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useThemeStore } from '@/store/useThemeStore'

export function SettingsPage() {
  const t = useTranslations('settings')
  const locale = useLocale()
  const navigate = useNavigate()
  const { baseUrl, apiKey, model, videoBaseUrl, videoApiKey, videoModel, setBaseUrl, setApiKey, setModel, setVideoBaseUrl, setVideoApiKey, setVideoModel } = useApiConfigStore()
  const { theme, toggle } = useThemeStore()
  const { user, profile, signOut } = useAuthStore()
  const [showKey, setShowKey] = useState(false)
  const [showVideoKey, setShowVideoKey] = useState(false)
  const [localUrl, setLocalUrl] = useState(baseUrl)
  const [localKey, setLocalKey] = useState(apiKey)
  const [localModel, setLocalModel] = useState(model)
  const [localVideoUrl, setLocalVideoUrl] = useState(videoBaseUrl)
  const [localVideoKey, setLocalVideoKey] = useState(videoApiKey)
  const [localVideoModel, setLocalVideoModel] = useState(videoModel)

  const handleSave = () => {
    setBaseUrl(localUrl)
    setApiKey(localKey)
    setModel(localModel)
    toast.success(t('apiSaved'))
  }

  const handleVideoSave = () => {
    setVideoBaseUrl(localVideoUrl)
    setVideoApiKey(localVideoKey)
    setVideoModel(localVideoModel)
    toast.success(t('apiSaved'))
  }

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out')
    await navigate({ to: `/${locale}/login` })
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t('title')}</h2>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Signed in with the shared PropAI Supabase account system.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <UserCircle className="h-9 w-9 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <Label>Current user</Label>
              <p className="truncate text-sm text-muted-foreground">{user?.email ?? 'Unknown user'}</p>
              {profile?.currentPlan && (
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Plan: {profile.currentPlan}</p>
              )}
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-1.5" />
            Sign out
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('apiSection')}</CardTitle>
          <CardDescription>{t('apiDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('baseUrl')}</Label>
            <p className="text-xs text-muted-foreground">{t('baseUrlDesc')}</p>
            <Input
              value={localUrl}
              onChange={(event) => setLocalUrl(event.target.value)}
              placeholder={t('baseUrlPlaceholder')}
              className="font-mono text-sm"
            />
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>{t('apiKey')}</Label>
            <p className="text-xs text-muted-foreground">{t('apiKeyDesc')}</p>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                value={localKey}
                onChange={(event) => setLocalKey(event.target.value)}
                placeholder={t('apiKeyPlaceholder')}
                className="font-mono text-sm pr-10"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>{t('model')}</Label>
            <p className="text-xs text-muted-foreground">{t('modelDesc')}</p>
            <Input
              value={localModel}
              onChange={(event) => setLocalModel(event.target.value)}
              placeholder={t('modelPlaceholder')}
              className="font-mono text-sm"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="gradient" onClick={handleSave}>
              <Save className="h-4 w-4 mr-1.5" />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('videoApiSection')}</CardTitle>
          <CardDescription>{t('videoApiDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('videoBaseUrl')}</Label>
            <p className="text-xs text-muted-foreground">{t('videoBaseUrlDesc')}</p>
            <Input
              value={localVideoUrl}
              onChange={(event) => setLocalVideoUrl(event.target.value)}
              placeholder={t('videoBaseUrlPlaceholder')}
              className="font-mono text-sm"
            />
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>{t('videoApiKey')}</Label>
            <p className="text-xs text-muted-foreground">{t('videoApiKeyDesc')}</p>
            <div className="relative">
              <Input
                type={showVideoKey ? 'text' : 'password'}
                value={localVideoKey}
                onChange={(event) => setLocalVideoKey(event.target.value)}
                placeholder={t('videoApiKeyPlaceholder')}
                className="font-mono text-sm pr-10"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                onClick={() => setShowVideoKey(!showVideoKey)}
              >
                {showVideoKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>{t('videoModel')}</Label>
            <p className="text-xs text-muted-foreground">{t('videoModelDesc')}</p>
            <Input
              value={localVideoModel}
              onChange={(event) => setLocalVideoModel(event.target.value)}
              placeholder={t('videoModelPlaceholder')}
              className="font-mono text-sm"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="gradient" onClick={handleVideoSave}>
              <Save className="h-4 w-4 mr-1.5" />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('appearance')}</CardTitle>
          <CardDescription>{t('appearanceDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('darkMode')}</Label>
              <p className="text-sm text-muted-foreground">{t('darkModeDesc')}</p>
            </div>
            <Switch checked={theme === 'dark'} onCheckedChange={toggle} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
