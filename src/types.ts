
export type Mode = 'auto' | 'manual'

export type TilingParams = {
  tileSize: 128 | 256 | 512 | 1024 | 2048
  overlapXPercent: number   // 0..90
  overlapYPercent: number   // 0..90
  overlapUnits: 'percent' | 'pixels'
  overlapX: number          // pixels if overlapUnits='pixels', computed if 'percent'
  overlapY: number
  dpi: number               // default 300
  marginPx: number          // clip margin inside page
  snapToGrid: boolean
  pastelAlpha: number       // 0..1 for overlay
  pageScale: number         // derived: dpi/72 - computed at runtime, kept for info
}

/**
 * A manually placed tile on a page. When `isMask` is true the tile represents
 * a dead‑space mask and is excluded from export. Manual tiles store a
 * position and a fixed square size derived from the page’s current tiling
 * parameters. A unique id allows us to track and update specific tiles when
 * moving them with the keyboard or deleting them via the delete key.
 */
export type ManualTile = {
  id: string
  /** top‑left x coordinate in page pixel space */
  x: number
  /** top‑left y coordinate in page pixel space */
  y: number
  /** width/height of the square tile */
  size: number
  /** overlay colour for the tile */
  color: string
  /** when true this tile represents a mask and will not be exported */
  isMask?: boolean
}

export type PageState = {
  pageNumber: number
  params: TilingParams
  manualTiles: ManualTile[]
}

export type Project = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  pdfBlobKey?: string       // key into IndexedDB for the PDF blob
  totalPages: number
  currentPage: number
  mode: Mode
  pages: Record<number, PageState>
  applyAutoToAll: boolean
  sourceFileName?: string
}
