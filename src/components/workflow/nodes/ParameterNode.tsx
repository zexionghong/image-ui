import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { SlidersHorizontal } from 'lucide-react'

function ParameterNode({ data }: NodeProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm min-w-[160px]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50 rounded-t-xl">
        <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-500" />
        <span className="text-xs font-medium">{data.label as string}</span>
      </div>
      <div className="px-3 py-2 space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">参数</span>
          <span>{data.paramName as string}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground">值</span>
          <span>{data.paramValue as string}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-cyan-500 !w-2 !h-2" />
    </div>
  )
}

export default memo(ParameterNode)
