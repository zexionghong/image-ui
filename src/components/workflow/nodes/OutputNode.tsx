import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Eye, Loader2, AlertCircle } from 'lucide-react'
import { useWorkflowStore } from '@/store/useWorkflowStore'

function OutputNode({ id, data }: NodeProps) {
  const status = useWorkflowStore((s) => s.nodeStatuses[id] || 'idle')
  const result = data.result as { type: string; imageUrl?: string; videoUrl?: string } | undefined

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm min-w-[180px]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50 rounded-t-xl">
        <Eye className="h-3.5 w-3.5 text-pink-500" />
        <span className="text-xs font-medium">{data.label as string}</span>
        {status === 'running' && <Loader2 className="h-3 w-3 animate-spin text-primary ml-auto" />}
        {status === 'error' && <AlertCircle className="h-3 w-3 text-destructive ml-auto" />}
      </div>
      <div className="px-3 py-2">
        {status === 'running' ? (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>执行中...</span>
          </div>
        ) : result ? (
          <div className="space-y-1">
            {result.type === 'video' && result.videoUrl ? (
              <video src={result.videoUrl} className="w-full h-20 object-cover rounded" controls />
            ) : result.type === 'image' && result.imageUrl ? (
              <img src={result.imageUrl} alt="" className="w-full h-20 object-cover rounded" />
            ) : (
              <p className="text-[10px] text-muted-foreground">已完成</p>
            )}
          </div>
        ) : status === 'error' ? (
          <p className="text-[10px] text-destructive">执行失败</p>
        ) : (
          <p className="text-[10px] text-muted-foreground">等待输出...</p>
        )}
      </div>
      <Handle type="target" position={Position.Left} className="!bg-pink-500 !w-2 !h-2" />
    </div>
  )
}

export default memo(OutputNode)
