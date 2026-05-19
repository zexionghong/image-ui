import { memo, useRef, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ImagePlus, Loader2 } from 'lucide-react'
import { useWorkflowStore } from '@/store/useWorkflowStore'
import { apiFetch } from '@/lib/api'

function ImageInputNode({ id, data }: NodeProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData)

  const handleFile = async (file: File) => {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await apiFetch('/api/images/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (data.url) {
        updateNodeData(id, { imageUrl: data.url })
      }
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm min-w-[180px]">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50 rounded-t-xl">
        <ImagePlus className="h-3.5 w-3.5 text-green-500" />
        <span className="text-xs font-medium">{data.label as string}</span>
      </div>
      <div
        className="px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>上传中...</span>
          </div>
        ) : data.imageUrl ? (
          <img src={data.imageUrl as string} alt="" className="w-full h-16 object-cover rounded" />
        ) : (
          <p className="text-[10px] text-muted-foreground">点击上传图片</p>
        )}
      </div>
      <Handle id="trigger" type="target" position={Position.Left} className="!bg-green-500 !w-2 !h-2" />
      <Handle id="image" type="source" position={Position.Right} className="!bg-green-500 !w-2 !h-2" />
    </div>
  )
}

export default memo(ImageInputNode)
