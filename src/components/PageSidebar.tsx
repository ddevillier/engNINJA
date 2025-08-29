
import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { loadPdf, renderPageThumb } from '../lib/pdf'
import { getBlob } from '../lib/storage'

export default function PageSidebar(){
  const projectId = useStore(s=>s.currentProjectId)
  const project = useStore(s=> projectId ? s.projects[projectId] : undefined)
  const updateProject = useStore(s=>s.updateProject)
  const [thumbs, setThumbs] = useState<Array<{page:number, url:string}>>([])

  useEffect(()=>{
    let cancelled = false
    async function run(){
      if (!project?.pdfBlobKey) return
      const blob = await getBlob(project.pdfBlobKey)
      if (!blob) return
      const pdf = await loadPdf(blob)
      const arr: Array<{page:number, url:string}> = []
      for (let i=1;i<=pdf.numPages;i++){
        const page = await pdf.getPage(i)
        const canvas = await renderPageThumb(page, 160)
        arr.push({ page: i, url: canvas.toDataURL() })
      }
      if (!cancelled) setThumbs(arr)
    }
    run()
    return ()=>{ cancelled = true }
  }, [project?.pdfBlobKey])

  if (!project) return null

  return (
    <aside className="w-56 border-r border-zinc-800 overflow-y-auto scroll-thin">
      <div className="p-2 space-y-2">
        {thumbs.map(t=> (
          <button key={t.page} onClick={()=>updateProject(project.id, p=>{p.currentPage = t.page})}
            className={`block w-full rounded overflow-hidden border ${project.currentPage===t.page?'border-emerald-500':'border-transparent hover:border-zinc-600'}`}>
            <img src={t.url} alt={`Page ${t.page}`} className="w-full block" />
            <div className="text-xs px-2 py-1 text-left opacity-70">Page {t.page}</div>
          </button>
        ))}
      </div>
    </aside>
  )
}
