import { useState } from 'react'
import { useStore } from '../store'
import { getBlob } from '../lib/storage'
import { loadPdf } from '../lib/pdf'
import { zipPngs } from '../lib/zipper'
import { exportPage, exportAllPages, type PageExportResult } from '../lib/export'
import { getPageNameMap } from '../lib/pageNames'

export default function ExportPanel() {
  const projectId = useStore(s => s.currentProjectId)
  const project = useStore(s => projectId ? s.projects[projectId] : undefined)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)

  if (!project) return null

  async function handleExportPage(pageNum: number) {
    setBusy(true)
    setProgress(null)
    try {
      if (!project.pdfBlobKey) return
      const blob = await getBlob(project.pdfBlobKey)
      if (!blob) return
      const pdf = await loadPdf(blob)
      const nameMap = await getPageNameMap(pdf)
      const naming = nameMap.get(pageNum)!

      const result = await exportPage(pdf, project, pageNum, naming)

      // enrich naming in per-page manifest and write inside the named folder
      const manifest = { ...result.manifest }
      const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' })
      result.files.push({ path: `${naming.pageName}/manifest.json`, blob: manifestBlob })

      await zipPngs(result.files, `engninja-tiles-page-${pageNum}.zip`)
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export failed. See console for details.')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  async function handleExportAll() {
    setBusy(true)
    setProgress({ current: 0, total: project.totalPages })
    try {
      if (!project.pdfBlobKey) return
      const blob = await getBlob(project.pdfBlobKey)
      if (!blob) return
      const pdf = await loadPdf(blob)

      const { files, manifest } = await exportAllPages(
        pdf,
        project,
        (current, total) => setProgress({ current, total })
      )

      // append global manifest and export info at the root
      const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' })
      const exportInfo = {
        app: 'EngNinja Pro',
        version: '0.1.0',
        exportedAt: new Date().toISOString()
      }
      files.push({ path: `manifest.json`, blob: manifestBlob })
      files.push({ path: `export-info.json`, blob: new Blob([JSON.stringify(exportInfo, null, 2)], { type: 'application/json' }) })

      await zipPngs(files, `engninja-tiles-all-pages.zip`)
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export failed. See console for details.')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <div className="p-3 border-t border-zinc-800 bg-zinc-900/40 flex items-center gap-3">
      <button
        disabled={busy}
        onClick={() => handleExportPage(project.currentPage)}
        className="px-3 py-2 rounded bg-emerald-600 disabled:opacity-50 hover:bg-emerald-500 transition-colors"
      >
        Export Current Page
      </button>
      <button
        disabled={busy}
        onClick={handleExportAll}
        className="px-3 py-2 rounded bg-emerald-700 disabled:opacity-50 hover:bg-emerald-600 transition-colors"
      >
        Export All Pages
      </button>
      {busy && (
        <div className="flex items-center gap-2">
          <span className="text-sm opacity-70">
            {progress ? `Exporting… ${progress.current}/${progress.total}` : 'Exporting…'}
          </span>
          {progress && (
            <div className="w-24 h-2 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
