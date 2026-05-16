import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useTranslations } from '@/i18n/compat/client'
import { useApiConfigStore } from '@/store/useApiConfigStore'
import { useThemeStore } from '@/store/useThemeStore'
import { Save, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

export function SettingsPage() {
  const t = useTranslations('settings')
  const { baseUrl, apiKey, model, videoBaseUrl, videoApiKey, videoModel, setBaseUrl, setApiKey, setModel, setVideoBaseUrl, setVideoApiKey, setVideoModel } = useApiConfigStore()
  const { theme, toggle } = useThemeStore()
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

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t('title')}</h2>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* API Config */}
      <Card>
        <CardHeader>
          <CardTitle>{t('apiSection')}</CardTitle>
          <CardDescription>{t('apiDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Base URL */}
          <div className="space-y-1.5">
            <Label>{t('baseUrl')}</Label>
            <p className="text-xs text-muted-foreground">{t('baseUrlDesc')}</p>
            <Input
              value={localUrl}
              onChange={(e) => setLocalUrl(e.target.value)}
              placeholder={t('baseUrlPlaceholder')}
              className="font-mono text-sm"
            />
          </div>

          <Separator />

          {/* API Key */}
          <div className="space-y-1.5">
            <Label>{t('apiKey')}</Label>
            <p className="text-xs text-muted-foreground">{t('apiKeyDesc')}</p>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                value={localKey}
                onChange={(e) => setLocalKey(e.target.value)}
                placeholder={t('apiKeyPlaceholder')}
                className="font-mono text-sm pr-10"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Model */}
          <div className="space-y-1.5">
            <Label>{t('model')}</Label>
            <p className="text-xs text-muted-foreground">{t('modelDesc')}</p>
            <Input
              value={localModel}
              onChange={(e) => setLocalModel(e.target.value)}
              placeholder={t('modelPlaceholder')}
              className="font-mono text-sm"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="gradient" onClick={handleSave}>
              <Save className="h-4 w-4 mr-1.5" />
              {t('apiSaved').replace('已保存', '保存').replace('saved', 'Save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Video API Config */}
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
              onChange={(e) => setLocalVideoUrl(e.target.value)}
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
                onChange={(e) => setLocalVideoKey(e.target.value)}
                placeholder={t('videoApiKeyPlaceholder')}
                className="font-mono text-sm pr-10"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
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
              onChange={(e) => setLocalVideoModel(e.target.value)}
              placeholder={t('videoModelPlaceholder')}
              className="font-mono text-sm"
            />
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={() => setLocalVideoModel('doubao-seedance-2-0-260128')}>
                Seedance 2
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLocalVideoModel('doubao-seedance-2-0-fast-260128')}
              >
                Seedance 2 Fast
              </Button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="gradient" onClick={handleVideoSave}>
              <Save className="h-4 w-4 mr-1.5" />
              {t('apiSaved').replace('已保存', '保存').replace('saved', 'Save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
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
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('checkerboard')}</Label>
              <p className="text-sm text-muted-foreground">{t('checkerboardDesc')}</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Editor */}
      <Card>
        <CardHeader>
          <CardTitle>{t('editorSection')}</CardTitle>
          <CardDescription>{t('editorDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('autoSave')}</Label>
              <p className="text-sm text-muted-foreground">{t('autoSaveDesc')}</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('showGrid')}</Label>
              <p className="text-sm text-muted-foreground">{t('showGridDesc')}</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      {/* Export */}
      <Card>
        <CardHeader>
          <CardTitle>{t('exportSection')}</CardTitle>
          <CardDescription>{t('exportDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('preserveMetadata')}</Label>
              <p className="text-sm text-muted-foreground">{t('preserveMetadataDesc')}</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
