import type { SlicingState, Scooter } from '../types'
import { MAX_OVERLAP_PERCENT, MIN_OVERLAP_PERCENT } from './constants'

export type Rect = { x: number, y: number, w: number, h: number }
export type Tile = Rect & { index: number }

function clamp(v: number, min: number, max: number) { 
  return Math.max(min, Math.min(max, v)) 
}

export function computeOverlapPixels(
  tileSize: number, 
  overlapUnits: 'percent' | 'pixels', 
  oxPercent: number, 
  oyPercent: number, 
  ox: number, 
  oy: number
) {
  const overlapX = overlapUnits === 'percent' 
    ? Math.round(tileSize * (clamp(oxPercent, MIN_OVERLAP_PERCENT, MAX_OVERLAP_PERCENT) / 100)) 
    : clamp(ox, 0, tileSize - 1)
  const overlapY = overlapUnits === 'percent' 
    ? Math.round(tileSize * (clamp(oyPercent, MIN_OVERLAP_PERCENT, MAX_OVERLAP_PERCENT) / 100)) 
    : clamp(oy, 0, tileSize - 1)
  return { overlapX, overlapY }
}

export function autoTiles(
  pageW: number, 
  pageH: number, 
  tileSize: number, 
  overlapX: number, 
  overlapY: number, 
  marginPx: number
): Tile[] {
  const usableW = Math.max(0, pageW - marginPx * 2)
  const usableH = Math.max(0, pageH - marginPx * 2)

  const strideX = Math.max(1, tileSize - overlapX)
  const strideY = Math.max(1, tileSize - overlapY)

  const tiles: Tile[] = []
  let idx = 0
  for (let y = 0; y < usableH; y += strideY) {
    for (let x = 0; x < usableW; x += strideX) {
      const left = marginPx + x
      const top = marginPx + y
      const w = Math.min(tileSize, pageW - left)
      const h = Math.min(tileSize, pageH - top)
      tiles.push({ x: left, y: top, w, h, index: idx++ })
      if (left + tileSize >= pageW - marginPx) break
    }
    if (marginPx + y + tileSize >= pageH - marginPx) break
  }

  // Ensure right/bottom edge coverage if not perfectly divisible
  const lastRowTop = Math.max(marginPx, pageH - marginPx - tileSize)
  const lastColLeft = Math.max(marginPx, pageW - marginPx - tileSize)

  if (!tiles.some(t => t.y === lastRowTop)) {
    // append a row at bottom
    for (let x = marginPx; x <= pageW - marginPx - tileSize; x += strideX) {
      tiles.push({ 
        x, 
        y: lastRowTop, 
        w: Math.min(tileSize, pageW - x), 
        h: Math.min(tileSize, pageH - lastRowTop), 
        index: tiles.length 
      })
    }
    // make sure last column too
    tiles.push({ 
      x: lastColLeft, 
      y: lastRowTop, 
      w: Math.min(tileSize, pageW - lastColLeft), 
      h: Math.min(tileSize, pageH - lastRowTop), 
      index: tiles.length 
    })
  }
  if (!tiles.some(t => t.x === lastColLeft)) {
    for (let y = marginPx; y <= pageH - marginPx - tileSize; y += strideY) {
      tiles.push({ 
        x: lastColLeft, 
        y, 
        w: Math.min(tileSize, pageW - lastColLeft), 
        h: Math.min(tileSize, pageH - y), 
        index: tiles.length 
      })
    }
  }

  // Deduplicate any accidental duplicates by key
  const key = (t: Tile) => `${t.x}|${t.y}`
  const seen = new Set<string>()
  const unique: Tile[] = []
  for (const t of tiles) {
    const k = key(t)
    if (seen.has(k)) continue
    seen.add(k)
    unique.push(t)
  }
  return unique.sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y).map((t, i) => ({ ...t, index: i }))
}

export function manualSnap(x: number, y: number, tileSize: number, snap: boolean) {
  if (!snap) return { x, y }
  const sx = Math.floor(x / tileSize) * tileSize
  const sy = Math.floor(y / tileSize) * tileSize
  return { x: sx, y: sy }
}

