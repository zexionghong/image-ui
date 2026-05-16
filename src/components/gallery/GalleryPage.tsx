import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { Plus, Search, Filter, Images } from 'lucide-react'
import { useImageStore } from '@/store/useImageStore'
import { useTranslations, useLocale } from '@/i18n/compat/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ImageGrid } from './ImageGrid'
import { ImagePreview } from './ImagePreview'
import { DragDropZone } from '@/components/shared/DragDropZone'
import { EmptyState } from '@/components/shared/EmptyState'
import { toast } from 'sonner'

export function GalleryPage() {
  const { images, loading, fetchImages, uploadImage, selectedImage, setSelectedImage, search, setSearch } = useImageStore()
  const [showUpload, setShowUpload] = useState(false)
  const navigate = useNavigate()
  const t = useTranslations('gallery')
  const locale = useLocale()

  useEffect(() => {
    fetchImages()
  }, [fetchImages])

  const handleUpload = async (files: File[]) => {
    for (const file of files) {
      try {
        await uploadImage(file)
        toast.success(t('uploaded', { name: file.name }))
      } catch {
        toast.error(t('uploadFailed', { name: file.name }))
      }
    }
    setShowUpload(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              fetchImages({ search: e.target.value, page: 1 })
            }}
            className="pl-9 bg-muted/50"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowUpload(!showUpload)}>
          <Filter className="h-4 w-4 mr-1" />
          {t('filterButton')}
        </Button>
        <Button variant="gradient" size="sm" onClick={() => setShowUpload(!showUpload)}>
          <Plus className="h-4 w-4 mr-1" />
          {t('uploadButton')}
        </Button>
      </div>

      {/* Upload zone */}
      {showUpload && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="px-6 pt-4"
        >
          <DragDropZone onDrop={handleUpload} accept="image/*,video/mp4,video/webm,video/quicktime,.mp4,.m4v,.mov,.webm" className="p-2" />
        </motion.div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && images.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg image-skeleton" />
            ))}
          </div>
        ) : images.length === 0 ? (
          <EmptyState
            icon={Images}
            title={t('noImages')}
            description={t('noImagesDesc')}
            action={
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowUpload(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t('uploadFirst')}
                </Button>
                <Button variant="gradient" onClick={() => navigate({ to: `/${locale}/generate` })}>
                  {t('generateWithAI')}
                </Button>
              </div>
            }
          />
        ) : (
          <ImageGrid images={images} onSelect={setSelectedImage} onEdit={(img) => navigate({ to: `/${locale}/editor/$id`, params: { id: String(img.id) } })} />
        )}
      </div>

      {/* Preview dialog */}
      {selectedImage && (
        <ImagePreview
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
          onEdit={() => {
            navigate({ to: `/${locale}/editor/$id`, params: { id: String(selectedImage.id) } })
            setSelectedImage(null)
          }}
        />
      )}
    </div>
  )
}
