import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, RotateCcw, Download, History, Plus, Settings2, Paintbrush } from 'lucide-react'
import { useGenerateStore } from '@/store/useGenerateStore'
import { useApiConfigStore } from '@/store/useApiConfigStore'
import { useTranslations } from '@/i18n/compat/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { ProgressBar } from './ProgressBar'
import { MaskPaintDialog } from './MaskPaintDialog'
import { DragDropZone } from '@/components/shared/DragDropZone'
import { toast } from 'sonner'

const SIZES = [
  { value: 'auto', labelKey: 'sizeAuto', descKey: 'sizeAutoDesc', w: 20, h: 20 },
  { value: '1024x1024', label: '1:1', desc: '1024', w: 20, h: 20 },
  { value: '1536x1024', label: '3:2', desc: '1536', w: 24, h: 16 },
  { value: '1024x1536', label: '2:3', desc: '1024', w: 16, h: 24 },
  { value: '2048x2048', label: '1:1', desc: '2048', w: 22, h: 22 },
  { value: '2048x1152', label: '16:9', desc: '2048', w: 24, h: 13 },
  { value: '3840x2160', label: '16:9', desc: '4K', w: 24, h: 13 },
  { value: '2160x3840', label: '9:16', desc: '4K', w: 13, h: 24 },
]

const QUALITIES = [
  { value: 'auto', labelKey: 'qualityAuto' },
  { value: 'low', labelKey: 'qualityLow' },
  { value: 'medium', labelKey: 'qualityMedium' },
  { value: 'high', labelKey: 'qualityHigh' },
]

const BACKGROUNDS = [
  { value: 'auto', labelKey: 'bgAuto' },
  { value: 'opaque', labelKey: 'bgOpaque' },
]

const OUTPUT_FORMATS = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
]

