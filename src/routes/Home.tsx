
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createNewProject, useStore } from '../store'
import { loadPdf } from '../lib/pdf'
import { putBlob } from '../lib/storage'

export default function Home(){
  const nav = useNavigate()
  const upsert = useStore(s=>s.upsertProject)
  const setCurrent = useStore(s=>s.setCurrentProject)
  const projects = useStore(s=>s.projects)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function onFiles(files: FileList | null){
    if (!files || files.length===0) return
    const file = files[0]
    setBusy(true)
    try {
      const pdf = await loadPdf(file)
      const id = crypto.randomUUID()
      const pdfKey = `pdf-${id}`
      await putBlob(pdfKey, file)
      const project = createNewProject(id, file.name.replace(/\.pdf$/i,''), pdf.numPages, file.name)
      project.pdfBlobKey = pdfKey
      upsert(project)
      setCurrent(id)
      nav(`/project/${id}`)
    } catch(err){
      console.error(err)
      alert('Failed to load PDF. Is it a valid PDF file?')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="grid md:grid-cols-2 gap-8">
        <div className="p-6 border border-zinc-800 rounded-2xl bg-zinc-900/40">
          <h2 className="text-xl font-semibold mb-2">Start a new project</h2>
          <p className="opacity-75 mb-4">Drop a PDF (multi‑page supported). We render at 300 dpi by default.</p>
          <div className="border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center">
            <input type="file" accept="application/pdf" hidden ref={inputRef} onChange={e=>onFiles(e.target.files)} />
            <button onClick={()=>inputRef.current?.click()} className="px-4 py-2 rounded bg-emerald-600">Choose PDF</button>
          </div>
        </div>

        <div className="p-6 border border-zinc-800 rounded-2xl bg-zinc-900/40">
          <h2 className="text-xl font-semibold mb-2">Resume</h2>
          <p className="opacity-75 mb-4">Your work autosaves locally. Pick up where you left off.</p>
          <div className="space-y-2 max-h-80 overflow-auto scroll-thin">
            {Object.values(projects).length===0 && <div className="opacity-60 text-sm">No saved projects yet.</div>}
            {Object.values(projects).map(p=> (
              <button key={p.id} onClick={()=>{ setCurrent(p.id); nav(`/project/${p.id}`) }}
                className="w-full text-left p-3 rounded bg-zinc-800 hover:bg-zinc-700">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs opacity-70">Pages: {p.totalPages} • Updated: {new Date(p.updatedAt).toLocaleString()}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
