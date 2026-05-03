import { useRef, useCallback } from 'react'
import { useEditorStore } from '@/store/useEditorStore'

export function Canvas() {
  const { currentImage, zoom, pan, setPan, filters } = useEditorStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const isPanning = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const cssFilter = `
    brightness(${filters.brightness}%)
    contrast(${filters.contrast}%)
    saturate(${filters.saturation}%)
    blur(${filters.blur}px)
    hue-rotate(${filters.hue}deg)
    sepia(${filters.sepia}%)
    grayscale(${filters.grayscale}%)
    invert(${filters.invert}%)
  `.trim()

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning.current = true
      lastPos.current = { x: e.clientX, y: e.clientY }
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    setPan({ x: pan.x + dx, y: pan.y + dy })
    lastPos.current = { x: e.clientX, y: e.clientY }
  }, [pan, setPan])

  const handleMouseUp = useCallback(() => {
    isPanning.current = false
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    useEditorStore.getState().setZoom(zoom + delta)
  }, [zoom])

  if (!currentImage) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">No image loaded</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex h-full items-center justify-center overflow-hidden checkerboard bg-muted/30 cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <img
        src={currentImage}
        alt="Editing canvas"
        className="select-none pointer-events-none shadow-2xl"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          filter: cssFilter,
          transition: 'filter 0.15s ease',
        }}
        draggable={false}
      />
    </div>
  )
}
