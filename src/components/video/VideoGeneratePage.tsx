import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AudioLines,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  Frame,
  History,
  Image as ImageIcon,
  Link2,
  Loader2,
  RefreshCcw,
  Sparkles,
  Trash2,
  Upload,
  Video,
  Wand2,
  X,
} from 'lucide-react'
import { useVideoGenerateStore } from '@/store/useVideoGenerateStore'
import { useApiConfigStore } from '@/store/useApiConfigStore'
import { useTranslations } from '@/i18n/compat/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { DragDropZone } from '@/components/shared/DragDropZone'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { hasVideoModeInput, type VideoMode } from '@/lib/videoModeConfig'
import { toast } from 'sonner'

const MODES: Array<{ value: VideoMode; labelKey: string; icon: typeof Video }> = [
  { value: 't2v', labelKey: 'textToVideo', icon: Video },
  { value: 'i2v', labelKey: 'imageToVideo', icon: ImageIcon },
  { value: 'first_last', labelKey: 'firstLastFrame', icon: Frame },
  { value: 'multimodal', labelKey: 'multimodal', icon: Sparkles },
  { value: 'continue', labelKey: 'continueMode', icon: Wand2 },
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
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
]

const DURATION_OPTIONS = ['5', '10', '15'] as const

function parseParameters(value: unknown) {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function formatHistoryParam(value: unknown) {
  if (value === undefined || value === null || value === '') return '—'
  return String(value)
}

function isMode(value: unknown): value is VideoMode {
  return typeof value === 'string' && MODES.some((option) => option.value === value)
}

function getModeLabel(mode: VideoMode) {
  const item = MODES.find((option) => option.value === mode)
  return item ? item.labelKey : mode
}

function formatStatus(status: string | null) {
  if (!status) return 'idle'
  return status.toLowerCase()
}

function statusTone(status: string | null) {
  const normalized = formatStatus(status)
  if (normalized === 'succeeded' || normalized === 'done') return 'default'
  if (normalized === 'failed' || normalized === 'error') return 'destructive'
  return 'secondary'
}

function formatElapsed(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return '00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function FileBlock({
  label,
  hint,
  icon: Icon,
  selectedName,
  onPick,
  onClear,
  accept,
  multiple = false,
  image = false,
  preview,
  children,
}: {
  label: string
  hint: string
  icon: typeof Upload
  selectedName?: string
  onPick: (files: File[]) => void
  onClear: () => void
  accept: string
  multiple?: boolean
  image?: boolean
  preview?: string
  children?: React.ReactNode
}) {
  if (preview) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">{label}</Label>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClear}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="relative overflow-hidden rounded-lg border border-border bg-muted/20">
          {image ? (
            <img src={preview} alt={label} className="h-44 w-full object-cover" />
          ) : (
            <div className="flex h-44 items-center justify-center gap-3 p-4 text-center">
              <Icon className="h-6 w-6 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{selectedName}</p>
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <DragDropZone onDrop={onPick} accept={accept} multiple={multiple} className="rounded-lg">
        <div className="flex min-h-[140px] flex-col items-center justify-center gap-2 px-4 py-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium">{selectedName || label}</p>
          <p className="max-w-[240px] text-xs text-muted-foreground">{hint}</p>
          {children}
        </div>
      </DragDropZone>
    </div>
  )
}

export function VideoGeneratePage() {
  const {
    prompt,
    mode,
    imageFile,
    imagePreview,
    endFrameFile,
    endFramePreview,
    referenceImages,
    referenceImagePreviews,
    referenceVideo,
    referenceAudio,
    duration,
    resolution,
    aspectRatio,
    seed,
    watermark,
    generateAudio,
    callbackUrl,
    advancedJson,
    generating,
    progress,
    startedAt,
    taskId,
    status,
    error,
    errorDetails,
    remoteResult,
    result,
    history,
    setPrompt,
    setMode,
    setImageFile,
    setEndFrameFile,
    setReferenceImages,
    setReferenceVideo,
    setReferenceAudio,
    insertPromptReference,
    setDuration,
    setResolution,
    setAspectRatio,
    setSeed,
    setWatermark,
    setGenerateAudio,
    setCallbackUrl,
    setAdvancedJson,
    generate,
    fetchHistory,
    reset,
  } = useVideoGenerateStore()

  const t = useTranslations('video')
  const tc = useTranslations('common')
  const ts = useTranslations('settings')
  const { isVideoConfigured, videoModel, videoBaseUrl } = useApiConfigStore()
  const [now, setNow] = useState(() => Date.now())
  const promptRef = useRef<HTMLTextAreaElement | null>(null)
  const [mentionOpen, setMentionOpen] = useState(false)

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  useEffect(() => {
    if (!startedAt) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [startedAt])

  const handleGenerate = async () => {
    if (!isVideoConfigured()) {
      toast.error(ts('videoApiNotConfigured'))
      return
    }
    if (!prompt.trim()) {
      toast.error(t('enterPrompt'))
      return
    }
    if ((mode === 'i2v' || mode === 'first_last') && !imagePreview) {
      toast.error(t('uploadImage'))
      return
    }
    if (mode === 'first_last' && !endFramePreview) {
      toast.error(t('uploadEndFrame'))
      return
    }
    if (mode === 'continue' && !referenceVideo) {
      toast.error(t('uploadReferenceVideo'))
      return
    }
    if (advancedJson.trim()) {
      try {
        JSON.parse(advancedJson)
      } catch {
        toast.error(t('invalidAdvancedJson'))
        return
      }
    }

    await generate()
    const state = useVideoGenerateStore.getState()
    if (state.error && !state.taskId) {
      toast.error(state.error)
      return
    }
    if (state.taskId) toast.success(t('submitted'))
  }

  const copyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(successMessage)
    } catch {
      toast.error(tc('copyFailed'))
    }
  }

  const insertImageMention = (token: string) => {
    const input = promptRef.current
    if (!input) {
      insertPromptReference(token)
      setMentionOpen(false)
      return
    }

    const start = input.selectionStart
    const end = input.selectionEnd
    const replaceAt = start > 0 && prompt[start - 1] === '@' ? start - 1 : start
    const before = prompt.slice(0, replaceAt)
    const after = prompt.slice(end)
    const next = `${before}${token} ${after}`
    setPrompt(next)
    setMentionOpen(false)

    requestAnimationFrame(() => {
      input.focus()
      const nextPosition = before.length + token.length + 1
      input.setSelectionRange(nextPosition, nextPosition)
    })
  }

  const handlePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextPrompt = event.target.value
    const cursor = event.target.selectionStart
    setPrompt(nextPrompt)
    setMentionOpen(referenceImagePreviews.length > 0 && nextPrompt[cursor - 1] === '@')
  }

  const refreshTaskStatus = async (item: { id: number; result_image_id: number | null; status: string; parameters: unknown }) => {
    const params = parseParameters(item.parameters)
    const providerTaskId = typeof params.providerTaskId === 'string' ? params.providerTaskId : ''
    if (!providerTaskId) {
      toast.error(t('missingTaskId'))
      return
    }

    try {
      const { videoBaseUrl, videoApiKey } = useApiConfigStore.getState()
      const res = await fetch(`/api/video/status/${providerTaskId}`, {
        headers: {
          'x-video-base-url': videoBaseUrl,
          'x-video-api-key': videoApiKey,
        },
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || `Failed to refresh task status (${res.status})`)
      }

      if (useVideoGenerateStore.getState().taskId === providerTaskId) {
        if (data.status === 'succeeded') {
          useVideoGenerateStore.setState({
            progress: 100,
            result: data.videoUrl,
            generating: false,
            status: 'succeeded',
            remoteResult: Boolean(data.remote),
            error: null,
            errorDetails: null,
          })
        } else if (data.status === 'failed') {
          useVideoGenerateStore.setState({
            generating: false,
            status: 'failed',
            error: data.error || 'Video generation failed',
            errorDetails: {
              providerCode: data.providerStatus ?? data.code ?? 'failed',
              providerMessage: data.providerMessage ?? data.error ?? 'Video generation failed',
              serverMessage: data.error || 'Video generation failed',
            },
          })
        } else {
          useVideoGenerateStore.setState((s) => ({
            progress: Math.min(s.progress + 5, 95),
            status: data.status || 'running',
          }))
        }
      }

      await fetchHistory()
      toast.success(t('statusRefreshed'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('unknownError'))
    }
  }

  const downloadResult = () => {
    if (!result) return
    const anchor = document.createElement('a')
    anchor.href = result
    anchor.download = 'generated-video.mp4'
    anchor.click()
  }

  const openHistoryResult = async (item: { result_image_id: number | null; status: string; parameters: unknown }, params: Record<string, unknown>) => {
    try {
      const remoteVideoUrl = typeof params.remoteVideoUrl === 'string' ? params.remoteVideoUrl : ''
      if (remoteVideoUrl) {
        window.open(remoteVideoUrl, '_blank', 'noopener,noreferrer')
        return
      }
      if (!item.result_image_id) {
        toast.error(t('missingResultLink'))
        return
      }
      const res = await fetch(`/api/images/${item.result_image_id}`)
      if (!res.ok) throw new Error(`Failed to load result link (${res.status})`)
      const image = await res.json()
      if (!image?.url) throw new Error(t('missingResultLink'))
      window.open(image.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('missingResultLink'))
    }
  }

  const applyHistoryPreset = (item: { prompt: string; parameters: unknown }) => {
    const params = parseParameters(item.parameters)

    setPrompt(item.prompt || '')
    if (isMode(params.mode)) setMode(params.mode)
    if (typeof params.duration === 'string' || typeof params.duration === 'number') setDuration(String(params.duration))
    if (typeof params.resolution === 'string') setResolution(params.resolution)
    if (typeof params.aspectRatio === 'string') setAspectRatio(params.aspectRatio)
    if (typeof params.seed === 'string') setSeed(params.seed)
    if (typeof params.seed === 'number') setSeed(String(params.seed))
    if (typeof params.watermark === 'boolean') setWatermark(params.watermark)
    if (typeof params.generateAudio === 'boolean') setGenerateAudio(params.generateAudio)
    if (typeof params.callbackUrl === 'string') setCallbackUrl(params.callbackUrl)
    if (typeof params.advancedJson === 'string') setAdvancedJson(params.advancedJson)
    setImageFile(null)
    setEndFrameFile(null)
    setReferenceImages([])
    setReferenceVideo(null)
    setReferenceAudio(null)
    toast.success(t('historyLoaded'))
  }

  const canShowSourceImage = hasVideoModeInput(mode, 'sourceImage')
  const canShowEndFrame = hasVideoModeInput(mode, 'endFrame')
  const canShowReferenceImages = hasVideoModeInput(mode, 'referenceImages')
  const canShowReferenceVideo = hasVideoModeInput(mode, 'referenceVideo')
  const canShowReferenceAudio = hasVideoModeInput(mode, 'referenceAudio')
  const elapsedLabel = startedAt ? formatElapsed(now - startedAt) : '00:00'
  const normalizedStatus = formatStatus(status)
  const pollingLabel = generating
    ? t('pollingState')
    : normalizedStatus === 'succeeded' || normalizedStatus === 'done'
      ? t('pollingDone')
      : normalizedStatus === 'failed' || normalizedStatus === 'error'
        ? t('pollingFailed')
        : taskId
          ? t('pollingPaused')
          : t('pollingIdle')
  const serverErrorMessage = errorDetails?.serverMessage || error || t('unknownError')
  const providerErrorMessage = errorDetails?.providerMessage
  const providerErrorCode = errorDetails?.providerCode

  return (
    <div className="flex h-full min-h-0 bg-background">
      <div className="flex w-[clamp(380px,28vw,420px)] min-h-0 flex-col border-r border-border/60">
        <div className="border-b border-border/60 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={isVideoConfigured() ? 'default' : 'destructive'} className="rounded-md">
                {isVideoConfigured() ? t('apiReady') : ts('videoApiNotConfigured')}
              </Badge>
              <div className="max-w-[180px] truncate text-right text-[11px] text-muted-foreground">{videoModel}</div>
              <div className="max-w-[180px] truncate text-right font-mono text-[10px] text-muted-foreground">{videoBaseUrl}</div>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-5">
            <section className="space-y-3 rounded-lg border border-border/60 bg-card/30 p-4">
              <div>
                <Label className="text-sm font-medium">{t('modeLabel')}</Label>
                <p className="text-xs text-muted-foreground">{t('modeHint')}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {MODES.map(({ value, labelKey, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setMode(value)}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-medium transition-colors',
                      mode === value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/40'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="truncate">{t(labelKey)}</span>
                  </button>
                ))}
              </div>
            </section>

            {canShowSourceImage ? (
              <FileBlock
                label={t('inputImage')}
                hint={t('uploadImageHint')}
                icon={Upload}
                image
                preview={imagePreview || undefined}
                selectedName={imageFile?.name}
                onPick={(files) => setImageFile(files[0] ?? null)}
                onClear={() => setImageFile(null)}
                accept="image/*"
                multiple={false}
              />
            ) : null}

            {canShowEndFrame ? (
              <FileBlock
                label={t('endFrame')}
                hint={t('endFrameHint')}
                icon={Frame}
                image
                preview={endFramePreview || undefined}
                selectedName={endFrameFile?.name}
                onPick={(files) => setEndFrameFile(files[0] ?? null)}
                onClear={() => setEndFrameFile(null)}
                accept="image/*"
                multiple={false}
              />
            ) : null}

            {canShowReferenceImages ? (
              <section className="space-y-3 rounded-lg border border-border/60 bg-card/30 p-4">
                <div>
                  <Label className="text-sm font-medium">{t('referenceImages')}</Label>
                  <p className="text-xs text-muted-foreground">{t('referenceImagesHint')}</p>
                </div>
                {referenceImagePreviews.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {referenceImagePreviews.map((preview, index) => (
                        <div key={`${preview}-${index}`} className="relative overflow-hidden rounded-lg border border-border">
                          <img src={preview} alt={`${t('referenceImages')} ${index + 1}`} className="h-28 w-full object-cover" />
                          <Button
                            variant="secondary"
                            size="sm"
                            className="absolute left-2 top-2 h-7 bg-background/85 px-2 font-mono text-xs shadow-sm backdrop-blur"
                            onClick={() => insertPromptReference(`@img${index + 1}`)}
                          >
                            @img{index + 1}
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon-sm"
                            className="absolute right-2 top-2"
                            onClick={() => setReferenceImages(referenceImages.filter((_, i) => i !== index))}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setReferenceImages([])}>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      {tc('reset')}
                    </Button>
                    {referenceImages.length < 9 ? (
                      <DragDropZone
                        onDrop={(files) => setReferenceImages([...referenceImages, ...files].slice(0, 9))}
                        accept="image/*"
                        multiple
                        className="rounded-lg"
                      >
                        <div className="flex min-h-[92px] flex-col items-center justify-center gap-2 px-4 py-4 text-center">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <ImageIcon className="h-4 w-4" />
                          </div>
                          <p className="text-xs font-medium">{t('uploadReferenceImagesHint')}</p>
                        </div>
                      </DragDropZone>
                    ) : null}
                  </div>
                ) : (
                  <DragDropZone onDrop={(files) => setReferenceImages(files.slice(0, 9))} accept="image/*" multiple className="rounded-lg">
                    <div className="flex min-h-[140px] flex-col items-center justify-center gap-2 px-4 py-6 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-medium">{t('referenceImages')}</p>
                      <p className="max-w-[240px] text-xs text-muted-foreground">{t('uploadReferenceImagesHint')}</p>
                    </div>
                  </DragDropZone>
                )}
              </section>
            ) : null}

            {canShowReferenceVideo || canShowReferenceAudio ? (
              <div className="space-y-4">
                {canShowReferenceVideo ? (
                  <FileBlock
                    label={t('referenceVideo')}
                    hint={t('referenceVideoHint')}
                    icon={Video}
                    selectedName={referenceVideo?.name}
                    onPick={(files) => setReferenceVideo(files[0] ?? null)}
                    onClear={() => setReferenceVideo(null)}
                    accept="video/*"
                    multiple={false}
                  />
                ) : null}
                {canShowReferenceAudio ? (
                  <FileBlock
                    label={t('referenceAudio')}
                    hint={t('referenceAudioHint')}
                    icon={AudioLines}
                    selectedName={referenceAudio?.name}
                    onPick={(files) => setReferenceAudio(files[0] ?? null)}
                    onClear={() => setReferenceAudio(null)}
                    accept="audio/*"
                    multiple={false}
                  />
                ) : null}
              </div>
            ) : null}

            <section className="space-y-3 rounded-lg border border-border/60 bg-card/30 p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">{t('promptLabel')}</Label>
              </div>
              <Textarea
                ref={promptRef}
                value={prompt}
                onChange={handlePromptChange}
                onBlur={() => window.setTimeout(() => setMentionOpen(false), 120)}
                placeholder={t('promptPlaceholder')}
                className="min-h-[140px] resize-none bg-background/60 font-medium"
              />
              {mentionOpen ? (
                <div className="z-20 rounded-lg border border-border bg-popover p-2 shadow-lg">
                  <div className="grid gap-1">
                    {referenceImagePreviews.map((preview, index) => (
                      <button
                        key={`${preview}-mention-${index}`}
                        type="button"
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                        onMouseDown={(event) => {
                          event.preventDefault()
                          insertImageMention(`@img${index + 1}`)
                        }}
                      >
                        <img src={preview} alt="" className="h-9 w-9 rounded object-cover" />
                        <span className="font-mono text-xs">@img{index + 1}</span>
                        <span className="min-w-0 truncate text-xs text-muted-foreground">
                          {referenceImages[index]?.name || t('referenceImages')}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {referenceImagePreviews.some((_, index) => prompt.includes(`@img${index + 1}`)) ? (
                <div className="flex flex-wrap gap-2">
                  {referenceImagePreviews.map((preview, index) => {
                    const token = `@img${index + 1}`
                    if (!prompt.includes(token)) return null
                    return (
                      <button
                        key={`${preview}-chip-${index}`}
                        type="button"
                        className="group relative rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-primary hover:bg-muted"
                        onClick={() => insertImageMention(token)}
                      >
                        {token}
                        <span className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-44 rounded-lg border border-border bg-popover p-1 shadow-xl group-hover:block">
                          <img src={preview} alt="" className="h-32 w-full rounded object-cover" />
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">{t('promptHint')}</p>
            </section>

            <section className="space-y-4 rounded-lg border border-border/60 bg-card/30 p-4">
              <div>
                <Label className="text-sm font-medium">{t('durationLabel')}</Label>
                <p className="text-xs text-muted-foreground">{t('durationHint')}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {DURATION_OPTIONS.map((value) => (
                  <button
                    key={value}
                    onClick={() => setDuration(value)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      duration === value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/40'
                    )}
                  >
                    {value}s
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-4 rounded-lg border border-border/60 bg-card/30 p-4">
              <div>
                <Label className="text-sm font-medium">{t('resolutionLabel')}</Label>
                <p className="text-xs text-muted-foreground">{t('resolutionHint')}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {RESOLUTIONS.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setResolution(item.value)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      resolution === item.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/40'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-4 rounded-lg border border-border/60 bg-card/30 p-4">
              <div>
                <Label className="text-sm font-medium">{t('aspectRatioLabel')}</Label>
                <p className="text-xs text-muted-foreground">{t('aspectRatioHint')}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {ASPECT_RATIOS.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setAspectRatio(item.value)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      aspectRatio === item.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-border/80 hover:bg-muted/40'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-4 rounded-lg border border-border/60 bg-card/30 p-4">
              <div>
                <Label className="text-sm font-medium">{t('seed')}</Label>
                <p className="text-xs text-muted-foreground">{t('seedHint')}</p>
              </div>
              <Input
                type="number"
                value={seed}
                onChange={(event) => setSeed(event.target.value)}
                placeholder={t('seedPlaceholder')}
                className="bg-background/60"
              />

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm font-medium">{t('watermark')}</Label>
                  <p className="text-xs text-muted-foreground">{t('watermarkHint')}</p>
                </div>
                <Switch checked={watermark} onCheckedChange={setWatermark} />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm font-medium">{t('generateAudio')}</Label>
                  <p className="text-xs text-muted-foreground">{t('generateAudioHint')}</p>
                </div>
                <Switch checked={generateAudio} onCheckedChange={setGenerateAudio} />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('callbackUrl')}</Label>
                <Input
                  value={callbackUrl}
                  onChange={(event) => setCallbackUrl(event.target.value)}
                  placeholder={t('callbackUrlPlaceholder')}
                  className="bg-background/60 font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('advancedJson')}</Label>
                <Textarea
                  value={advancedJson}
                  onChange={(event) => setAdvancedJson(event.target.value)}
                  placeholder={t('advancedJsonPlaceholder')}
                  className="min-h-[110px] resize-y bg-background/60 font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">{t('advancedJsonHint')}</p>
              </div>
            </section>
          </div>
        </ScrollArea>

        <div className="border-t border-border/60 p-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => reset()}
              disabled={generating}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {tc('reset')}
            </Button>
            <Button
              variant="gradient"
              className="flex-1"
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('generating')}
                </>
              ) : (
                <>
                  <Video className="mr-2 h-4 w-4" />
                  {t('generateButton')}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border/60 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t('taskConsole')}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t('taskConsoleHint')}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{t('taskStatus')}</span>
              <Badge variant={statusTone(status)} className="rounded-md">
                {status ? t(`status_${formatStatus(status)}`) : t('status_idle')}
              </Badge>
              <Badge variant="outline" className="rounded-md">
                {pollingLabel}
              </Badge>
              <div className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/60 px-2.5 py-1 text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                <span>{t('elapsed')}</span>
                <span>{elapsedLabel}</span>
              </div>
              {remoteResult ? (
                <Badge variant="outline" className="rounded-md">
                  {t('remoteResult')}
                </Badge>
              ) : null}
              {taskId ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyText(taskId, t('taskIdCopied'))}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  {t('copyTaskId')}
                </Button>
              ) : null}
              {result ? (
                <>
                  <Button size="sm" variant="outline" onClick={downloadResult}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    {tc('download')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copyText(result, t('linkCopied'))}>
                    <Link2 className="mr-1.5 h-3.5 w-3.5" />
                    {t('copyLink')}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 p-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <section className="flex min-h-0 flex-col rounded-lg border border-border/60 bg-card/30 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">{t('resultTitle')}</h2>
                <p className="text-xs text-muted-foreground">{t('resultSubtitle')}</p>
              </div>
              {taskId ? <Badge variant="outline" className="font-mono text-[10px]">{taskId}</Badge> : null}
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-border/60 bg-background/60 p-4">
              {error ? (
                <div className="max-w-lg space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex items-center gap-2">
                    <X className="h-5 w-5 text-destructive" />
                    <p className="text-sm font-medium text-destructive">{t('taskFailed')}</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="rounded-md border border-border/60 bg-background/70 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('serverError')}</p>
                      <p className="mt-1 text-sm text-foreground">{serverErrorMessage}</p>
                    </div>
                    {providerErrorMessage ? (
                      <div className="rounded-md border border-border/60 bg-background/70 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('providerError')}</p>
                        <p className="mt-1 text-sm text-foreground">
                          {providerErrorCode ? <span className="font-mono">[{providerErrorCode}] </span> : null}
                          {providerErrorMessage}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : generating ? (
                <div className="flex w-full max-w-md flex-col items-center gap-4">
                  <motion.div
                    className="flex h-24 w-24 items-center justify-center rounded-lg border border-primary/20 bg-primary/5"
                    animate={{ scale: [1, 1.04, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </motion.div>
                  <div className="text-center">
                    <p className="text-sm font-medium">{t('generatingDesc')}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t('generatingWait')}</p>
                  </div>
                  <div className="w-full space-y-2">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        animate={{ width: `${progress}%` }}
                        transition={{ ease: 'easeOut', duration: 0.35 }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t('progressLabel')}</span>
                      <span>{progress}%</span>
                    </div>
                  </div>
                </div>
              ) : result ? (
                <div className="w-full space-y-4">
                  <div className="overflow-hidden rounded-lg border border-border/60 bg-black/90">
                    <video src={result} controls className="h-full max-h-[min(60vh,640px)] w-full object-contain" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      {t('taskSucceeded')}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1">
                      <Video className="h-3.5 w-3.5" />
                      {result.startsWith('http') ? t('remoteResult') : t('localResult')}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex max-w-sm flex-col items-center text-center">
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-lg border border-border/60 bg-muted/40">
                    <Video className="h-9 w-9 text-muted-foreground" />
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
                <p className="text-xs text-muted-foreground">{t('historyHint')}</p>
              </div>
              <Badge variant="secondary" className="rounded-md">
                {history.length}
              </Badge>
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
                    const params = parseParameters(item.parameters)
                    const modeValue = isMode(params.mode) ? params.mode : 't2v'
                    const createdAt = item.created_at ? new Date(String(item.created_at)).toLocaleString() : ''

                    return (
                      <div
                        key={item.id}
                        className="group rounded-lg border border-border/60 bg-background/60 p-3 transition-colors hover:border-primary/40 hover:bg-background"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={item.status === 'done' ? 'default' : item.status === 'error' ? 'destructive' : 'secondary'}>
                                {item.status}
                              </Badge>
                              <Badge variant="outline">
                                {t(getModeLabel(modeValue))}
                              </Badge>
                            </div>
                            <p className="line-clamp-2 text-sm text-foreground">{item.prompt}</p>
                            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                              <span>{params.duration ? `${String(params.duration)}s` : '—'}</span>
                              <span>{formatHistoryParam(params.resolution)}</span>
                              <span>{formatHistoryParam(params.aspectRatio)}</span>
                              <span>{formatHistoryParam(params.model)}</span>
                            </div>
                            {createdAt ? <div className="text-[11px] text-muted-foreground">{createdAt}</div> : null}
                          </div>

                          <div className="flex shrink-0 flex-col gap-2">
                            <Button variant="ghost" size="icon-sm" onClick={() => applyHistoryPreset(item)}>
                              <Clock3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => void refreshTaskStatus(item)}>
                              <RefreshCcw className="h-3.5 w-3.5" />
                            </Button>
                            {item.status === 'done' ? (
                              <Button variant="outline" size="sm" onClick={() => void openHistoryResult(item, params)}>
                                <Link2 className="mr-1.5 h-3.5 w-3.5" />
                                {t('openResult')}
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => copyText(String(item.id), t('taskIdCopied'))}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
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
    </div>
  )
}
