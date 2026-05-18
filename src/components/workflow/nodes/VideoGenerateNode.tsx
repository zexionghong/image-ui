import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Video, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useWorkflowStore } from '@/store/useWorkflowStore'

function VideoGenerateNode({ id, data }: NodeProps) {
  const status = useWorkflowStore((s) => s.nodeStatuses[id] || 'idle')
  const result = data.result as { type: string; videoUrl?: string } | undefined

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm min-w-[200px]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50 rounded-t-xl">
        <Video className="h-3.5 w-3.5 text-orange-500" />
        <span className="text-xs font-medium">{data.label as string}</span>
        {status === 'running' && <Loader2 className="h-3 w-3 animate-spin text-primary ml-auto" />}
        {status === 'done' && <CheckCircle2 className="h-3 w-3 text-green-500 ml-auto" />}
        {status === 'error' && <AlertCircle className="h-3 w-3 text-destructive ml-auto" />}
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
        {result?.type === 'video' && result.videoUrl && (
          <video src={result.videoUrl} className="w-full h-16 object-cover rounded mt-1" />
        )}
      </div>
      <Handle id="prompt" type="target" position={Position.Left} className="!bg-blue-500 !w-2 !h-2" style={{ top: '34%' }} />
      <Handle id="image" type="target" position={Position.Left} className="!bg-green-500 !w-2 !h-2" style={{ top: '66%' }} />
      <Handle id="video" type="source" position={Position.Right} className="!bg-orange-500 !w-2 !h-2" />
    </div>
  )
}

export default memo(VideoGenerateNode)
