import { useCallback, useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/compat/client'

interface DragDropZoneProps {
  onDrop: (files: File[]) => void
  accept?: string
  multiple?: boolean
  className?: string
  children?: React.ReactNode
}

export function DragDropZone({ onDrop, accept = 'image/*', multiple = true, className, children }: DragDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const t = useTranslations('gallery')

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false) }, [])
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const files = Array.from(e.dataTransfer.files).filter((f) => accept === 'image/*' ? f.type.startsWith('image/') : true)
    if (files.length) onDrop(files)
  }, [accept, onDrop])
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length) onDrop(files)
  }, [onDrop])

  return (
    <div
      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
      className={cn('relative rounded-xl border-2 border-dashed transition-all',
        isDragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-muted-foreground/25 hover:border-muted-foreground/50', className
      )}
    >
      <input type="file" accept={accept} multiple={multiple} onChange={handleFileInput} className="absolute inset-0 z-10 cursor-pointer opacity-0" />
      {children || (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className={cn('mb-4 flex h-12 w-12 items-center justify-center rounded-full transition-colors', isDragging ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
            <Upload className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium">{isDragging ? t('dragDropHint') : t('dragDropHint')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('fileTypes')}</p>
        </div>
      )}
    </div>
  )
}
