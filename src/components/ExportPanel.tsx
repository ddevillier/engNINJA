
import { useState } from 'react'
import { useStore } from '../store'
import { getBlob } from '../lib/storage'
import { loadPdf, renderPageToCanvas } from '../lib/pdf'
import { autoTiles, computeOverlapPixels } from '../lib/tiler'
import { zipPngs } from '../lib/zipper'

async function cropTile(pageCanvas: HTMLCanvasElement, x:number,y:number,w:number,h:number,tileSize:number): Promise<Blob> {
  const out = document.createElement('canvas')
  out.width = tileSize
  out.height = tileSize
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0,0,out.width,out.height)
  ctx.drawImage(pageCanvas, x, y, w, h, 0, 0, w, h)
  return await new Promise(resolve => out.toBlob(b=>resolve(b!), 'image/png'))
}

export default function ExportPanel(){
  const projectId = useStore(s=>s.currentProjectId)
  const project = useStore(s=> projectId ? s.projects[projectId] : undefined)
  const [busy, setBusy] = useState(false)

  if (!project) return null

  async function exportPage(pageNum: number){
    setBusy(true)
    try {
      if (!project.pdfBlobKey) return
      const blob = await getBlob(project.pdfBlobKey)
      if (!blob) return
      const pdf = await loadPdf(blob)
      const page = await pdf.getPage(pageNum)
      const pageState = project.pages[pageNum]
      const pageCanvas = await renderPageToCanvas(page, pageState.params.dpi)
      const { tileSize, overlapUnits, overlapXPercent, overlapYPercent, overlapX, overlapY, marginPx } = pageState.params
      const { overlapX:ox, overlapY:oy } = computeOverlapPixels(tileSize, overlapUnits, overlapXPercent, overlapYPercent, overlapX, overlapY)

      const files: {path:string, blob:Blob}[] = []
      // Build a manifest describing the exported tiles for this page
      const manifest: any = { page: pageNum, mode: project.mode, params: pageState.params, tiles: [] as any[], masks: [] as any[] }

      if (project.mode === 'auto'){
        const tiles = autoTiles(pageCanvas.width, pageCanvas.height, tileSize, ox, oy, marginPx)
        let i = 0
        for (const t of tiles){
          const b = await cropTile(pageCanvas, t.x, t.y, t.w, t.h, tileSize)
          const filename = `page-${pageNum}/auto/tile-${i}-${t.x}x${t.y}.png`
          files.push({ path: filename, blob: b })
          manifest.tiles.push({ index: i, x: t.x, y: t.y, w: t.w, h: t.h, filename })
          i++
        }
      } else {
        let i = 0
        for (const t of pageState.manualTiles){
          // Skip masks from export but include them in manifest
          if (t.isMask){
            manifest.masks.push({ id: t.id, x: t.x, y: t.y, size: t.size })
            continue
          }
          const b = await cropTile(pageCanvas, t.x, t.y, t.size, t.size, t.size)
          const filename = `page-${pageNum}/manual/tile-${i}-${t.x}x${t.y}.png`
          files.push({ path: filename, blob: b })
          manifest.tiles.push({ id: t.id, x: t.x, y: t.y, size: t.size, filename })
          i++
        }
      }
      // append manifest json into files
      const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' })
      files.push({ path: `page-${pageNum}/manifest.json`, blob: manifestBlob })
      await zipPngs(files, `engninja-tiles-page-${pageNum}.zip`)
    } finally {
      setBusy(false)
    }
  }

  async function exportAll(){
    setBusy(true)
    try {
      if (!project.pdfBlobKey) return
      const blob = await getBlob(project.pdfBlobKey)
      if (!blob) return
      const pdf = await loadPdf(blob)

      const files: {path:string, blob:Blob}[] = []
      const manifest: any = { pages: [] as any[] }

      for (let pageNum=1; pageNum<=project.totalPages; pageNum++){
        const page = await pdf.getPage(pageNum)
        const pageState = project.pages[pageNum]
        const pageCanvas = await renderPageToCanvas(page, pageState.params.dpi)
        const { tileSize, overlapUnits, overlapXPercent, overlapYPercent, overlapX, overlapY, marginPx } = pageState.params
        const { overlapX:ox, overlapY:oy } = computeOverlapPixels(tileSize, overlapUnits, overlapXPercent, overlapYPercent, overlapX, overlapY)

        const pageEntry: any = { page: pageNum, mode: project.mode, params: pageState.params, tiles: [] as any[], masks: [] as any[] }
        if (project.mode === 'auto'){
          const tiles = autoTiles(pageCanvas.width, pageCanvas.height, tileSize, ox, oy, marginPx)
          let i = 0
          for (const t of tiles){
            const b = await cropTile(pageCanvas, t.x, t.y, t.w, t.h, tileSize)
            const filename = `page-${pageNum}/auto/tile-${i}-${t.x}x${t.y}.png`
            files.push({ path: filename, blob: b })
            pageEntry.tiles.push({ index: i, x: t.x, y: t.y, w: t.w, h: t.h, filename })
            i++
          }
        } else {
          let i = 0
          for (const t of pageState.manualTiles){
            if (t.isMask){
              pageEntry.masks.push({ id: t.id, x: t.x, y: t.y, size: t.size })
              continue
            }
            const b = await cropTile(pageCanvas, t.x, t.y, t.size, t.size, t.size)
            const filename = `page-${pageNum}/manual/tile-${i}-${t.x}x${t.y}.png`
            files.push({ path: filename, blob: b })
            pageEntry.tiles.push({ id: t.id, x: t.x, y: t.y, size: t.size, filename })
            i++
          }
        }
        // push per-page manifest entry
        manifest.pages.push(pageEntry)
      }
      // append global manifest file
      const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' })
      files.push({ path: `manifest.json`, blob: manifestBlob })
      await zipPngs(files, `engninja-tiles-all-pages.zip`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-3 border-t border-zinc-800 bg-zinc-900/40 flex items-center gap-3">
      <button disabled={busy} onClick={()=>exportPage(project.currentPage)} className="px-3 py-2 rounded bg-emerald-600 disabled:opacity-50">
        Export Current Page
      </button>
      <button disabled={busy} onClick={exportAll} className="px-3 py-2 rounded bg-emerald-700 disabled:opacity-50">
        Export All Pages
      </button>
      {busy && <span className="text-sm opacity-70">Exporting…</span>}
    </div>
  )
}
