/**
 * Application constants for EngNinja Pro
 */

// PDF Constants
export const PDF_POINTS_PER_INCH = 72
export const DEFAULT_DPI = 300
export const MIN_DPI = 72

// Tiling Constants
export const DEFAULT_TILE_SIZE = 512
export const ALLOWED_TILE_SIZES = [128, 256, 512, 1024, 2048] as const
export type TileSize = typeof ALLOWED_TILE_SIZES[number]

// Overlap Constants
export const DEFAULT_OVERLAP_PERCENT = 20
export const MAX_OVERLAP_PERCENT = 90
export const MIN_OVERLAP_PERCENT = 0

// Visual Constants
export const PASTEL_HUE_STEP = 47
export const DEFAULT_PASTEL_ALPHA = 0.35
export const DEFAULT_PASTEL_SATURATION = 70
export const DEFAULT_PASTEL_LIGHTNESS = 70

// Zoom/Pan Constants
export const DEFAULT_PREVIEW_ZOOM = 100
export const MIN_PREVIEW_ZOOM = 5
export const MAX_PREVIEW_ZOOM = 400
export const ZOOM_STEP = 5
export const MAX_RENDER_ZOOM = 4  // Limit high-res render zoom to avoid huge canvases

// Interaction Constants
export const DEFAULT_SNAP_TO_GRID = true
export const DEFAULT_MARGIN_PX = 0
export const DRAG_THRESHOLD_PX = 2
export const SCOOTER_HIT_THRESHOLD_PX = 10
export const SCOOTER_HANDLE_OFFSET = 10
export const NUDGE_SMALL_STEP = 1
export const NUDGE_LARGE_STEP = 10

// Export Constants
export const THUMB_MAX_WIDTH = 160
export const THUMB_SIDEBAR_WIDTH = 200

// Slicing Constants
export const DEFAULT_SLICE_SIZE = 512
export const DEFAULT_SLICE_OVERLAP = 0

// Storage Constants
export const STORAGE_KEY = 'engninja-pro-store'
export const STORAGE_VERSION = 2
