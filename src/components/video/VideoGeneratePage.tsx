import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Video, RotateCcw, Download, History, Plus, Sparkles, Upload } from 'lucide-react'
import { useVideoGenerateStore } from '@/store/useVideoGenerateStore'
import { useApiConfigStore } from '@/store/useApiConfigStore'
import { useTranslations } from '@/i18n/compat/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { DragDropZone } from '@/components/shared/DragDropZone'
import { toast } from 'sonner'

const DURATIONS = [
  { value: '5', label: '5s' },
  { value: '10', label: '10s' },
]

const RESOLUTIONS = [
  { value: '480p', label: '480p' },
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
]

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
]

export function VideoGeneratePage() {
  const {
    prompt, mode, imagePreview, duration, resolution, aspectRatio,
    generating, progress, result, history,
    setPrompt, setMode, setImageFile, setDuration, setResolution, setAspectRatio,
    generate, fetchHistory,
  } = useVideoGenerateStore()
  const t = useTranslations('video')
  const tc = useTranslations('common')
  const ts = useTranslations('settings')
  const { isVideoConfigured } = useApiConfigStore()

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const handleGenerate = async () => {
    if (!isVideoConfigured()) { toast.error(ts('videoApiNotConfigured')); return }
    if (!prompt.trim()) { toast.error(t('enterPrompt')); return }
    if (mode === 'i2v' && !imagePreview) { toast.error(t('uploadImage')); return }
    await generate()
    toast.success(t('submitted'))
  }

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div className="w-[380px] border-r border-border/50 flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">
            {/* Mode toggle */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('modeLabel')}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode('t2v')}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${mode === 't2v' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                >
                  {t('textToVideo')}
                </button>
                <button
                  onClick={() => setMode('i2v')}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${mode === 'i2v' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                >
                  {t('imageToVideo')}
                </button>
              </div>
            </div>

            {/* Image upload (I2V only) */}
            {mode === 'i2v' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('inputImage')}</Label>
                {imagePreview ? (
                  <div className="relative rounded-lg overflow-hidden border border-border">
                    <img src={imagePreview} alt="Input" className="w-full h-32 object-cover" />
                    <Button variant="destructive" size="icon-sm" className="absolute top-2 right-2" onClick={() => setImageFile(null)}>
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <DragDropZone onDrop={(files) => setImageFile(files[0])} accept="image/*" multiple={false} className="h-24">
                    <div className="flex flex-col items-center justify-center h-full py-4">
                      <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">{t('uploadImageHint')}</p>
                    </div>
                  </DragDropZone>
                )}
              </div>
            )}

            {/* Prompt */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {t('promptLabel')}
              </Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t('promptPlaceholder')}
                className="min-h-[120px] resize-none bg-muted/30"
              />
            </div>

            <Separator />

            {/* Duration */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('durationLabel')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDuration(d.value)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${duration === d.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('resolutionLabel')}</Label>
              <div className="grid grid-cols-3 gap-2">
                {RESOLUTIONS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setResolution(r.value)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${resolution === r.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('aspectRatioLabel')}</Label>
              <div className="grid grid-cols-3 gap-2">
                {ASPECT_RATIOS.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => setAspectRatio(a.value)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${aspectRatio === a.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="p-5 border-t border-border/50">
          <Button variant="gradient" size="lg" className="w-full" onClick={handleGenerate} disabled={generating || !prompt.trim()}>
            {generating ? (
              <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><Video className="h-4 w-4 mr-2" /></motion.div>{t('generating')}</>
            ) : (
              <><Video className="h-4 w-4 mr-2" />{t('generateButton')}</>
            )}
          </Button>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col">
        <Tabs defaultValue="result" className="flex-1 flex flex-col">
          <div className="border-b border-border/50 px-4">
            <TabsList className="mt-2">
              <TabsTrigger value="result">{t('resultTitle')}</TabsTrigger>
              <TabsTrigger value="history">
                {t('historyTitle')}
                {history.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1.5">{history.length}</Badge>}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="result" className="flex-1 flex items-center justify-center p-6">
            {generating ? (
              <div className="flex flex-col items-center gap-4 max-w-sm w-full">
                <motion.div className="relative w-32 h-32 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center" animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                  <Video className="h-10 w-10 text-primary" />
                  <div className="absolute inset-0 rounded-2xl ai-glow opacity-50" />
                </motion.div>
                <div className="text-center">
                  <p className="text-sm font-medium">{t('generatingDesc')}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('generatingWait')}</p>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <motion.div className="bg-primary h-2 rounded-full" animate={{ width: `${progress}%` }} />
                </div>
              </div>
            ) : result ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative max-w-full max-h-full">
                <video src={result} controls className="max-h-[calc(100vh-280px)] rounded-xl shadow-2xl" />
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <Button size="sm" variant="secondary" className="backdrop-blur-sm" onClick={() => { const a = document.createElement('a'); a.href = result; a.download = 'generated-video.mp4'; a.click() }}>
                    <Download className="h-4 w-4 mr-1" /> {tc('download')}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
                  <Video className="h-10 w-10 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">{t('resultPlaceholder')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('resultPlaceholderDesc')}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full p-4">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <History className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium">{t('noHistory')}</p>
                  <p className="text-xs text-muted-foreground">{t('noHistoryDesc')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {history.map((item) => {
                    const params = JSON.parse(String(item.parameters || '{}'))
                    return (
                      <Card key={item.id} className="overflow-hidden cursor-pointer hover:border-primary/50 transition-colors">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={item.status === 'done' ? 'default' : item.status === 'error' ? 'destructive' : 'secondary'}>{item.status}</Badge>
                            <span className="text-[10px] text-muted-foreground">{params.type?.toUpperCase() || 'T2V'}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{item.prompt}</p>
                          <div className="flex gap-2 text-[10px] text-muted-foreground">
                            <span>{params.duration}s</span>
                            <span>{params.resolution}</span>
                            <span>{params.aspectRatio}</span>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
