
export type Rect = { x:number, y:number, w:number, h:number }
export type Tile = Rect & { index:number }

function clamp(v:number, min:number, max:number){ return Math.max(min, Math.min(max, v)) }

export function computeOverlapPixels(tileSize:number, overlapUnits:'percent'|'pixels', oxPercent:number, oyPercent:number, ox:number, oy:number){
  const overlapX = overlapUnits === 'percent' ? Math.round(tileSize * (clamp(oxPercent,0,90)/100)) : clamp(ox, 0, tileSize-1)
  const overlapY = overlapUnits === 'percent' ? Math.round(tileSize * (clamp(oyPercent,0,90)/100)) : clamp(oy, 0, tileSize-1)
  return { overlapX, overlapY }
}

export function autoTiles(pageW:number, pageH:number, tileSize:number, overlapX:number, overlapY:number, marginPx:number): Tile[] {
  const usableW = Math.max(0, pageW - marginPx*2)
  const usableH = Math.max(0, pageH - marginPx*2)

  const strideX = Math.max(1, tileSize - overlapX)
  const strideY = Math.max(1, tileSize - overlapY)

  const tiles: Tile[] = []
  let idx = 0
  for (let y = 0; y < usableH; y += strideY){
    for (let x = 0; x < usableW; x += strideX){
      const left = marginPx + x
      const top = marginPx + y
      const w = Math.min(tileSize, pageW - left)
      const h = Math.min(tileSize, pageH - top)
      tiles.push({ x:left, y:top, w, h, index: idx++ })
      if (left + tileSize >= pageW - marginPx) break
    }
    if (marginPx + y + tileSize >= pageH - marginPx) break
  }

  // Ensure right/bottom edge coverage if not perfectly divisible
  const lastRowTop = Math.max(marginPx, pageH - marginPx - tileSize)
  const lastColLeft = Math.max(marginPx, pageW - marginPx - tileSize)

  if (!tiles.some(t => t.y === lastRowTop)){
    // append a row at bottom
    for (let x = marginPx; x <= pageW - marginPx - tileSize; x += strideX){
      tiles.push({ x, y:lastRowTop, w: Math.min(tileSize, pageW - x), h: Math.min(tileSize, pageH - lastRowTop), index: tiles.length })
    }
    // make sure last column too
    tiles.push({ x:lastColLeft, y:lastRowTop, w: Math.min(tileSize, pageW - lastColLeft), h: Math.min(tileSize, pageH - lastRowTop), index: tiles.length })
  }
  if (!tiles.some(t => t.x === lastColLeft)){
    for (let y = marginPx; y <= pageH - marginPx - tileSize; y += strideY){
      tiles.push({ x:lastColLeft, y, w: Math.min(tileSize, pageW - lastColLeft), h: Math.min(tileSize, pageH - y), index: tiles.length })
    }
  }

  // Deduplicate any accidental duplicates by key
  const key = (t:Tile)=>`${t.x}|${t.y}`
  const seen = new Set<string>()
  const unique: Tile[] = []
  for (const t of tiles){
    const k = key(t)
    if (seen.has(k)) continue
    seen.add(k)
    unique.push(t)
  }
  return unique.sort((a,b)=> a.y===b.y ? a.x-b.x : a.y-b.y).map((t,i)=>({...t,index:i}))
}

export function manualSnap(x:number, y:number, tileSize:number, snap:boolean){
  if (!snap) return { x, y }
  const sx = Math.floor(x / tileSize) * tileSize
  const sy = Math.floor(y / tileSize) * tileSize
  return { x: sx, y: sy }
}
