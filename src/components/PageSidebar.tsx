import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { loadPdf, renderPageThumb } from '../lib/pdf'
import { getBlob } from '../lib/storage'
import { THUMB_MAX_WIDTH } from '../lib/constants'
import { Spinner } from './ui/Spinner'

export default function PageSidebar() {
  const projectId = useStore(s => s.currentProjectId)
  const project = useStore(s => projectId ? s.projects[projectId] : undefined)
  const updateProject = useStore(s => s.updateProject)
  const [thumbs, setThumbs] = useState<Array<{ page: number; url: string }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function run() {
      try {
        if (!project?.pdfBlobKey) return
        const blob = await getBlob(project.pdfBlobKey)
        if (!blob) {
          setError('PDF not found in storage')
          return
        }
        const pdf = await loadPdf(blob)
        const arr: Array<{ page: number; url: string }> = []

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return
          const page = await pdf.getPage(i)
          const canvas = await renderPageThumb(page, THUMB_MAX_WIDTH)
          arr.push({ page: i, url: canvas.toDataURL() })
        }

        if (!cancelled) {
          setThumbs(arr)
        }
      } catch (err) {
        console.error('Failed to load thumbnails:', err)
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load thumbnails')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    run()
    return () => { cancelled = true }
  }, [project?.pdfBlobKey])

  if (!project) return null

  if (loading) {
    return (
      <aside className="w-56 border-r border-zinc-800 overflow-hidden flex flex-col">
        <div className="p-4 text-sm text-zinc-400 flex items-center gap-2">
          <Spinner className="w-4 h-4" />
          Loading thumbnails…
        </div>
      </aside>
    )
  }

  if (error) {
    return (
      <aside className="w-56 border-r border-zinc-800 overflow-hidden flex flex-col">
        <div className="p-4">
          <div className="text-sm text-rose-400 mb-2">Error loading thumbnails</div>
          <div className="text-xs text-zinc-500">{error}</div>
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-56 border-r border-zinc-800 overflow-y-auto scroll-thin">
      <div className="p-2 space-y-2">
        {thumbs.map(t => (
          <button
            key={t.page}
            onClick={() => updateProject(project.id, p => { p.currentPage = t.page })}
            className={`block w-full rounded overflow-hidden border ${project.currentPage === t.page ? 'border-emerald-500' : 'border-transparent hover:border-zinc-600'}`}
          >
            <img src={t.url} alt={`Page ${t.page}`} className="w-full block" loading="lazy" />
            <div className="text-xs px-2 py-1 text-left opacity-70">Page {t.page}</div>
          </button>
        ))}
      </div>
    </aside>
  )
}
