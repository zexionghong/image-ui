import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Type } from 'lucide-react'

function TextPromptNode({ data }: NodeProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm min-w-[180px]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50 rounded-t-xl">
        <Type className="h-3.5 w-3.5 text-blue-500" />
        <span className="text-xs font-medium">{data.label as string}</span>
      </div>
      <div className="px-3 py-2">
        <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">
          {(data.prompt as string) || '输入提示词...'}
        </p>
      </div>
      <Handle id="trigger" type="target" position={Position.Left} className="!bg-blue-500 !w-2 !h-2" />
      <Handle id="prompt" type="source" position={Position.Right} className="!bg-blue-500 !w-2 !h-2" />
    </div>
  )
}

export default memo(TextPromptNode)