export function computeSlices(
  pageW: number, 
  pageH: number, 
  slicing: SlicingState, 
  marginPx: number
): Tile[] {
  const usableW = Math.max(0, pageW - marginPx * 2)
  const usableH = Math.max(0, pageH - marginPx * 2)
  const tiles: Tile[] = []

  if (slicing.method === 'fixed') {
    const { sliceSize, overlap, direction } = slicing
    if (direction === 'horizontal') {
      // Slicing horizontally means creating horizontal strips (full width, variable height?)
      // Wait, "horizontal slicing" usually means cutting the paper with horizontal lines.
      // So we iterate Y.
      // But wait, the user might mean "vertical slices" (like columns).
      // Let's assume "Horizontal" means "Horizontal Cuts" -> resulting in rows.
      // And "Vertical" means "Vertical Cuts" -> resulting in columns.

      const stride = Math.max(1, sliceSize - overlap)
      let idx = 0
      for (let y = 0; y < usableH; y += stride) {
        const top = marginPx + y
        const h = Math.min(sliceSize, pageH - top)
        // Full width
        tiles.push({ x: marginPx, y: top, w: usableW, h, index: idx++ })
        if (top + sliceSize >= pageH - marginPx) break
      }
      // Ensure bottom coverage
      const lastTop = Math.max(marginPx, pageH - marginPx - sliceSize)
      if (!tiles.some(t => t.y === lastTop)) {
        tiles.push({ 
          x: marginPx, 
          y: lastTop, 
          w: usableW, 
          h: Math.min(sliceSize, pageH - lastTop), 
          index: tiles.length 
        })
      }
    } else {
      // Vertical cuts -> columns
      const stride = Math.max(1, sliceSize - overlap)
      let idx = 0
      for (let x = 0; x < usableW; x += stride) {
        const left = marginPx + x
        const w = Math.min(sliceSize, pageW - left)
        // Full height
        tiles.push({ x: left, y: marginPx, w, h: usableH, index: idx++ })
        if (left + sliceSize >= pageW - marginPx) break
      }
      // Ensure right coverage
      const lastLeft = Math.max(marginPx, pageW - marginPx - sliceSize)
      if (!tiles.some(t => t.x === lastLeft)) {
        tiles.push({ 
          x: lastLeft, 
          y: marginPx, 
          w: Math.min(sliceSize, pageW - lastLeft), 
          h: usableH, 
          index: tiles.length 
        })
      }
    }
  } else {
    // Manual (Scooters)
    // Scooters define the CUT positions.
    // Sorted positions including start and end.
    const { direction, scooters } = slicing
    const sortedScooters = [...scooters].sort((a, b) => a.pos - b.pos)

    const cuts = [0] // Start at 0 (relative to usable area)
    sortedScooters.forEach(s => cuts.push(s.pos))

    if (direction === 'horizontal') {
      cuts.push(usableH)
      // Remove duplicates and sort
      const uniqueCuts = Array.from(new Set(cuts)).sort((a, b) => a - b)

      for (let i = 0; i < uniqueCuts.length - 1; i++) {
        const y1 = uniqueCuts[i]
        const y2 = uniqueCuts[i + 1]
        if (y2 <= y1) continue

        tiles.push({
          x: marginPx,
          y: marginPx + y1,
          w: usableW,
          h: y2 - y1,
          index: i
        })
      }
    } else {
      cuts.push(usableW)
      const uniqueCuts = Array.from(new Set(cuts)).sort((a, b) => a - b)

      for (let i = 0; i < uniqueCuts.length - 1; i++) {
        const x1 = uniqueCuts[i]
        const x2 = uniqueCuts[i + 1]
        if (x2 <= x1) continue

        tiles.push({
          x: marginPx + x1,
          y: marginPx,
          w: x2 - x1,
          h: usableH,
          index: i
        })
      }
    }
  }

  return tiles
}
