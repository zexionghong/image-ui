import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Eye } from 'lucide-react'

function OutputNode({ data }: NodeProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm min-w-[180px]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50 rounded-t-xl">
        <Eye className="h-3.5 w-3.5 text-pink-500" />
        <span className="text-xs font-medium">{data.label as string}</span>
      </div>
      <div className="px-3 py-2">
        {data.resultUrl ? (
          <div className="space-y-1">
            {(data.resultUrl as string).endsWith('.mp4') ? (
              <video src={data.resultUrl as string} className="w-full h-20 object-cover rounded" />
            ) : (
              <img src={data.resultUrl as string} alt="" className="w-full h-20 object-cover rounded" />
            )}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">等待输出...</p>
        )}
      </div>
      <Handle type="target" position={Position.Left} className="!bg-pink-500 !w-2 !h-2" />
    </div>
  )
}

export default memo(OutputNode)
