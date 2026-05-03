import { useCallback, useRef } from 'react'
import { ReactFlow, Background, Controls, MiniMap, Panel } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Play, Trash2, Save, Upload, Type, ImagePlus, Wand2, Video, SlidersHorizontal, Eye } from 'lucide-react'
import { useWorkflowStore } from '@/store/useWorkflowStore'
import { useApiConfigStore } from '@/store/useApiConfigStore'
import { nodeTypes, NODE_PANEL_ITEMS } from './nodes'
import { PropertyPanel } from './PropertyPanel'
import { useTranslations } from '@/i18n/compat/client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Type, ImagePlus, Wand2, Video, SlidersHorizontal, Eye,
}

export function WorkflowPage() {
  const t = useTranslations('workflow')
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode, selectedNodeId, executing, setExecuting, setExecutionResults, clearWorkflow } = useWorkflowStore()
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const rfInstance = useRef<any>(null)

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData('application/reactflow')
      if (!type || !rfInstance.current) return

      const position = rfInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      addNode(type, position)
    },
    [addNode]
  )

  const onNodeDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  const handleRun = async () => {
    const { isVideoConfigured, isConfigured } = useApiConfigStore.getState()
    if (!isConfigured() && !isVideoConfigured()) {
      toast.error(t('apiNotConfigured'))
      return
    }
    if (nodes.length === 0) {
      toast.error(t('noNodes'))
      return
    }

    setExecuting(true)
    try {
      const res = await fetch('/api/workflow/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: nodes.map((n) => ({ id: n.id, type: n.type, data: n.data })),
          edges: edges.map((e) => ({ source: e.source, target: e.target })),
          config: {
            baseUrl: useApiConfigStore.getState().baseUrl,
            apiKey: useApiConfigStore.getState().apiKey,
            model: useApiConfigStore.getState().model,
            videoBaseUrl: useApiConfigStore.getState().videoBaseUrl,
            videoApiKey: useApiConfigStore.getState().videoApiKey,
            videoModel: useApiConfigStore.getState().videoModel,
          },
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setExecutionResults(data.results || {})
      toast.success(t('executionComplete'))
    } catch (err: any) {
      toast.error(err.message || t('executionFailed'))
    } finally {
      setExecuting(false)
    }
  }

  const handleSave = () => {
    const flow = { nodes, edges }
    localStorage.setItem('workflow-save', JSON.stringify(flow))
    toast.success(t('saved'))
  }

  const handleLoad = () => {
    const saved = localStorage.getItem('workflow-save')
    if (saved) {
      const flow = JSON.parse(saved)
      useWorkflowStore.getState().setNodes(flow.nodes)
      useWorkflowStore.getState().setEdges(flow.edges)
      toast.success(t('loaded'))
    } else {
      toast.error(t('noSavedWorkflow'))
    }
  }

  return (
    <div className="flex h-full">
      {/* Node panel */}
      <div className="w-[200px] border-r border-border/50 p-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground mb-3">{t('nodePanel')}</p>
        {NODE_PANEL_ITEMS.map((item) => {
          const Icon = ICONS[item.icon] || Type
          return (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => onNodeDragStart(e, item.type)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card cursor-grab hover:border-primary/50 transition-colors text-xs"
            >
              <div className={`w-2 h-2 rounded-full ${item.color}`} />
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{item.label}</span>
            </div>
          )
        })}
      </div>

      {/* Canvas */}
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={(instance) => { rfInstance.current = instance }}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
          className="bg-muted/20"
        >
          <Background />
          <Controls />
          <MiniMap
            nodeStrokeWidth={3}
            className="!bg-card !border-border"
          />

          {/* Toolbar */}
          <Panel position="top-center">
            <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5 shadow-sm">
              <Button size="sm" variant="gradient" onClick={handleRun} disabled={executing}>
                <Play className="h-3.5 w-3.5 mr-1" />
                {executing ? t('running') : t('run')}
              </Button>
              <Button size="sm" variant="outline" onClick={handleSave}>
                <Save className="h-3.5 w-3.5 mr-1" />
                {t('save')}
              </Button>
              <Button size="sm" variant="outline" onClick={handleLoad}>
                <Upload className="h-3.5 w-3.5 mr-1" />
                {t('load')}
              </Button>
              <Button size="sm" variant="outline" onClick={clearWorkflow}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                {t('clear')}
              </Button>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Property panel */}
      {selectedNodeId && <PropertyPanel />}
    </div>
  )
}
