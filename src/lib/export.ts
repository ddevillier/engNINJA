import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import type { Project, PageState } from '../types'
import { autoTiles, computeOverlapPixels, computeSlices } from './tiler'
import { renderPageToCanvas } from './pdf'
import { getPageNameMap, type PageNameInfo } from './pageNames'

export type ExportTile = {
  index?: number
  id?: string
  x: number
  y: number
  w: number
  h: number
  filename: string
}

export type ExportMask = {
  id: string
  x: number
  y: number
  size: number
}

export type PageExportResult = {
  files: { path: string; blob: Blob }[]
  manifest: {
    page: number
    pageName?: string
    pageLabel?: string
    bookmarkPath?: string[]
    mode: string
    params: Record<string, any>
    tiles: ExportTile[]
    masks: ExportMask[]
  }
}

async function cropTile(
  pageCanvas: HTMLCanvasElement, 
  x: number, 
  y: number, 
  w: number, 
  h: number, 
  tileSize: number
): Promise<Blob> {
  const out = document.createElement('canvas')
  out.width = tileSize
  out.height = tileSize
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, out.width, out.height)
  ctx.drawImage(pageCanvas, x, y, w, h, 0, 0, w, h)
  return await new Promise(resolve => out.toBlob(b => resolve(b!), 'image/png'))
}

export async function exportPage(
  pdf: PDFDocumentProxy,
  project: Project,
  pageNum: number,
  naming: PageNameInfo
): Promise<PageExportResult> {
  const page = await pdf.getPage(pageNum)
  const pageState = project.pages[pageNum]
  const pageCanvas = await renderPageToCanvas(page, pageState.params.dpi)
  const { 
    tileSize, 
    overlapUnits, 
    overlapXPercent, 
    overlapYPercent, 
    overlapX, 
    overlapY, 
    marginPx 
  } = pageState.params
  
  const { overlapX: ox, overlapY: oy } = computeOverlapPixels(
    tileSize, 
    overlapUnits, 
    overlapXPercent, 
    overlapYPercent, 
    overlapX, 
    overlapY
  )

  const files: { path: string; blob: Blob }[] = []
  const tiles: ExportTile[] = []
  const masks: ExportMask[] = []

  if (project.mode === 'auto') {
    const computedTiles = autoTiles(pageCanvas.width, pageCanvas.height, tileSize, ox, oy, marginPx)
    let i = 0
    for (const t of computedTiles) {
      const b = await cropTile(pageCanvas, t.x, t.y, t.w, t.h, tileSize)
      const filename = `${naming.pageName}/auto/tile-${i}-${t.x}x${t.y}.png`
      files.push({ path: filename, blob: b })
      tiles.push({ index: i, x: t.x, y: t.y, w: t.w, h: t.h, filename })
      i++
    }
  } else if (project.mode === 'slicing') {
    const computedTiles = computeSlices(pageCanvas.width, pageCanvas.height, pageState.slicing, marginPx)
    let i = 0
    for (const t of computedTiles) {
      const b = await cropTile(pageCanvas, t.x, t.y, t.w, t.h, tileSize)
      const filename = `${naming.pageName}/slicing/tile-${i}-${t.x}x${t.y}.png`
      files.push({ path: filename, blob: b })
      tiles.push({ index: i, x: t.x, y: t.y, w: t.w, h: t.h, filename })
      i++
    }
  } else {
    // Manual mode
    let i = 0
    for (const t of pageState.manualTiles) {
      if (t.isMask) {
        masks.push({ id: t.id, x: t.x, y: t.y, size: t.size })
        continue
      }
      const b = await cropTile(pageCanvas, t.x, t.y, t.size, t.size, t.size)
      const filename = `${naming.pageName}/manual/tile-${i}-${t.x}x${t.y}.png`
      files.push({ path: filename, blob: b })
      tiles.push({ id: t.id, x: t.x, y: t.y, w: t.size, h: t.size, filename })
      i++
    }
  }

  return {
    files,
    manifest: {
      page: pageNum,
      pageName: naming.pageName,
      pageLabel: naming.pageLabel,
      bookmarkPath: naming.bookmarkPath,
      mode: project.mode,
      params: pageState.params,
      tiles,
      masks
    }
  }
}

export type ExportAllResult = {
  files: { path: string; blob: Blob }[]
  manifest: { pages: PageExportResult['manifest'][] }
}

export async function exportAllPages(
  pdf: PDFDocumentProxy,
  project: Project,
  onProgress?: (current: number, total: number) => void
): Promise<ExportAllResult> {
  const nameMap = await getPageNameMap(pdf)
  const files: { path: string; blob: Blob }[] = []
  const pages: PageExportResult['manifest'][] = []

  for (let pageNum = 1; pageNum <= project.totalPages; pageNum++) {
    const naming = nameMap.get(pageNum)!
    const result = await exportPage(pdf, project, pageNum, naming)
    
    files.push(...result.files)
    pages.push(result.manifest)
    
    if (onProgress) {
      onProgress(pageNum, project.totalPages)
    }
  }

  return { files, manifest: { pages } }
}
