import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import {
  Undo2, Redo2, ZoomIn, ZoomOut, Maximize, Save, Download, RotateCw,
  FlipHorizontal, FlipVertical, Crop, SlidersHorizontal,
  Pencil, MousePointer2, Type,
} from 'lucide-react'
import { useEditorStore } from '@/store/useEditorStore'
import { useImageStore } from '@/store/useImageStore'
import { useTranslations } from '@/i18n/compat/client'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { FilterPanel } from './FilterPanel'
import { Canvas } from './Canvas'
import { toast } from 'sonner'

interface EditorPageProps {
  imageId: string
}

export function EditorPage({ imageId }: EditorPageProps) {
  const { images, fetchImages } = useImageStore()
  const { currentImage, setCurrentImage, zoom, setZoom, resetView, tool, setTool, filters, setFilter, isSaving, setSaving } = useEditorStore()
  const [showFilters, setShowFilters] = useState(true)
  const t = useTranslations('editor')
  const tc = useTranslations('common')

  const tools = [
    { id: 'select' as const, icon: MousePointer2, label: t('select') },
    { id: 'crop' as const, icon: Crop, label: t('crop') },
    { id: 'rotate' as const, icon: RotateCw, label: t('rotate') },
    { id: 'draw' as const, icon: Pencil, label: t('draw') },
    { id: 'text' as const, icon: Type, label: t('text') },
  ]

  useEffect(() => {
    if (images.length === 0) fetchImages()
  }, [fetchImages, images.length])

  useEffect(() => {
    const img = images.find((i) => i.id === Number(imageId))
    if (img) setCurrentImage(img.url, img.id)
  }, [imageId, images, setCurrentImage])

  const handleSave = async () => {
    setSaving(true)
    await new Promise((r) => setTimeout(r, 1000))
    setSaving(false)
    toast.success(t('saved'))
  }

  const handleExport = () => {
    if (!currentImage) return
    const a = document.createElement('a')
    a.href = currentImage
    a.download = 'edited-image.png'
    a.click()
    toast.success(t('exported'))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-background/80">
        <div className="flex items-center gap-1">
          {tools.map((toolItem) => (
            <Tooltip key={toolItem.id}>
              <TooltipTrigger asChild>
                <Button variant={tool === toolItem.id ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setTool(toolItem.id)}>
                  <toolItem.icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{toolItem.label}</TooltipContent>
            </Tooltip>
          ))}
          <Separator orientation="vertical" className="h-6 mx-2" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={() => setFilter('hue', (filters.hue + 90) % 360)}>
                <RotateCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('rotate')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm"><FlipHorizontal className="h-4 w-4" /></Button>
            </TooltipTrigger>
            <TooltipContent>{t('flipH')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm"><FlipVertical className="h-4 w-4" /></Button>
            </TooltipTrigger>
            <TooltipContent>{t('flipV')}</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => useEditorStore.getState().undo()}><Undo2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon-sm" onClick={() => useEditorStore.getState().redo()}><Redo2 className="h-4 w-4" /></Button>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" onClick={() => setZoom(zoom - 0.25)}><ZoomOut className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{t('zoomOut')}</TooltipContent></Tooltip>
          <span className="text-xs text-muted-foreground min-w-[3rem] text-center px-1">{Math.round(zoom * 100)}%</span>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" onClick={() => setZoom(zoom + 0.25)}><ZoomIn className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{t('zoomIn')}</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" onClick={resetView}><Maximize className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>{t('fitView')}</TooltipContent></Tooltip>
          <Separator orientation="vertical" className="h-6 mx-2" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={() => setShowFilters(!showFilters)} className={showFilters ? 'bg-secondary' : ''}>
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('filters')}</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="h-6 mx-2" />
          <Button variant="ghost" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" />{t('export')}</Button>
          <Button variant="gradient" size="sm" onClick={handleSave} disabled={isSaving}><Save className="h-4 w-4 mr-1" />{isSaving ? t('saving') : t('save')}</Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden"><Canvas /></div>
        {showFilters && (
          <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="border-l border-border/50 bg-card/50 overflow-y-auto">
            <FilterPanel />
          </motion.div>
        )}
      </div>
    </div>
  )
}
