import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { getBlob } from '../lib/storage'
import { loadPdf, renderPageToCanvas } from '../lib/pdf'
import { autoTiles, computeOverlapPixels, manualSnap } from '../lib/tiler'
import { pastel } from '../lib/colors'
import type { ManualTile } from '../types'

export default function CanvasView(){
  const projectId = useStore(s=>s.currentProjectId)
  const project = useStore(s=> projectId ? s.projects[projectId] : undefined)
  const updateProject = useStore(s=>s.updateProject)
  const [pageCanvas, setPageCanvas] = useState<HTMLCanvasElement | null>(null)
  // currently selected manual tile id; used for keyboard nudging/deleting
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)

  useEffect(()=>{
    let cancelled = false
    async function run(){
      if (!project?.pdfBlobKey) return
      const blob = await getBlob(project.pdfBlobKey)
      if (!blob) return
      const pdf = await loadPdf(blob)
      const page = await pdf.getPage(project.currentPage)
      const canvas = await renderPageToCanvas(page, project.pages[project.currentPage].params.dpi)
      if (!cancelled) setPageCanvas(canvas)
    }
    run()
    return ()=>{ cancelled = true }
  }, [project?.pdfBlobKey, project?.currentPage, project?.pages[project?.currentPage]?.params.dpi])

  useEffect(()=>{
    drawOverlay()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageCanvas, project?.mode, project?.currentPage, project?.pages[project?.currentPage], selectedTileId])

  // Listen for keyboard events to move/delete selected manual tiles
  useEffect(()=>{
    function handleKeyDown(e: KeyboardEvent){
      if (!project || project.mode !== 'manual') return
      const key = e.key

      // Allow quick deselect
      if (key === 'Escape'){
        setSelectedTileId(null)
        return
      }

      if (!selectedTileId) return
      if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Delete','Backspace'].includes(key)) return
      e.preventDefault()

      // Locate the tile to manipulate
      const pageState = project.pages[project.currentPage]
      const tileIndex = pageState.manualTiles.findIndex(t => t.id === selectedTileId)
      if (tileIndex === -1) return

      // Handle deletion: remove tile and clear selection
      if (key === 'Delete' || key === 'Backspace'){
        updateProject(project.id, p => {
          p.pages[p.currentPage].manualTiles.splice(tileIndex, 1)
        })
        setSelectedTileId(null)
        return
      }

      // Movement: compute new position based on arrow key and optional shift modifier
      const step = e.shiftKey ? 10 : 1
      const canvasW = pageCanvas?.width ?? 0
      const canvasH = pageCanvas?.height ?? 0
      const tile = pageState.manualTiles[tileIndex]
      let newX = tile.x
      let newY = tile.y
      if (key === 'ArrowUp') newY -= step
      if (key === 'ArrowDown') newY += step
      if (key === 'ArrowLeft') newX -= step
      if (key === 'ArrowRight') newX += step
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
  }, [project, selectedTileId, updateProject, pageCanvas])

  // --- UI helpers for Manual mode ---
  function deleteSelectedTile() {
    if (!project || project.mode !== 'manual' || !selectedTileId) return
    const pageTiles = project.pages[project.currentPage].manualTiles
    const idx = pageTiles.findIndex(t => t.id === selectedTileId)
    if (idx === -1) return
    updateProject(project.id, p => {
      p.pages[p.currentPage].manualTiles.splice(idx, 1)
    })
    setSelectedTileId(null)
  }

  function resetManualTilesPage() {
    if (!project || project.mode !== 'manual') return
    const ok = window.confirm('Clear all manual tiles on this page? This cannot be undone.')
    if (!ok) return
    updateProject(project.id, p => {
      p.pages[p.currentPage].manualTiles = []
    })
    setSelectedTileId(null)
  }

  function resetManualTilesAll() {
    if (!project) return
    const ok = window.confirm('Clear all manual tiles on ALL pages? This cannot be undone.')
    if (!ok) return
    updateProject(project.id, p => {
      for (let i = 1; i <= p.totalPages; i++){
        p.pages[i].manualTiles = []
      }
    })
    setSelectedTileId(null)
  }

  function drawOverlay(){
    if (!pageCanvas || !overlayRef.current || !project) return
    const page = project.pages[project.currentPage]
    const { tileSize, overlapUnits, overlapXPercent, overlapYPercent, overlapX, overlapY, marginPx, pastelAlpha } = page.params
    const { overlapX:ox, overlapY:oy } = computeOverlapPixels(tileSize, overlapUnits, overlapXPercent, overlapYPercent, overlapX, overlapY)

    const cvs = overlayRef.current
    cvs.width = pageCanvas.width
    cvs.height = pageCanvas.height
    const ctx = cvs.getContext('2d')!
    ctx.clearRect(0,0,cvs.width,cvs.height)

    if (project.mode === 'auto'){
      const tiles = autoTiles(pageCanvas.width, pageCanvas.height, tileSize, ox, oy, marginPx)
      tiles.forEach((t,i)=>{
        ctx.fillStyle = pastel(i, pastelAlpha)
        ctx.fillRect(t.x, t.y, t.w, t.h)
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'
        ctx.strokeRect(t.x+0.5, t.y+0.5, t.w-1, t.h-1)
      })
    } else {
      const tiles = page.manualTiles
      tiles.forEach((t)=>{
        // choose fill colour: masks use their own colour or a default red tint
        const fill = t.isMask ? (t.color ?? 'rgba(255,0,0,0.3)') : t.color
        ctx.fillStyle = fill
        ctx.fillRect(t.x, t.y, t.size, t.size)
        const isSelected = t.id === selectedTileId
        ctx.lineWidth = isSelected ? 2 : 1
        ctx.strokeStyle = isSelected ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)'
        ctx.strokeRect(t.x+0.5, t.y+0.5, t.size-1, t.size-1)
      })
    }
  }

  function onCanvasClick(e: React.MouseEvent){
    if (!project || project.mode !== 'manual' || !pageCanvas) return
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
    // convert to page pixel coords (remove preview zoom)
    const zoom = (project.pages[project.currentPage].previewZoom ?? 100) / 100
    const localX = (e.clientX - rect.left) / zoom
    const localY = (e.clientY - rect.top) / zoom
    const page = project.pages[project.currentPage]
    const { tileSize, snapToGrid } = page.params
    // Determine if click hits an existing tile (topmost first)
    const clickedTile = [...page.manualTiles].reverse().find(t => {
      return localX >= t.x && localX <= t.x + t.size && localY >= t.y && localY <= t.y + t.size
    })
    // If Alt pressed, create a mask tile regardless
    if (e.altKey){
      const pt = manualSnap(localX, localY, tileSize, snapToGrid)
      const x = Math.max(0, Math.min(pageCanvas.width - tileSize, pt.x))
      const y = Math.max(0, Math.min(pageCanvas.height - tileSize, pt.y))
      const maskTile: ManualTile = {
        id: crypto.randomUUID(),
        x,
        y,
        size: tileSize,
        color: 'rgba(255,0,0,0.3)',
        isMask: true
      }
      updateProject(project.id, p => {
        p.pages[p.currentPage].manualTiles.push(maskTile)
      })
      setSelectedTileId(maskTile.id)
      return
    }
    // If clicked existing tile, select it instead of creating a new one
    if (clickedTile){
      setSelectedTileId(clickedTile.id)
      return
    }
    // Otherwise create a new manual tile
    const pt = manualSnap(localX, localY, tileSize, snapToGrid)
    const tile: ManualTile = {
      id: crypto.randomUUID(),
      x: Math.max(0, Math.min(pageCanvas.width - tileSize, pt.x)),
      y: Math.max(0, Math.min(pageCanvas.height - tileSize, pt.y)),
      size: tileSize,
      color: pastel(page.manualTiles.filter(t=>!t.isMask).length, page.params.pastelAlpha)
    }
    updateProject(project.id, p => {
      p.pages[p.currentPage].manualTiles.push(tile)
    })
    setSelectedTileId(tile.id)
  }

  if (!project) return null

  const isManual = project.mode === 'manual'
  const hasSelection = Boolean(selectedTileId)

  return (
    <div className="flex-1 min-w-0 min-h-0 relative" ref={containerRef}>

      {/* floating mini-toolbar (visible only in Manual mode) */}
      {isManual && (
        <div className="absolute right-4 top-4 z-20 flex gap-2">
          <button
            className="px-3 py-1 rounded bg-rose-600 text-white disabled:opacity-50"
            onClick={deleteSelectedTile}
            disabled={!hasSelection}
            title="Delete selected tile">
            Delete Selected
          </button>
          <button
            className="px-3 py-1 rounded bg-amber-600 text-white"
            onClick={resetManualTilesPage}
            title="Clear all manual tiles on current page">
            Reset Page Tiles
          </button>
          <button
            className="px-3 py-1 rounded bg-amber-700 text-white"
            onClick={resetManualTilesAll}
            title="Clear all manual tiles on ALL pages">
            Reset All Tiles
          </button>
        </div>
      )}

      <div className="absolute inset-0 overflow-auto grid place-items-center p-4">
        {pageCanvas ? (
          // visually scale the preview; export DPI remains true to params.dpi
          <div
            className="relative"
            style={{
              width: pageCanvas.width,
              height: pageCanvas.height,
              transform: `scale(${(project?.pages[project.currentPage].previewZoom ?? 100)/100})`,
              transformOrigin: 'top left'
            }}>
            <img
              src={pageCanvas.toDataURL()}
              alt="page"
              className="block select-none pointer-events-none w-full h-full"
              draggable={false}
            />
            <canvas ref={overlayRef} className="absolute inset-0 w-full h-full" onClick={onCanvasClick}/>
          </div>
        ) : (
          <div className="opacity-60">Rendering…</div>
        )}
      </div>
    </div>
  )
}
