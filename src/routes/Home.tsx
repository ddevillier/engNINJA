
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createNewProject, useStore } from '../store'
import { loadPdf } from '../lib/pdf'
import { putBlob } from '../lib/storage'
import { Spinner } from '../components/ui/Spinner'

export default function Home() {
  const nav = useNavigate()
  const upsert = useStore(s => s.upsertProject)
  const setCurrent = useStore(s => s.setCurrentProject)
  const projects = useStore(s => s.projects)
  const [busy, setBusy] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function processFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    if (file.type !== 'application/pdf') {
      alert('Please upload a valid PDF file.')
      return
    }

    setBusy(true)
    try {
      const pdf = await loadPdf(file)
      const id = crypto.randomUUID()
      const pdfKey = `pdf-${id}`
      await putBlob(pdfKey, file)
      const project = createNewProject(id, file.name.replace(/\.pdf$/i, ''), pdf.numPages, file.name)
      project.pdfBlobKey = pdfKey
      upsert(project)
      setCurrent(id)
      nav(`/project/${id}`)
    } catch (err) {
      console.error(err)
      alert('Failed to load PDF. Is it a valid PDF file?')
    } finally {
      setBusy(false)
      setIsDragging(false)
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    processFiles(e.dataTransfer.files)
  }

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-500 mb-4">
          Engineering Ninja Pro
        </h1>
        <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
          Professional PDF tiling and engineering document management.
          Split large plans into printable tiles with precision.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* New Project Card */}
        <div
          className={`relative group p-8 rounded-3xl border transition-all duration-300 ${isDragging
            ? 'border-emerald-500/50 bg-emerald-500/10 scale-[1.02] shadow-2xl shadow-emerald-500/20'
            : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900/80'
            }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 rounded-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center text-center space-y-6">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400 group-hover:text-emerald-400'
              }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-2">New Project</h2>
              <p className="text-zinc-400">
                Drag & drop your PDF here, or click to browse.
                <br />
                <span className="text-xs opacity-60">Supports multi-page PDFs • 300 DPI Rendering</span>
              </p>
            </div>

            <div className="w-full">
              <input
                type="file"
                accept="application/pdf"
                hidden
                ref={inputRef}
                onChange={e => processFiles(e.target.files)}
              />
              <button
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {busy ? <><Spinner className="w-5 h-5" /> Processing…</> : 'Select PDF File'}
              </button>
            </div>
          </div>
        </div>

        {/* Recent Projects Card */}
        <div className="p-8 rounded-3xl border border-zinc-800 bg-zinc-900/50 flex flex-col h-full min-h-[400px]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Recent Projects</h2>
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-zinc-800 text-zinc-400">
              {Object.values(projects).length} Projects
            </span>
          </div>

          <div className="flex-1 overflow-y-auto scroll-thin -mr-4 pr-4 space-y-3">
            {Object.values(projects).length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4 opacity-60">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p>No projects yet. Start one!</p>
              </div>
            ) : (
              Object.values(projects)
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setCurrent(p.id); nav(`/project/${p.id}`) }}
                    className="w-full group text-left p-4 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border border-transparent hover:border-zinc-700 transition-all"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-semibold text-zinc-200 group-hover:text-white truncate pr-4">{p.name}</div>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-zinc-600 group-hover:text-emerald-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-zinc-500 group-hover:text-zinc-400">
                      <span className="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {p.totalPages} Pages
                      </span>
                      <span>•</span>
                      <span>{new Date(p.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
