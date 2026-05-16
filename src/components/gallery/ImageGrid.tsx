import { motion } from 'framer-motion'
import { Edit3, Play, Trash2, Download, Sparkles } from 'lucide-react'
import type { ImageData } from '@/types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useImageStore } from '@/store/useImageStore'
import { useTranslations } from '@/i18n/compat/client'
import { formatMediaDimensions, getMediaKind } from '@/lib/media'
import { toast } from 'sonner'

interface ImageGridProps {
  images: ImageData[]
  onSelect: (image: ImageData) => void
  onEdit: (image: ImageData) => void
}

export function ImageGrid({ images, onSelect, onEdit }: ImageGridProps) {
  const { deleteImage } = useImageStore()
  const t = useTranslations('gallery')

  const handleDelete = async (e: React.MouseEvent, image: ImageData) => {
    e.stopPropagation()
    if (confirm(t('deleteConfirm', { name: image.original_name }))) {
      await deleteImage(image.id)
      toast.success(t('deleted'))
    }
  }

  const handleDownload = (e: React.MouseEvent, image: ImageData) => {
    e.stopPropagation()
    const a = document.createElement('a')
    a.href = image.url
    a.download = image.original_name
    a.click()
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {images.map((image, index) => (
        <GalleryItem key={image.id} image={image} index={index} onSelect={onSelect} onEdit={onEdit} onDelete={handleDelete} onDownload={handleDownload} />
      ))}
    </div>
  )
}

function GalleryItem({
  image,
  index,
  onSelect,
  onEdit,
  onDelete,
  onDownload,
}: {
  image: ImageData
  index: number
  onSelect: (image: ImageData) => void
  onEdit: (image: ImageData) => void
  onDelete: (e: React.MouseEvent, image: ImageData) => void
  onDownload: (e: React.MouseEvent, image: ImageData) => void
}) {
  const mediaKind = getMediaKind(image)
  const isVideo = mediaKind === 'video'
  const t = useTranslations('gallery')

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-border/50 bg-card"
      onClick={() => onSelect(image)}
    >
      {isVideo ? (
        <>
          <video
            src={image.url}
            className="h-full w-full bg-black object-cover transition-transform duration-300 group-hover:scale-105"
            preload="metadata"
            muted
            playsInline
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/15">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm">
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            </div>
          </div>
        </>
      ) : (
        <img
          src={image.url}
          alt={image.original_name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      )}

      {image.is_generated && (
        <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          <Sparkles className="h-3 w-3" />
          {t('aiGenerated')}
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="truncate text-sm font-medium text-white">{image.original_name}</p>
          <p className="text-[10px] text-white/60">{formatMediaDimensions(image)}</p>
        </div>

        <div className="absolute top-2 right-2 flex gap-1">
          {!isVideo && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon-sm" variant="secondary" className="h-7 w-7 bg-white/20 backdrop-blur-sm hover:bg-white/30 border-0" onClick={(e) => { e.stopPropagation(); onEdit(image) }}>
                  <Edit3 className="h-3.5 w-3.5 text-white" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('editImage')}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-sm" variant="secondary" className="h-7 w-7 bg-white/20 backdrop-blur-sm hover:bg-white/30 border-0" onClick={(e) => onDownload(e, image)}>
                <Download className="h-3.5 w-3.5 text-white" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('downloadImage')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon-sm" variant="secondary" className="h-7 w-7 bg-white/20 backdrop-blur-sm hover:bg-red-500/50 border-0" onClick={(e) => onDelete(e, image)}>
                <Trash2 className="h-3.5 w-3.5 text-white" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('deleteImage')}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </motion.div>
  )
}
