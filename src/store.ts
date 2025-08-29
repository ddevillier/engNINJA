import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project, TilingParams } from './types'

type Store = {
  projects: Record<string, Project>
  currentProjectId?: string
  setCurrentProject: (id: string | undefined) => void
  upsertProject: (project: Project) => void
  updateProject: (id: string, updater: (p: Project) => void) => void
  deleteProject: (id: string) => void
}

const defaultParams: TilingParams = {
  tileSize: 512,
  overlapXPercent: 20,
  overlapYPercent: 20,
  overlapUnits: 'percent',
  overlapX: 0,
  overlapY: 0,
  dpi: 300,
  marginPx: 0,
  snapToGrid: true,
  pastelAlpha: 0.35,
  pageScale: 300/72
}

export const useStore = create<Store>()(persist(
  (set, get) => ({
    projects: {},
    currentProjectId: undefined,
    setCurrentProject: (id) => set({ currentProjectId: id }),
    upsertProject: (project) => set(state => ({
      projects: { ...state.projects, [project.id]: project }
    })),
    updateProject: (id, updater) => set(state => {
      const existing = state.projects[id]
      if (!existing) return {}
      const copy: Project = JSON.parse(JSON.stringify(existing))
      updater(copy)
      copy.updatedAt = Date.now()
      return { projects: { ...state.projects, [id]: copy } }
    }),
    deleteProject: (id) => set(state => {
      const cloned = { ...state.projects }
      delete cloned[id]
      const currentProjectId = state.currentProjectId === id ? undefined : state.currentProjectId
      return { projects: cloned, currentProjectId }
    })
  }),
  {
    name: 'engninja-pro-store',
    version: 1,
    partialize: (state) => ({
      projects: state.projects,
      currentProjectId: state.currentProjectId
    }),
  }
))

export function createNewProject(id: string, name: string, totalPages: number, sourceFileName?: string): Project {
  const pages: Record<number, any> = {}
  for (let i = 1; i <= totalPages; i++){
    pages[i] = {
      pageNumber: i,
      params: { ...defaultParams },
      manualTiles: [],
      previewZoom: 100
    }
  }
  const p: Project = {
    id, name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    totalPages,
    currentPage: 1,
    mode: 'auto',
    applyAutoToAll: true,
    pages,
    sourceFileName
  }
  return p
}

export function allowedTileSizes(): Array<128|256|512|1024|2048> {
  return [128,256,512,1024,2048]
}
