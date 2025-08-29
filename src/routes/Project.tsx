
import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import PageSidebar from '../components/PageSidebar'
import Toolbar from '../components/Toolbar'
import CanvasView from '../components/CanvasView'
import ExportPanel from '../components/ExportPanel'

export default function Project(){
  const { id } = useParams()
  const nav = useNavigate()
  const setCurrent = useStore(s=>s.setCurrentProject)
  const project = useStore(s=> id ? s.projects[id] : undefined)

  useEffect(()=>{
    if (id) setCurrent(id)
  }, [id])

  if (!project){
    return (
      <div className="p-6">
        <div className="text-lg">Project not found.</div>
        <button className="mt-4 px-3 py-2 bg-zinc-800 rounded" onClick={()=>nav('/')}>Back</button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <Toolbar />
      <div className="flex-1 min-h-0 flex">
        <PageSidebar />
        <CanvasView />
      </div>
      <ExportPanel />
    </div>
  )
}
