export type PageNameInfo = {
  pageName: string
  bookmarkPath?: string[]
  pageLabel?: string
}

const ILLEGAL = /[<>:"/\\|?*\u0000-\u001F]/g
const TRAILING = /[ .]+$/g

function slugSeg(s: string) {
  return s
    .normalize("NFC")
    .replace(/\s+/g, "-")
    .replace(ILLEGAL, "-")
    .replace(/-+/g, "-")
    .slice(0, 50)
    .replace(TRAILING, "")
}

function joinPath(segs: string[]) {
  return segs.map(slugSeg).filter(Boolean).join("/")
}

// Walk the PDF outline (bookmarks) and map leaf items to page indices
async function buildOutlineMap(pdf: any): Promise<Map<number, string[]>> {
  const outline = await pdf.getOutline()
  const out = new Map<number, string[]>()
  if (!outline) return out

  async function visit(items: any[], stack: string[]) {
    for (const item of items) {
      const title = (item.title || "").trim()
      const path = title ? [...stack, title] : stack
      if (item.dest) {
        try {
          const dest = await pdf.getDestination(item.dest)
          if (Array.isArray(dest) && dest[0]) {
            const idx = await pdf.getPageIndex(dest[0]) // 0-based
            const existing = out.get(idx)
            // prefer the deepest (longest) path if multiple point to same page
            if (!existing || path.length > existing.length) out.set(idx, path)
          }
        } catch {
          // ignore unresolvable dests
        }
      }
      if (item.items && item.items.length) await visit(item.items, path)
    }
  }
  await visit(outline, [])
  return out
}

export async function getPageNameMap(pdf: any): Promise<Map<number, PageNameInfo>> {
  const map = new Map<number, PageNameInfo>()
  const outlineMap = await buildOutlineMap(pdf)
  const labels: string[] | null = await pdf.getPageLabels().catch(() => null)

  const used = new Set<string>()
  const dedupe = (base: string, pageNum: number) => {
    let candidate = base
    let n = 2
    while (used.has(candidate)) {
      candidate = `${base}-p${pageNum}`
      if (n > 2) candidate = `${base}-p${pageNum}-${n}`
      n++
    }
    used.add(candidate)
    return candidate
  }

  for (let i = 0; i < pdf.numPages; i++) {
    const pageNum = i + 1
    const path = outlineMap.get(i)
    const label = labels && labels[i] ? String(labels[i]) : undefined

    let base: string
    if (path && path.length) base = joinPath(path)
    else if (label) base = slugSeg(label)
    else base = `page-${pageNum}`

    const pageName = dedupe(base, pageNum)
    map.set(pageNum, { pageName, bookmarkPath: path, pageLabel: label })
  }
  return map
}
