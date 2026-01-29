import { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from '../store'
import { getBlob } from '../lib/storage'
import { loadPdf, renderPage } from '../lib/pdf'
import { autoTiles, computeOverlapPixels, manualSnap, computeSlices } from '../lib/tiler'
import { pastel } from '../lib/colors'
import type { ManualTile, Scooter } from '../types'
import {
  PDF_POINTS_PER_INCH,
  MAX_RENDER_ZOOM,
  MIN_PREVIEW_ZOOM,
  MAX_PREVIEW_ZOOM,
  DRAG_THRESHOLD_PX,
  SCOOTER_HIT_THRESHOLD_PX,
  SCOOTER_HANDLE_OFFSET,
  NUDGE_SMALL_STEP,
  NUDGE_LARGE_STEP,
  DEFAULT_PREVIEW_ZOOM
} from '../lib/constants'

export default function CanvasView() {
  const projectId = useStore(s => s.currentProjectId)
  const project = useStore(s => projectId ? s.projects[projectId] : undefined)
  const updateProject = useStore(s => s.updateProject)

  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)

  const [isRendered, setIsRendered] = useState(false)
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null)
  const [selectedScooterId, setSelectedScooterId] = useState<string | null>(null)

  // Visual state (refs for performance)
  const transform = useRef({ x: 0, y: 0, scale: 1 })
  const isDragging = useRef(false)
  const hasMoved = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const draggingScooterId = useRef<string | null>(null)

  // Debounce ref
  const debounceTimer = useRef<number>(0)

  // Initialize transform from store
  useEffect(() => {
    if (!project) return
    const page = project.pages[project.currentPage]
    const scale = (page.previewZoom ?? DEFAULT_PREVIEW_ZOOM) / 100
    const x = page.panX ?? 0
    const y = page.panY ?? 0

    // Only update if we are not dragging
    if (!isDragging.current) {
      transform.current = { x, y, scale }
      applyTransform()
    }
  }, [project?.pages[project?.currentPage]?.previewZoom, project?.pages[project?.currentPage]?.panX, project?.pages[project?.currentPage]?.panY])

  // Load and Render PDF
  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!project?.pdfBlobKey || !canvasRef.current) return
      const blob = await getBlob(project.pdfBlobKey)
      if (!blob) return
      const pdf = await loadPdf(blob)
      const page = await pdf.getPage(project.currentPage)

      const zoom = (project.pages[project.currentPage].previewZoom ?? DEFAULT_PREVIEW_ZOOM) / 100
      const dpi = project.pages[project.currentPage].params.dpi

      if (cancelled) return

      const logicalScale = dpi / PDF_POINTS_PER_INCH
      const logicalViewport = page.getViewport({ scale: logicalScale })

      // High-res render (limit max zoom to avoid huge canvases)
      const renderZoom = Math.min(zoom, MAX_RENDER_ZOOM)
      const renderDpi = dpi * renderZoom

      await renderPage(page, canvasRef.current, renderDpi)

      if (cancelled) return

      // Apply style to match logical size
      if (canvasRef.current) {
        canvasRef.current.style.width = `${logicalViewport.width}px`
        canvasRef.current.style.height = `${logicalViewport.height}px`
      }

      setIsRendered(true)
    }
    run()
    return () => { cancelled = true }
  }, [project?.pdfBlobKey, project?.currentPage, project?.pages[project?.currentPage]?.params.dpi, project?.pages[project?.currentPage]?.previewZoom])

  // Apply transform to DOM
  function applyTransform() {
    if (!contentRef.current) return
    const { x, y, scale } = transform.current
    contentRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
    contentRef.current.style.transformOrigin = '0 0'
  }

  // Sync to store (debounced)
  const syncToStore = useCallback(() => {
    if (!project) return
    window.clearTimeout(debounceTimer.current)
    debounceTimer.current = window.setTimeout(() => {
      updateProject(project.id, p => {
        const pg = p.pages[p.currentPage]
        pg.previewZoom = Math.round(transform.current.scale * 100)
        pg.panX = Math.round(transform.current.x)
        pg.panY = Math.round(transform.current.y)
      })
    }, 300)
  }, [project, updateProject])

  // Event Handlers
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = contentRef.current?.getBoundingClientRect()
    if (!rect) return

    const oldScale = transform.current.scale
    // Sensitivity
    const delta = -e.deltaY * 0.001
    const newScale = Math.max(MIN_PREVIEW_ZOOM / 100, Math.min(MAX_RENDER_ZOOM, oldScale * (1 + delta)))

    const containerRect = containerRef.current!.getBoundingClientRect()
    const mx = e.clientX - containerRect.left
    const my = e.clientY - containerRect.top

    // P_logical = (P_mouse - translate) / scale
    const lx = (mx - transform.current.x) / transform.current.scale
    const ly = (my - transform.current.y) / transform.current.scale

    const newX = mx - lx * newScale
    const newY = my - ly * newScale

    transform.current = { x: newX, y: newY, scale: newScale }
    applyTransform()
    syncToStore()
  }, [syncToStore])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Check for scooter hit if in slicing manual mode
    if (project?.mode === 'slicing' && project.pages[project.currentPage].slicing.method === 'manual' && contentRef.current) {
      const rect = contentRef.current.getBoundingClientRect()
      const scale = transform.current.scale
      const localX = (e.clientX - rect.left) / scale
      const localY = (e.clientY - rect.top) / scale

      const page = project.pages[project.currentPage]
      const { direction, scooters } = page.slicing
      const hitThreshold = SCOOTER_HIT_THRESHOLD_PX / scale

      const hitScooter = scooters.find(s => {
        if (direction === 'horizontal') {
          return Math.abs(s.pos - localY) < hitThreshold
        } else {
          return Math.abs(s.pos - localX) < hitThreshold
        }
      })

      if (hitScooter) {
        draggingScooterId.current = hitScooter.id
        setSelectedScooterId(hitScooter.id)
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
    }

    // Allow panning with left click
    if (e.button === 0 || e.button === 1) {
      isDragging.current = true
      hasMoved.current = false
      lastPos.current = { x: e.clientX, y: e.clientY }
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }, [project])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (draggingScooterId.current && project && canvasRef.current) {
      e.preventDefault()
      const rect = contentRef.current!.getBoundingClientRect()
      const scale = transform.current.scale
      const localX = (e.clientX - rect.left) / scale
      const localY = (e.clientY - rect.top) / scale

      // Logical dimensions
      const zoom = (project.pages[project.currentPage].previewZoom ?? DEFAULT_PREVIEW_ZOOM) / 100
      const renderZoom = Math.min(zoom, MAX_RENDER_ZOOM)
      const logicalW = canvasRef.current.width / renderZoom
      const logicalH = canvasRef.current.height / renderZoom
      const margin = project.pages[project.currentPage].params.marginPx

      const usableW = Math.max(0, logicalW - margin * 2)
      const usableH = Math.max(0, logicalH - margin * 2)

      updateProject(project.id, p => {
        const s = p.pages[p.currentPage].slicing.scooters.find(s => s.id === draggingScooterId.current)
        if (!s) return
        if (p.pages[p.currentPage].slicing.direction === 'horizontal') {
          s.pos = Math.max(0, Math.min(usableH, localY - margin))
        } else {
          s.pos = Math.max(0, Math.min(usableW, localX - margin))
        }
      })
      return
    }

    if (!isDragging.current) return
    e.preventDefault()

    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y

    if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) hasMoved.current = true

    lastPos.current = { x: e.clientX, y: e.clientY }

    transform.current.x += dx
    transform.current.y += dy
    applyTransform()
    syncToStore()
  }, [syncToStore, project, updateProject])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    isDragging.current = false
    draggingScooterId.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }, [])

  // Overlay
  useEffect(() => {
    drawOverlay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRendered, project?.mode, project?.currentPage, project?.pages[project?.currentPage], selectedTileId, selectedScooterId])

  function drawOverlay() {
    if (!canvasRef.current || !overlayRef.current || !project) return
    const page = project.pages[project.currentPage]
    const { tileSize, overlapUnits, overlapXPercent, overlapYPercent, overlapX, overlapY, marginPx, pastelAlpha } = page.params

    const cvs = overlayRef.current
    const baseCvs = canvasRef.current

    if (cvs.width !== baseCvs.width || cvs.height !== baseCvs.height) {
      cvs.width = baseCvs.width
      cvs.height = baseCvs.height
    }

    const ctx = cvs.getContext('2d')!
    ctx.clearRect(0, 0, cvs.width, cvs.height)

    const zoom = (project.pages[project.currentPage].previewZoom ?? DEFAULT_PREVIEW_ZOOM) / 100
    const renderZoom = Math.min(zoom, MAX_RENDER_ZOOM)

    ctx.save()
    ctx.scale(renderZoom, renderZoom)

    // Common logical dimensions
    const logicalW = baseCvs.width / renderZoom
    const logicalH = baseCvs.height / renderZoom

    if (project.mode === 'auto') {
      const { overlapX: ox, overlapY: oy } = computeOverlapPixels(tileSize, overlapUnits, overlapXPercent, overlapYPercent, overlapX, overlapY)
      const tiles = autoTiles(logicalW, logicalH, tileSize, ox, oy, marginPx)
      tiles.forEach((t, i) => {
        ctx.fillStyle = pastel(i, pastelAlpha)
        ctx.fillRect(t.x, t.y, t.w, t.h)
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'
        ctx.strokeRect(t.x + 0.5, t.y + 0.5, t.w - 1, t.h - 1)
      })
    } else if (project.mode === 'manual') {
      const tiles = page.manualTiles || []
      tiles.forEach((t) => {
        const fill = t.isMask ? (t.color ?? 'rgba(255,0,0,0.3)') : t.color
        ctx.fillStyle = fill
        ctx.fillRect(t.x, t.y, t.size, t.size)
        const isSelected = t.id === selectedTileId
        ctx.lineWidth = isSelected ? 2 : 1
        ctx.strokeStyle = isSelected ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)'
        ctx.strokeRect(t.x + 0.5, t.y + 0.5, t.size - 1, t.size - 1)
      })
    } else if (project.mode === 'slicing') {
      // Only draw slice overlay if NOT manual
      if (page.slicing && page.slicing.method !== 'manual') {
        const tiles = computeSlices(logicalW, logicalH, page.slicing, marginPx)
        tiles.forEach((t, i) => {
          ctx.fillStyle = pastel(i, pastelAlpha)
          ctx.fillRect(t.x, t.y, t.w, t.h)
          ctx.strokeStyle = 'rgba(255,255,255,0.25)'
          ctx.strokeRect(t.x + 0.5, t.y + 0.5, t.w - 1, t.h - 1)
        })
      }

      // Draw Scooters if manual
      if (page.slicing && page.slicing.method === 'manual') {
        const { direction, scooters } = page.slicing
        ctx.lineWidth = 2
        scooters.forEach(s => {
          const isSelected = s.id === selectedScooterId
          ctx.strokeStyle = isSelected ? '#10b981' : '#f43f5e' // Emerald if selected, Rose if not
          ctx.beginPath()
          if (direction === 'horizontal') {
            const y = marginPx + s.pos
            ctx.moveTo(marginPx, y)
            ctx.lineTo(logicalW - marginPx, y)
          } else {
            const x = marginPx + s.pos
            ctx.moveTo(x, marginPx)
            ctx.lineTo(x, logicalH - marginPx)
          }
          ctx.stroke()

          // Draw handle
          ctx.fillStyle = isSelected ? '#10b981' : '#f43f5e'
          if (direction === 'horizontal') {
            const y = marginPx + s.pos
            ctx.beginPath()
            ctx.arc(marginPx - SCOOTER_HANDLE_OFFSET, y, 6, 0, Math.PI * 2)
            ctx.fill()
          } else {
            const x = marginPx + s.pos
            ctx.beginPath()
            ctx.arc(x, marginPx - SCOOTER_HANDLE_OFFSET, 6, 0, Math.PI * 2)
            ctx.fill()
          }
        })
      }
    }
    ctx.restore()
  }

  function onCanvasClick(e: React.MouseEvent) {
    if (hasMoved.current) return // Ignore if dragged
    if (!project || !canvasRef.current || !contentRef.current) return

    const rect = contentRef.current.getBoundingClientRect()
    const scale = transform.current.scale
    const localX = (e.clientX - rect.left) / scale
    const localY = (e.clientY - rect.top) / scale

    // Logical dimensions
    const zoom = (project.pages[project.currentPage].previewZoom ?? DEFAULT_PREVIEW_ZOOM) / 100
    const renderZoom = Math.min(zoom, MAX_RENDER_ZOOM)
    const logicalW = canvasRef.current.width / renderZoom
    const logicalH = canvasRef.current.height / renderZoom
    const margin = project.pages[project.currentPage].params.marginPx

    if (project.mode === 'slicing' && project.pages[project.currentPage].slicing.method === 'manual') {
      // Add scooter
      // Check if we are inside usable area
      const usableW = logicalW - margin * 2
      const usableH = logicalH - margin * 2

      if (localX < margin || localX > logicalW - margin || localY < margin || localY > logicalH - margin) return

      const { direction } = project.pages[project.currentPage].slicing
      const pos = direction === 'horizontal' ? localY - margin : localX - margin

      const scooter: Scooter = {
        id: crypto.randomUUID(),
        pos
      }

      updateProject(project.id, p => {
        p.pages[p.currentPage].slicing.scooters.push(scooter)
      })
      setSelectedScooterId(scooter.id)
      return
    }

    if (project.mode !== 'manual') return

    const page = project.pages[project.currentPage]
    const { tileSize, snapToGrid } = page.params

    // Determine if click hits an existing tile (topmost first)
    const clickedTile = [...(page.manualTiles || [])].reverse().find(t => {
      return localX >= t.x && localX <= t.x + t.size && localY >= t.y && localY <= t.y + t.size
    })

    if (e.altKey) {
      const pt = manualSnap(localX, localY, tileSize, snapToGrid)
      const x = Math.max(0, Math.min(logicalW - tileSize, pt.x))
      const y = Math.max(0, Math.min(logicalH - tileSize, pt.y))
      const maskTile: ManualTile = {
        id: crypto.randomUUID(),
        x, y, size: tileSize,
        color: 'rgba(255,0,0,0.3)',
        isMask: true
      }
      updateProject(project.id, p => {
        p.pages[p.currentPage].manualTiles.push(maskTile)
      })
      setSelectedTileId(maskTile.id)
      return
    }

    if (clickedTile) {
      setSelectedTileId(clickedTile.id)
      return
    }

    const pt = manualSnap(localX, localY, tileSize, snapToGrid)
    const tile: ManualTile = {
      id: crypto.randomUUID(),
      x: Math.max(0, Math.min(logicalW - tileSize, pt.x)),
      y: Math.max(0, Math.min(logicalH - tileSize, pt.y)),
      size: tileSize,
      color: pastel((page.manualTiles || []).filter(t => !t.isMask).length, page.params.pastelAlpha)
    }
    updateProject(project.id, p => {
      p.pages[p.currentPage].manualTiles.push(tile)
    })
    setSelectedTileId(tile.id)
  }

  // Keyboard listeners (same as before)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!project) return
      const key = e.key.toLowerCase()

      // Mode switching shortcuts (if not typing in an input)
      if ((e.target as HTMLElement).tagName !== 'INPUT') {
        if (key === 's') {
          updateProject(project.id, p => { p.mode = 'slicing' })
          return
        }
        if (key === 'a') {
          updateProject(project.id, p => { p.mode = 'auto' })
          return
        }
        if (key === 'm') {
          updateProject(project.id, p => { p.mode = 'manual' })
          return
        }
      }

      if (project.mode === 'slicing') {
        if (key === 'delete' || key === 'backspace') {
          if (selectedScooterId) {
            updateProject(project.id, p => {
              const idx = p.pages[p.currentPage].slicing.scooters.findIndex(s => s.id === selectedScooterId)
              if (idx !== -1) p.pages[p.currentPage].slicing.scooters.splice(idx, 1)
            })
            setSelectedScooterId(null)
          }
        }
        return
      }

      if (project.mode !== 'manual') return
      if (key === 'escape') {
        setSelectedTileId(null)
        return
      }
      if (!selectedTileId) return
      if (!['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'delete', 'backspace'].includes(key)) return
      e.preventDefault()

      const pageState = project.pages[project.currentPage]
      const tileIndex = (pageState.manualTiles || []).findIndex(t => t.id === selectedTileId)
      if (tileIndex === -1) return

      if (key === 'delete' || key === 'backspace') {
        updateProject(project.id, p => {
          p.pages[p.currentPage].manualTiles.splice(tileIndex, 1)
        })
        setSelectedTileId(null)
        return
      }

      const step = e.shiftKey ? NUDGE_LARGE_STEP : NUDGE_SMALL_STEP
      // We need logical dimensions
      if (!canvasRef.current) return
      const zoom = (project.pages[project.currentPage].previewZoom ?? DEFAULT_PREVIEW_ZOOM) / 100
      const renderZoom = Math.min(zoom, MAX_RENDER_ZOOM)
      const canvasW = canvasRef.current.width / renderZoom
      const canvasH = canvasRef.current.height / renderZoom

      const tile = pageState.manualTiles[tileIndex]
      let newX = tile.x
      let newY = tile.y
      if (key === 'arrowup') newY -= step
      if (key === 'arrowdown') newY += step
      if (key === 'arrowleft') newX -= step
      if (key === 'arrowright') newX += step
      newX = Math.max(0, Math.min(canvasW - tile.size, newX))
      newY = Math.max(0, Math.min(canvasH - tile.size, newY))
      updateProject(project.id, p => {
        const t = p.pages[p.currentPage].manualTiles.find(t => t.id === selectedTileId)
        if (!t) return
        t.x = newX
        t.y = newY
      })
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [project, selectedTileId, selectedScooterId, updateProject])

  // UI helpers (same as before)
  function deleteSelectedTile() {
    if (!project || project.mode !== 'manual' || !selectedTileId) return
    const idx = (project.pages[project.currentPage].manualTiles || []).findIndex(t => t.id === selectedTileId)
    if (idx === -1) return
    updateProject(project.id, p => {
      p.pages[p.currentPage].manualTiles.splice(idx, 1)
    })
    setSelectedTileId(null)
  }

  function resetManualTilesPage() {
    if (!project || project.mode !== 'manual') return
    if (!window.confirm('Clear all manual tiles on this page?')) return
    updateProject(project.id, p => {
      p.pages[p.currentPage].manualTiles = []
    })
    setSelectedTileId(null)
  }

  function resetManualTilesAll() {
    if (!project) return
    if (!window.confirm('Clear all manual tiles on ALL pages?')) return
    updateProject(project.id, p => {
      for (let i = 1; i <= p.totalPages; i++) p.pages[i].manualTiles = []
    })
    setSelectedTileId(null)
  }

  function resetScooters() {
    if (!project || project.mode !== 'slicing') return
    updateProject(project.id, p => {
      p.pages[p.currentPage].slicing.scooters = []
    })
    setSelectedScooterId(null)
  }

  if (!project) return null
  const isManual = project.mode === 'manual'
  const isSlicingManual = project.mode === 'slicing' && project.pages[project.currentPage].slicing?.method === 'manual'
  const hasSelection = Boolean(selectedTileId)
  const hasScooterSelection = Boolean(selectedScooterId)

  return (
    <div className="flex-1 min-w-0 min-h-0 relative overflow-hidden bg-zinc-900" ref={containerRef}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onClick={onCanvasClick}
      style={{ touchAction: 'none' }}>

      {/* Floating toolbar */}
      {isManual && (
        <div className="absolute right-4 top-4 z-20 flex gap-2" onPointerDown={e => e.stopPropagation()}>
          <button className="px-3 py-1 rounded bg-rose-600 text-white disabled:opacity-50"
            onClick={deleteSelectedTile} disabled={!hasSelection}>Delete Selected</button>
          <button className="px-3 py-1 rounded bg-amber-600 text-white"
            onClick={resetManualTilesPage}>Reset Page</button>
          <button className="px-3 py-1 rounded bg-amber-700 text-white"
            onClick={resetManualTilesAll}>Reset All</button>
        </div>
      )}

      {isSlicingManual && (
        <div className="absolute right-4 top-4 z-20 flex gap-2" onPointerDown={e => e.stopPropagation()}>
          <button className="px-3 py-1 rounded bg-rose-600 text-white disabled:opacity-50"
            onClick={() => {
              if (selectedScooterId) {
                updateProject(project.id, p => {
                  const idx = p.pages[p.currentPage].slicing.scooters.findIndex(s => s.id === selectedScooterId)
                  if (idx !== -1) p.pages[p.currentPage].slicing.scooters.splice(idx, 1)
                })
                setSelectedScooterId(null)
              }
            }} disabled={!hasScooterSelection}>Delete Scooter</button>
          <button className="px-3 py-1 rounded bg-amber-600 text-white"
            onClick={resetScooters}>Reset Scooters</button>
        </div>
      )}

      <div ref={contentRef} className="absolute top-0 left-0 origin-top-left">
        <canvas ref={canvasRef} className="block pointer-events-none" />
        <canvas ref={overlayRef} className="absolute inset-0 w-full h-full cursor-crosshair" />
      </div>

      {!isRendered && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-white opacity-50">Rendering...</div>
        </div>
      )}
    </div>
  )
}
