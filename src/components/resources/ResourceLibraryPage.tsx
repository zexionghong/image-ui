import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  Clipboard,
  FolderKanban,
  FolderPlus,
  Loader2,
  Play,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useLocale } from '@/i18n/compat/client'
import { useApiConfigStore } from '@/store/useApiConfigStore'
import { useResourceStore } from '@/store/useResourceStore'
import { useVideoGenerateStore } from '@/store/useVideoGenerateStore'
import {
  buildResourceAssetPath,
  buildThreeViewVideoPrompt,
  THREE_VIEW_ANGLES,
  THREE_VIEW_ANGLE_LABELS,
  type ThreeViewAngle,
} from '@/lib/resourceLibrary'
import { cn } from '@/lib/utils'

const SIZE_OPTIONS = ['1024x1024', '1536x1024', '1024x1536'] as const

export function ResourceLibraryPage() {
  const {
    projects,
    selectedProjectId,
    loading,
    generatingProjectId,
    generationProgress,
    fetchProjects,
    createProject,
    selectProject,
    generateThreeViews,
  } = useResourceStore()
  const { isConfigured, model } = useApiConfigStore()
  const { setMode, setPrompt } = useVideoGenerateStore()
  const navigate = useNavigate()
  const locale = useLocale()

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [subject, setSubject] = useState('')
  const [style, setStyle] = useState('')
  const [notes, setNotes] = useState('')
  const [size, setSize] = useState<(typeof SIZE_OPTIONS)[number]>('1024x1024')

  useEffect(() => {
    void fetchProjects()
  }, [fetchProjects])

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || projects[0] || null,
    [projects, selectedProjectId]
  )

  useEffect(() => {
    if (!selectedProject) return
    setSubject(selectedProject.subject || selectedProject.name)
    setStyle(selectedProject.style || '')
  }, [selectedProject?.id])

  const assetsByRole = useMemo(() => {
    const map = new Map<string, NonNullable<typeof selectedProject>['assets'][number]>()
    selectedProject?.assets.forEach((asset) => map.set(asset.role, asset))
    return map
  }, [selectedProject])

  const createNewProject = async () => {
    if (!name.trim()) {
      toast.error('请输入项目名称')
      return
    }
    try {
      const project = await createProject({
        name,
        description,
        subject: subject || name,
        style,
      })
      setCreateOpen(false)
      setName('')
      setDescription('')
      setSubject(project.subject || project.name)
      setStyle(project.style || '')
      toast.success('资源项目已创建')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建项目失败')
    }
  }

  const generateViews = async () => {
    if (!selectedProject) return
    if (!isConfigured()) {
      toast.error('请先在设置中配置图片生成 API Key')
      return
    }
    if (!subject.trim()) {
      toast.error('请输入主体描述')
      return
    }
    try {
      await generateThreeViews(selectedProject.id, {
        subject,
        style,
        notes,
        size,
      })
      toast.success('三视图已生成并归档到项目')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '生成三视图失败')
    }
  }

  const copyPath = async (angle: ThreeViewAngle) => {
    if (!selectedProject) return
    const path = buildResourceAssetPath(selectedProject.name, angle)
    try {
      await navigator.clipboard.writeText(path)
      toast.success('资源路径已复制')
    } catch {
      toast.error('复制失败')
    }
  }

  const useForVideo = () => {
    if (!selectedProject) return
    const readyAngles = THREE_VIEW_ANGLES.filter((angle) => assetsByRole.has(angle))
    if (readyAngles.length < 3) {
      toast.error('请先生成完整三视图')
      return
    }
    const paths = THREE_VIEW_ANGLES.map((angle) => buildResourceAssetPath(selectedProject.name, angle))
    setMode('multimodal')
    setPrompt(`${buildThreeViewVideoPrompt(subject || selectedProject.subject || selectedProject.name)}\n\n${paths.join(' ')}`)
    navigate({ to: `/${locale}/video-generate` })
  }

  const isGenerating = selectedProject ? generatingProjectId === selectedProject.id : false

  return (
    <div className="flex h-full min-h-0 bg-background">
      <aside className="flex w-[300px] min-h-0 flex-col border-r border-border/60">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-4">
          <div>
            <h1 className="text-base font-semibold">资源库</h1>
            <p className="text-xs text-muted-foreground">按项目组织视频素材</p>
          </div>
          <Button size="icon-sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <FolderPlus className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-2 p-3">
            {loading && projects.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-border/60 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载项目中
              </div>
            ) : null}

            {projects.map((project) => {
              const active = selectedProject?.id === project.id
              const assetCount = project.assets.length
              return (
                <button
                  key={project.id}
                  onClick={() => selectProject(project.id)}
                  className={cn(
                    'w-full rounded-lg border p-3 text-left transition-colors',
                    active ? 'border-primary/50 bg-primary/10' : 'border-border/60 bg-card/30 hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{project.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{project.description || project.subject || '未填写描述'}</p>
                    </div>
                    <Badge variant={assetCount >= 3 ? 'default' : 'secondary'} className="rounded-md">
                      {assetCount}/3
                    </Badge>
                  </div>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {selectedProject ? (
          <>
            <div className="border-b border-border/60 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <FolderKanban className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold">{selectedProject.name}</h2>
                    <Badge variant="outline" className="rounded-md">{model}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedProject.description || '项目素材会按目录路径被视频生成引用'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" onClick={useForVideo}>
                    <Play className="mr-2 h-4 w-4" />
                    用于视频
                  </Button>
                  <Button variant="gradient" onClick={generateViews} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                    一键生成三视图
                  </Button>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="grid gap-5 p-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <section className="space-y-4 rounded-lg border border-border/60 bg-card/30 p-4">
                  <div>
                    <h3 className="text-sm font-semibold">生成设置</h3>
                    <p className="mt-1 text-xs text-muted-foreground">生成后会自动放入项目目录</p>
                  </div>
                  <div className="space-y-2">
                    <Label>主体</Label>
                    <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="例如：赛博朋克女战士" />
                  </div>
                  <div className="space-y-2">
                    <Label>风格</Label>
                    <Input value={style} onChange={(event) => setStyle(event.target.value)} placeholder="例如：电影级写实、游戏角色设定" />
                  </div>
                  <div className="space-y-2">
                    <Label>补充细节</Label>
                    <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="服装、材质、发型、道具等" className="min-h-[120px]" />
                  </div>
                  <div className="space-y-2">
                    <Label>尺寸</Label>
                    <Select value={size} onValueChange={(value) => setSize(value as typeof size)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SIZE_OPTIONS.map((item) => (
                          <SelectItem key={item} value={item}>{item}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {isGenerating ? (
                    <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">生成进度</span>
                        <span className="font-medium">{generationProgress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <motion.div className="h-full bg-primary" animate={{ width: `${generationProgress}%` }} />
                      </div>
                    </div>
                  ) : null}
                </section>

                <section className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    {THREE_VIEW_ANGLES.map((angle) => {
                      const asset = assetsByRole.get(angle)
                      const path = buildResourceAssetPath(selectedProject.name, angle)
                      return (
                        <div key={angle} className="overflow-hidden rounded-lg border border-border/60 bg-card/30">
                          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
                            <div className="flex items-center gap-2">
                              {asset ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Sparkles className="h-4 w-4 text-muted-foreground" />}
                              <span className="text-sm font-medium">三视图 / {THREE_VIEW_ANGLE_LABELS[angle]}</span>
                            </div>
                            <Button size="icon-sm" variant="ghost" onClick={() => void copyPath(angle)}>
                              <Clipboard className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="aspect-square bg-muted/30">
                            {asset ? (
                              <img src={asset.image.url} alt={asset.image.original_name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full flex-col items-center justify-center px-4 text-center text-muted-foreground">
                                <FolderKanban className="mb-3 h-8 w-8" />
                                <p className="text-sm">等待生成</p>
                              </div>
                            )}
                          </div>
                          <div className="border-t border-border/60 p-3">
                            <code className="block truncate rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">{path}</code>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <FolderKanban className="mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="text-lg font-semibold">还没有资源项目</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">先创建一个项目，再把角色、产品或场景素材按目录归档。</p>
            <Button className="mt-5" variant="gradient" onClick={() => setCreateOpen(true)}>
              <FolderPlus className="mr-2 h-4 w-4" />
              创建项目
            </Button>
          </div>
        )}
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建资源项目</DialogTitle>
            <DialogDescription>项目会作为资源库目录，生成的三视图会放进项目下。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>项目名称</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：角色A" />
            </div>
            <div className="space-y-2">
              <Label>主体</Label>
              <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="用于生成三视图的主体描述" />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="这个项目要服务的视频或素材用途" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button variant="gradient" onClick={createNewProject}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
