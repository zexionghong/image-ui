import { useRef, useState, useCallback } from 'react'
import { useTranslations } from '@/i18n/compat/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Eraser, Paintbrush } from 'lucide-react'

interface MaskPaintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageSrc: string
  onSave: (maskDataUrl: string | null) => void
}

export function MaskPaintDialog({ open, onOpenChange, imageSrc, onSave }: MaskPaintDialogProps) {
  const t = useTranslations('generate')
  const tc = useTranslations('common')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [brushSize, setBrushSize] = useState(30)
  const [mode, setMode] = useState<'paint' | 'erase'>('paint')
  const isDrawing = useRef(false)
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 })

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const w = img.naturalWidth
    const h = img.naturalHeight
    setImgSize({ w, h })
    const canvas = canvasRef.current
    if (canvas) {
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, w, h)
    }
  }, [])

  const getPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }, [])

  const draw = useCallback((x: number, y: number) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.beginPath()
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
    if (mode === 'paint') {
      ctx.fillStyle = 'rgba(255, 255, 255, 1)'
      ctx.fill()
    } else {
      ctx.save()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0, 0, 0, 1)'
      ctx.fill()
      ctx.restore()
    }
  }, [brushSize, mode])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawing.current = true
    const { x, y } = getPos(e)
    draw(x, y)
  }, [getPos, draw])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return
    const { x, y } = getPos(e)
    draw(x, y)
  }, [getPos, draw])

  const handleMouseUp = useCallback(() => {
    isDrawing.current = false
  }, [])

  const clearMask = useCallback(() => {
    const canvas = canvasRef.current
    if (canvas) {
      canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [])

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) { onSave(null); return }
    const ctx = canvas.getContext('2d')!
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let hasContent = false
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) { hasContent = true; break }
    }
    onSave(hasContent ? canvas.toDataURL('image/png') : null)
  }, [onSave])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px]">
        <DialogHeader>
          <DialogTitle>{t('maskEditor')}</DialogTitle>
          <DialogDescription>{t('maskEditorDesc')}</DialogDescription>
        </DialogHeader>

        <div className="relative inline-block max-h-[60vh] overflow-auto mx-auto">
          <img src={imageSrc} onLoad={handleImageLoad} className="max-w-full max-h-[60vh] block select-none" draggable={false} />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 cursor-crosshair select-none"
            style={{ width: imgSize.w ? '100%' : undefined, height: imgSize.h ? '100%' : undefined, opacity: 0.5 }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <Label className="text-xs">{t('brushSize')}</Label>
          <Slider min={5} max={100} step={1} value={[brushSize]} onValueChange={([v]) => setBrushSize(v)} className="w-32" />
          <span className="text-xs text-muted-foreground w-8">{brushSize}px</span>

          <div className="flex gap-1 ml-auto">
            <Button variant={mode === 'paint' ? 'default' : 'outline'} size="sm" onClick={() => setMode('paint')}>
              <Paintbrush className="h-3.5 w-3.5 mr-1" />{t('paint')}
            </Button>
            <Button variant={mode === 'erase' ? 'default' : 'outline'} size="sm" onClick={() => setMode('erase')}>
              <Eraser className="h-3.5 w-3.5 mr-1" />{t('erase')}
            </Button>
            <Button variant="outline" size="sm" onClick={clearMask}>{t('clearMask')}</Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button onClick={handleSave}>{t('applyMask')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