export function GeneratePage() {
  const {
    prompt, negativePrompt, size, quality, background, outputFormat, outputCompression, n,
    referencePreviews, maskDataUrl, inputFidelity, generating, progress, result, history,
    setPrompt, setNegativePrompt, setSize, setQuality, setBackground, setOutputFormat, setOutputCompression, setN,
    addReferenceImages, removeReferenceImage, setMaskDataUrl, setInputFidelity, generate, fetchHistory,
  } = useGenerateStore()
  const t = useTranslations('generate')
  const tc = useTranslations('common')
  const ts = useTranslations('settings')
  const { isConfigured } = useApiConfigStore()
  const [maskDialogOpen, setMaskDialogOpen] = useState(false)

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const handleGenerate = async () => {
    if (!isConfigured()) { toast.error(ts('apiNotConfigured')); return }
    if (!prompt.trim()) { toast.error(t('enterPrompt')); return }
    await generate(referencePreviews.length > 0 ? 'img2img' : 'text2img')
    toast.success(t('success'))
  }

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <div className="w-[380px] border-r border-border/50 flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">
            {/* Prompt */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {t('promptLabel')}
              </Label>
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t('promptPlaceholder')} className="min-h-[120px] resize-none bg-muted/30" />
            </div>

            {/* Negative prompt */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">{t('negativeLabel')}</Label>
              <Textarea value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder={t('negativePlaceholder')} className="min-h-[60px] resize-none bg-muted/30" />
            </div>

            {/* Size */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('sizeLabel')}</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {SIZES.map((s) => (
                  <button key={s.value} onClick={() => setSize(s.value)}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-[10px] transition-all ${size === s.value ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-border hover:border-muted-foreground/30 text-muted-foreground'}`}>
                    <div
                      className={`rounded-sm border-[1.5px] ${size === s.value ? 'border-primary bg-primary/20' : 'border-muted-foreground/30 bg-muted/50'}`}
                      style={{ width: s.w, height: s.h }}
                    />
                    <span className="text-xs font-semibold">{s.labelKey ? t(s.labelKey) : s.label}</span>
                    <span className="text-[9px] opacity-60">{s.descKey ? t(s.descKey) : `${s.desc}px`}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quality */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('qualityLabel')}</Label>
              <div className="grid grid-cols-4 gap-2">
                {QUALITIES.map((q) => (
                  <button key={q.value} onClick={() => setQuality(q.value)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${quality === q.value ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-border hover:border-muted-foreground/30 text-muted-foreground'}`}>
                    {t(q.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Advanced */}
            <div className="space-y-4">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Settings2 className="h-3 w-3" />{t('advancedLabel')}
              </Label>

              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">{t('backgroundLabel')}</Label>
                <Select value={background} onValueChange={setBackground}>
                  <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BACKGROUNDS.map((b) => (<SelectItem key={b.value} value={b.value}>{t(b.labelKey)}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">{t('formatLabel')}</Label>
                <Select value={outputFormat} onValueChange={setOutputFormat}>
                  <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OUTPUT_FORMATS.map((f) => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              {(outputFormat === 'jpeg' || outputFormat === 'webp') && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">{t('compressionLabel')}</Label>
                    <span className="text-xs text-muted-foreground">{outputCompression}%</span>
                  </div>
                  <Slider min={0} max={100} step={1} value={[outputCompression]} onValueChange={([v]) => setOutputCompression(v)} />
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">{t('countLabel')}</Label>
                <Select value={String(n)} onValueChange={(v) => setN(Number(v))}>
                  <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6,7,8,9,10].map((v) => (<SelectItem key={v} value={String(v)}>{v}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              {referencePreviews.length > 0 && (
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">{t('highFidelityLabel')}</Label>
                  <Switch
                    checked={inputFidelity === 'high'}
                    onCheckedChange={(checked) => setInputFidelity(checked ? 'high' : 'low')}
                  />
                </div>
              )}
            </div>

            {/* Reference images */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('referenceLabel')}</Label>
              {referencePreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {referencePreviews.map((src, i) => (
                    <div key={i} className="relative rounded-lg overflow-hidden border border-border aspect-square">
                      <img src={src} alt={`Reference ${i + 1}`} className="w-full h-full object-cover" />
                      <Button variant="destructive" size="icon-sm" className="absolute top-1 right-1 h-5 w-5" onClick={() => removeReferenceImage(i)}>
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                      {i === 0 && (
                        <Button
                          variant="secondary"
                          size="icon-sm"
                          className={`absolute top-1 left-1 h-5 w-5 ${maskDataUrl ? 'ring-2 ring-primary' : ''}`}
                          onClick={() => setMaskDialogOpen(true)}
                          title={t('paintMask')}
                        >
                          <Paintbrush className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <DragDropZone onDrop={(files) => addReferenceImages(files)} accept="image/*" multiple={true} className="h-24">
                <div className="flex flex-col items-center justify-center h-full py-4">
                  <Plus className="h-5 w-5 text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">{referencePreviews.length > 0 ? t('addMoreReference') : t('addReference')}</p>
                </div>
              </DragDropZone>

              {referencePreviews.length > 0 && (
                <MaskPaintDialog
                  open={maskDialogOpen}
                  onOpenChange={setMaskDialogOpen}
                  imageSrc={referencePreviews[0]}
                  onSave={(dataUrl) => { setMaskDataUrl(dataUrl); setMaskDialogOpen(false) }}
                />
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="p-5 border-t border-border/50">
          <Button variant="gradient" size="lg" className="w-full" onClick={handleGenerate} disabled={generating || !prompt.trim()}>
            {generating ? (
              <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><Sparkles className="h-4 w-4 mr-2" /></motion.div>{t('generating')}</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" />{t('generateButton')}</>
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
                  <Sparkles className="h-10 w-10 text-primary" />
                  <div className="absolute inset-0 rounded-2xl ai-glow opacity-50" />
                </motion.div>
                <div className="text-center">
                  <p className="text-sm font-medium">{t('generatingDesc')}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('generatingWait')}</p>
                </div>
                <ProgressBar value={progress} className="w-full" />
              </div>
            ) : result ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative max-w-full max-h-full">
                <img src={result} alt="Generated" className="max-h-[calc(100vh-280px)] rounded-xl shadow-2xl" />
                <div className="absolute bottom-4 right-4 flex gap-2">
                  <Button size="sm" variant="secondary" className="backdrop-blur-sm" onClick={() => toast.success(t('savedToGallery'))}>
                    <Plus className="h-4 w-4 mr-1" /> {t('saveToGallery')}
                  </Button>
                  <Button size="sm" variant="secondary" className="backdrop-blur-sm" onClick={() => { const a = document.createElement('a'); a.href = result; a.download = 'generated-image.png'; a.click() }}>
                    <Download className="h-4 w-4 mr-1" /> {t('download')}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
                  <Sparkles className="h-10 w-10 text-muted-foreground" />
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
                <div className="grid grid-cols-3 gap-3">
                  {history.map((item) => (
                    <Card key={item.id} className="overflow-hidden cursor-pointer hover:border-primary/50 transition-colors">
                      <div className="aspect-square bg-muted flex items-center justify-center">
                        {item.status === 'done' && item.result_image_id && (item as any).result_image?.url ? (
                          <img src={(item as any).result_image.url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Badge variant={item.status === 'error' ? 'destructive' : 'secondary'}>{item.status}</Badge>
                        )}
                      </div>
                      <CardContent className="p-2">
                        <p className="text-[10px] text-muted-foreground truncate">{item.prompt}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
