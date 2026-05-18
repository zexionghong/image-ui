import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Play } from 'lucide-react'

function StartNode({ data }: NodeProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm min-w-[140px]">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50">
        <Play className="h-3.5 w-3.5 text-emerald-500" />
        <span className="text-xs font-medium">{data.label as string}</span>
      </div>
      <Handle id="next" type="source" position={Position.Right} className="!bg-emerald-500 !w-2 !h-2" />
    </div>
  )
}

export default memo(StartNode)
