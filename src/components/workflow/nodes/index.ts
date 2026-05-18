import { type NodeTypes } from '@xyflow/react'
import StartNode from './StartNode'
import TextPromptNode from './TextPromptNode'
import ImageInputNode from './ImageInputNode'
import ImageGenerateNode from './ImageGenerateNode'
import VideoGenerateNode from './VideoGenerateNode'
import ParameterNode from './ParameterNode'
import OutputNode from './OutputNode'

export const nodeTypes: NodeTypes = {
  start: StartNode,
  textPrompt: TextPromptNode,
  imageInput: ImageInputNode,
  imageGenerate: ImageGenerateNode,
  videoGenerate: VideoGenerateNode,
  parameter: ParameterNode,
  output: OutputNode,
}

export const NODE_PANEL_ITEMS = [
  { type: 'start', label: '开始', color: 'bg-emerald-500', icon: 'Play' },
  { type: 'textPrompt', label: '文本提示词', color: 'bg-blue-500', icon: 'Type' },
  { type: 'imageInput', label: '图片输入', color: 'bg-green-500', icon: 'ImagePlus' },
  { type: 'imageGenerate', label: '图片生成', color: 'bg-purple-500', icon: 'Wand2' },
  { type: 'videoGenerate', label: '视频生成', color: 'bg-orange-500', icon: 'Video' },
  { type: 'parameter', label: '参数配置', color: 'bg-cyan-500', icon: 'SlidersHorizontal' },
  { type: 'output', label: '输出预览', color: 'bg-pink-500', icon: 'Eye' },
]
