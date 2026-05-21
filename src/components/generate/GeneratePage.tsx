import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, RotateCcw, Download, History, Plus, Settings2, Paintbrush, RefreshCcw, Link2, Clock3, XCircle, Trash2 } from 'lucide-react'
import { useGenerateStore } from '@/store/useGenerateStore'
import { useApiConfigStore } from '@/store/useApiConfigStore'
import { useTranslations } from '@/i18n/compat/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
    referencePreviews, maskDataUrl, inputFidelity, generating, progress, result, resultImageId, generationHistoryId, history,
    setPrompt, setNegativePrompt, setSize, setQuality, setBackground, setOutputFormat, setOutputCompression, setN,
    addReferenceImages, removeReferenceImage, setMaskDataUrl, setInputFidelity, generate, fetchHistory, deleteHistoryItem,
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
    try {
      await generate(referencePreviews.length > 0 ? 'img2img' : 'text2img')
      toast.success(t('success'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    }
  }

  const refreshHistory = async () => {
    await fetchHistory()
    toast.success('已刷新')
  }

  const openImage = (url?: string | null) => {
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const deleteHistory = async (id: string) => {
    try {
      await deleteHistoryItem(id)
      toast.success('已删除')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  return (
    <div className="flex h-full min-h-0 bg-background">
      {/* Left panel */}
      <div className="flex w-[380px] min-h-0 flex-col border-r border-border/50">
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
      <div className="grid min-h-0 flex-1 gap-4 p-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <section className="flex min-h-0 flex-col rounded-lg border border-border/60 bg-card/30 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">{t('resultTitle')}</h2>
              <p className="text-xs text-muted-foreground">{t('resultPlaceholderDesc')}</p>
            </div>
            <div className="flex items-center gap-2">
              {generationHistoryId ? <Badge variant="outline" className="max-w-[150px] truncate font-mono text-[10px]">{generationHistoryId}</Badge> : null}
              {resultImageId ? <Badge variant="secondary" className="max-w-[120px] truncate font-mono text-[10px]">{resultImageId}</Badge> : null}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-border/60 bg-background/60 p-4">
            {generating ? (
              <div className="flex w-full max-w-sm flex-col items-center gap-4">
                <motion.div className="relative flex h-28 w-28 items-center justify-center rounded-lg border border-primary/20 bg-primary/5" animate={{ scale: [1, 1.04, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                  <Sparkles className="h-9 w-9 text-primary" />
                </motion.div>
                <div className="text-center">
                  <p className="text-sm font-medium">{t('generatingDesc')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t('generatingWait')}</p>
                </div>
                <ProgressBar value={progress} className="w-full" />
              </div>
            ) : result ? (
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full space-y-4">
                <div className="flex justify-center overflow-hidden rounded-lg border border-border/60 bg-black/90 p-2">
                  <img src={result} alt="Generated" className="max-h-[min(62vh,720px)] max-w-full rounded object-contain" />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => openImage(result)}>
                    <Link2 className="mr-1.5 h-3.5 w-3.5" />打开
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { const a = document.createElement('a'); a.href = result; a.download = 'generated-image.png'; a.click() }}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />{t('download')}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <div className="flex max-w-sm flex-col items-center text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-lg border border-border/60 bg-muted/40">
                  <Sparkles className="h-9 w-9 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">{t('resultPlaceholder')}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t('resultPlaceholderDesc')}</p>
              </div>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col rounded-lg border border-border/60 bg-card/30 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">{t('historyTitle')}</h2>
              <p className="text-xs text-muted-foreground">{t('noHistoryDesc')}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="rounded-md">{history.length}</Badge>
              <Button variant="outline" size="icon-sm" onClick={() => void refreshHistory()} title="刷新结果">
                <RefreshCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {history.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <History className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">{t('noHistory')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('noHistoryDesc')}</p>
            </div>
          ) : (
            <ScrollArea className="flex-1 pr-2">
              <div className="space-y-3">
                {history.map((item) => {
                  const imageUrl = (item as any).result_image?.url as string | undefined
                  const createdAt = item.created_at ? new Date(String(item.created_at)).toLocaleString() : ''
                  const errorMessage = typeof item.parameters === 'object' && item.parameters && 'error' in item.parameters
                    ? String((item.parameters as Record<string, unknown>).error || '')
                    : ''

                  return (
                    <div key={item.id} className="rounded-lg border border-border/60 bg-background/60 p-3 transition-colors hover:border-primary/40 hover:bg-background">
                      <div className="flex gap-3">
                        <button
                          type="button"
                          className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/40"
                          onClick={() => openImage(imageUrl)}
                          disabled={!imageUrl}
                        >
                          {imageUrl ? (
                            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                          ) : item.status === 'error' ? (
                            <XCircle className="h-6 w-6 text-destructive" />
                          ) : (
                            <Sparkles className="h-6 w-6 text-muted-foreground" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant={item.status === 'done' ? 'default' : item.status === 'error' ? 'destructive' : 'secondary'}>{item.status}</Badge>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon-sm" onClick={() => void refreshHistory()} title="刷新结果">
                                <RefreshCcw className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon-sm" onClick={() => void deleteHistory(item.id)} title="删除资源">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <p className="line-clamp-2 text-xs text-foreground">{item.prompt}</p>
                          {errorMessage ? <p className="line-clamp-2 text-[11px] text-destructive">{errorMessage}</p> : null}
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock3 className="h-3 w-3" />
                            <span className="truncate">{createdAt}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </section>
      </div>
    </div>
  )
}
