import { X, Edit3, Download, ZoomIn, ZoomOut } from 'lucide-react'
import type { ImageData } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTranslations } from '@/i18n/compat/client'
import { formatMediaDimensions, getMediaKind } from '@/lib/media'
import { useState } from 'react'

interface ImagePreviewProps {
  image: ImageData
  onClose: () => void
  onEdit: () => void
}

export function ImagePreview({ image, onClose, onEdit }: ImagePreviewProps) {
  const [zoom, setZoom] = useState(1)
  const t = useTranslations('gallery')
  const tPreview = useTranslations('preview')
  const isVideo = getMediaKind(image) === 'video'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={onClose}>
      <Button variant="ghost" size="icon" className="absolute top-4 right-4 z-10 text-white/70 hover:text-white hover:bg-white/10" onClick={onClose}>
        <X className="h-5 w-5" />
      </Button>

      {!isVideo && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-full bg-black/50 p-1 backdrop-blur-sm">
          <Button variant="ghost" size="icon-sm" className="text-white/70 hover:text-white hover:bg-white/10" onClick={(e) => { e.stopPropagation(); setZoom(Math.max(0.25, zoom - 0.25)) }}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="px-2 text-xs text-white/70 min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon-sm" className="text-white/70 hover:text-white hover:bg-white/10" onClick={(e) => { e.stopPropagation(); setZoom(Math.min(4, zoom + 0.25)) }}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div onClick={(e) => e.stopPropagation()} className="relative max-h-[80vh] max-w-[80vw] overflow-hidden rounded-lg">
        {isVideo ? (
          <video
            src={image.url}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="max-h-[80vh] max-w-[80vw] bg-black object-contain"
          />
        ) : (
          <img
            src={image.url}
            alt={image.original_name}
            className="object-contain transition-transform duration-200"
            style={{ transform: `scale(${zoom})`, maxHeight: '80vh', maxWidth: '80vw' }}
            draggable={false}
          />
        )}
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 rounded-full bg-black/50 px-4 py-2 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm text-white/90">
          <span className="font-medium">{image.original_name}</span>
          <span className="ml-2 text-white/50 text-xs">{formatMediaDimensions(image)}</span>
        </div>
        {image.is_generated && <Badge variant="default" className="text-[10px]">{t('aiGenerated')}</Badge>}
        <div className="flex gap-1 ml-2">
          {!isVideo && (
            <Button size="sm" variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10" onClick={onEdit}>
              <Edit3 className="h-4 w-4 mr-1" /> {tPreview('edit')}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10" onClick={() => {
            const a = document.createElement('a')
            a.href = image.url
            a.download = image.original_name
            a.click()
          }}>
            <Download className="h-4 w-4 mr-1" /> {tPreview('download')}
          </Button>
        </div>
      </div>
    </div>
  )
}
