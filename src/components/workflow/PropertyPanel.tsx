import { useWorkflowStore, type NodeData } from '@/store/useWorkflowStore'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

export function PropertyPanel() {
  const { nodes, selectedNodeId, setSelectedNodeId, updateNodeData } = useWorkflowStore()
  const node = nodes.find((n) => n.id === selectedNodeId)

  if (!node) return null

  const data = node.data
  const update = (key: string, value: unknown) => updateNodeData(node.id, { [key]: value })

  return (
    <div className="w-[260px] border-l border-border/50 p-4 space-y-4 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{data.label as string}</h3>
        <Button variant="ghost" size="icon-sm" onClick={() => setSelectedNodeId(null)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Label */}
      <div className="space-y-1.5">
        <Label className="text-xs">名称</Label>
        <Input value={data.label as string} onChange={(e) => update('label', e.target.value)} className="h-8 text-xs" />
      </div>

      {/* Node-specific fields */}
      {node.type === 'textPrompt' && (
        <div className="space-y-1.5">
          <Label className="text-xs">提示词</Label>
          <Textarea
            value={(data.prompt as string) || ''}
            onChange={(e) => update('prompt', e.target.value)}
            placeholder="输入提示词..."
            className="min-h-[100px] text-xs resize-none"
          />
        </div>
      )}

      {node.type === 'imageGenerate' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">模型</Label>
            <Input value={data.model as string} onChange={(e) => update('model', e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">尺寸</Label>
            <Select value={data.size as string} onValueChange={(v) => update('size', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1024x1024">1024x1024</SelectItem>
                <SelectItem value="1536x1024">1536x1024</SelectItem>
                <SelectItem value="1024x1536">1024x1536</SelectItem>
                <SelectItem value="auto">auto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">质量</Label>
            <Select value={data.quality as string} onValueChange={(v) => update('quality', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">auto</SelectItem>
                <SelectItem value="low">low</SelectItem>
                <SelectItem value="medium">medium</SelectItem>
                <SelectItem value="high">high</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {node.type === 'videoGenerate' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">模型</Label>
            <Input value={data.model as string} onChange={(e) => update('model', e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">时长</Label>
            <Select value={data.duration as string} onValueChange={(v) => update('duration', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5s</SelectItem>
                <SelectItem value="10">10s</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">分辨率</Label>
            <Select value={data.resolution as string} onValueChange={(v) => update('resolution', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="480p">480p</SelectItem>
                <SelectItem value="720p">720p</SelectItem>
                <SelectItem value="1080p">1080p</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">比例</Label>
            <Select value={data.aspectRatio as string} onValueChange={(v) => update('aspectRatio', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9</SelectItem>
                <SelectItem value="9:16">9:16</SelectItem>
                <SelectItem value="1:1">1:1</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {node.type === 'parameter' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">参数名</Label>
            <Input value={data.paramName as string} onChange={(e) => update('paramName', e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">参数值</Label>
            <Input value={data.paramValue as string} onChange={(e) => update('paramValue', e.target.value)} className="h-8 text-xs" />
          </div>
        </>
      )}
    </div>
  )
}
