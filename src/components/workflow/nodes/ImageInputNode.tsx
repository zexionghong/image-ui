import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ImagePlus } from 'lucide-react'

function ImageInputNode({ data }: NodeProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm min-w-[180px]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50 rounded-t-xl">
        <ImagePlus className="h-3.5 w-3.5 text-green-500" />
        <span className="text-xs font-medium">{data.label as string}</span>
      </div>
      <div className="px-3 py-2">
        {data.imageUrl ? (
          <img src={data.imageUrl as string} alt="" className="w-full h-16 object-cover rounded" />
        ) : (
          <p className="text-[10px] text-muted-foreground">点击上传图片</p>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-green-500 !w-2 !h-2" />
    </div>
  )
}

export default memo(ImageInputNode)
