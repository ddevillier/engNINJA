
import { allowedTileSizes, useStore } from '../store'
import type { Mode } from '../types'
import { useMemo } from 'react'

export default function Toolbar(){
  const projectId = useStore(s=>s.currentProjectId)
  const project = useStore(s=> projectId ? s.projects[projectId] : undefined)
  const updateProject = useStore(s=>s.updateProject)
  const page = project ? project.pages[project.currentPage] : undefined
  const params = page?.params

  const tileSizes = allowedTileSizes()

  function updateParam<K extends keyof typeof params>(key:K, value:any){
    if (!project || !params) return
    updateProject(project.id, p => {
      const pg = p.pages[p.currentPage]
      // if applyAutoToAll and key is part of auto params, fan out
      if (p.applyAutoToAll){
        for (let i=1;i<=p.totalPages;i++){
          const t = p.pages[i].params as any
          t[key] = value
        }
      } else {
        (pg.params as any)[key] = value
      }
    })
  }

  function switchMode(mode: Mode){
    if (!project) return
    updateProject(project.id, p => { p.mode = mode })
  }

  if (!project || !params) return null
  const { overlapUnits } = params

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 border-b border-zinc-800 bg-zinc-900/40">
      <div className="flex items-center gap-2">
        <button
          onClick={()=>switchMode('auto')}
          className={`px-3 py-1 rounded-md text-sm ${project.mode==='auto'?'bg-emerald-600 text-white':'bg-zinc-800'}`}
        >Auto</button>
        <button
          onClick={()=>switchMode('manual')}
          className={`px-3 py-1 rounded-md text-sm ${project.mode==='manual'?'bg-emerald-600 text-white':'bg-zinc-800'}`}
        >Manual</button>
      </div>

      <div className="w-px h-6 bg-zinc-800" />

      <label className="text-sm">Tile
        <select className="ml-2 bg-zinc-800 rounded px-2 py-1"
          value={params.tileSize}
          onChange={e=>updateParam('tileSize', Number(e.target.value))}>
          {tileSizes.map(s=><option key={s} value={s}>{s}px</option>)}
        </select>
      </label>

      <label className="text-sm">Units
        <select className="ml-2 bg-zinc-800 rounded px-2 py-1"
          value={params.overlapUnits}
          onChange={e=>updateParam('overlapUnits', e.target.value as any)}>
          <option value="percent">Percent</option>
          <option value="pixels">Pixels</option>
        </select>
      </label>

      {overlapUnits==='percent' ? (
        <>
          <label className="text-sm">Overlap X %
            <input type="range" min={0} max={90} step={1} className="ml-2"
              value={params.overlapXPercent}
              onChange={e=>updateParam('overlapXPercent', Number(e.target.value))}/>
            <span className="ml-2 opacity-70">{params.overlapXPercent}%</span>
          </label>
          <label className="text-sm">Overlap Y %
            <input type="range" min={0} max={90} step={1} className="ml-2"
              value={params.overlapYPercent}
              onChange={e=>updateParam('overlapYPercent', Number(e.target.value))}/>
            <span className="ml-2 opacity-70">{params.overlapYPercent}%</span>
          </label>
        </>
      ) : (
        <>
          <label className="text-sm">Overlap X px
            <input type="number" min={0} className="ml-2 w-20 bg-zinc-800 rounded px-2 py-1"
              value={params.overlapX}
              onChange={e=>updateParam('overlapX', Number(e.target.value))}/>
          </label>
          <label className="text-sm">Overlap Y px
            <input type="number" min={0} className="ml-2 w-20 bg-zinc-800 rounded px-2 py-1"
              value={params.overlapY}
              onChange={e=>updateParam('overlapY', Number(e.target.value))}/>
          </label>
        </>
      )}

      <label className="text-sm">DPI
        <input type="number" min={72} step={1} className="ml-2 w-24 bg-zinc-800 rounded px-2 py-1"
          value={params.dpi}
          onChange={e=>updateParam('dpi', Number(e.target.value))}/>
      </label>

      <label className="text-sm">Margin
        <input type="number" min={0} step={1} className="ml-2 w-20 bg-zinc-800 rounded px-2 py-1"
          value={params.marginPx}
          onChange={e=>updateParam('marginPx', Number(e.target.value))}/>
      </label>

      <label className="text-sm">Snap
        <input type="checkbox" className="ml-2"
          checked={params.snapToGrid}
          onChange={e=>updateParam('snapToGrid', e.target.checked)} />
      </label>

      <label className="text-sm">Apply to all pages
        <input type="checkbox" className="ml-2"
          checked={project.applyAutoToAll}
          onChange={e=>{
            const val = e.target.checked
            updateProject(project.id, p => { p.applyAutoToAll = val })
          }} />
      </label>
    </div>
  )
}
