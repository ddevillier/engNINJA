export type Mode = 'auto' | 'manual' | 'slicing'

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

export type ManualTile = {
  id: string
  x: number
  y: number
  size: number
  color: string
  isMask?: boolean
}

export type Scooter = {
  id: string
  pos: number // x or y coordinate depending on direction
}

export type SlicingState = {
  direction: 'horizontal' | 'vertical'
  method: 'fixed' | 'manual'
  // Fixed method params
  sliceSize: number
  overlap: number
  // Manual method params
  scooters: Scooter[]
}

export type PageState = {
  pageNumber: number
  params: TilingParams
  manualTiles: ManualTile[]
  slicing: SlicingState
  /** UI-only zoom percent for preview (25–400). Does not affect export DPI. */
  previewZoom?: number
  panX?: number
  panY?: number
}

export type Project = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  pdfBlobKey?: string
  totalPages: number
  currentPage: number
  mode: Mode
  pages: Record<number, PageState>
  applyAutoToAll: boolean
  sourceFileName?: string
}
