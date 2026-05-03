import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Video } from 'lucide-react'

function VideoGenerateNode({ data }: NodeProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm min-w-[200px]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50 rounded-t-xl">
        <Video className="h-3.5 w-3.5 text-orange-500" />
        <span className="text-xs font-medium">{data.label as string}</span>
      </div>
      <div className="px-3 py-2 space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">模型</span>
          <span>{data.model as string}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">时长</span>
          <span>{data.duration as string}s</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">分辨率</span>
          <span>{data.resolution as string}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">比例</span>
          <span>{data.aspectRatio as string}</span>
        </div>
      </div>
      <Handle type="target" position={Position.Left} className="!bg-orange-500 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-orange-500 !w-2 !h-2" />
    </div>
  )
}

export default memo(VideoGenerateNode)
