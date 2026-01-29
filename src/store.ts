import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { produce } from 'immer'
import type { Project, TilingParams } from './types'
import { 
  DEFAULT_TILE_SIZE, 
  DEFAULT_OVERLAP_PERCENT, 
  DEFAULT_DPI, 
  DEFAULT_PASTEL_ALPHA,
  DEFAULT_PREVIEW_ZOOM,
  DEFAULT_SNAP_TO_GRID,
  ALLOWED_TILE_SIZES,
  STORAGE_KEY,
  STORAGE_VERSION,
  DEFAULT_SLICE_SIZE,
  DEFAULT_SLICE_OVERLAP
} from './lib/constants'

type Store = {
  projects: Record<string, Project>
  currentProjectId?: string
  setCurrentProject: (id: string | undefined) => void
  upsertProject: (project: Project) => void
  updateProject: (id: string, updater: (p: Project) => void) => void
  deleteProject: (id: string) => void
}

const defaultParams: TilingParams = {
  tileSize: DEFAULT_TILE_SIZE,
  overlapXPercent: DEFAULT_OVERLAP_PERCENT,
  overlapYPercent: DEFAULT_OVERLAP_PERCENT,
  overlapUnits: 'percent',
  overlapX: 0,
  overlapY: 0,
  dpi: DEFAULT_DPI,
  marginPx: 0,
  snapToGrid: DEFAULT_SNAP_TO_GRID,
  pastelAlpha: DEFAULT_PASTEL_ALPHA,
  pageScale: DEFAULT_DPI / 72
}

export const useStore = create<Store>()(persist(
  (set, get) => ({
    projects: {},
    currentProjectId: undefined,
    setCurrentProject: (id) => set({ currentProjectId: id }),
    upsertProject: (project) => set(state => ({
      projects: { ...state.projects, [project.id]: project }
    })),
    updateProject: (id, updater) => set(produce(state => {
      const existing = state.projects[id]
      if (!existing) return
      updater(existing)
      existing.updatedAt = Date.now()
    })),
    deleteProject: (id) => set(state => {
      const cloned = { ...state.projects }
      delete cloned[id]
      const currentProjectId = state.currentProjectId === id ? undefined : state.currentProjectId
      return { projects: cloned, currentProjectId }
    })
  }),
  {
    name: STORAGE_KEY,
    version: STORAGE_VERSION,
    migrate: (persistedState: any, version: number) => {
      if (version === 0 || version === 1) {
        const state = persistedState as Store
        for (const pid in state.projects) {
          const proj = state.projects[pid]
          for (const pgNum in proj.pages) {
            const page = proj.pages[pgNum]
            if (!page.slicing) {
              page.slicing = {
                direction: 'horizontal',
                method: 'fixed',
                sliceSize: DEFAULT_SLICE_SIZE,
                overlap: DEFAULT_SLICE_OVERLAP,
                scooters: []
              }
            }
          }
        }
      }
      return persistedState
    },
    partialize: (state) => ({
      projects: state.projects,
      currentProjectId: state.currentProjectId
    }),
  }
))

export function createNewProject(
  id: string, 
  name: string, 
  totalPages: number, 
  sourceFileName?: string
): Project {
  const pages: Record<number, any> = {}
  for (let i = 1; i <= totalPages; i++) {
    pages[i] = {
      pageNumber: i,
      params: { ...defaultParams },
      manualTiles: [],
      slicing: {
        direction: 'horizontal',
        method: 'fixed',
        sliceSize: DEFAULT_SLICE_SIZE,
        overlap: DEFAULT_SLICE_OVERLAP,
        scooters: []
      },
      previewZoom: DEFAULT_PREVIEW_ZOOM,
      panX: 0,
      panY: 0
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

export function allowedTileSizes(): typeof ALLOWED_TILE_SIZES {
  return [...ALLOWED_TILE_SIZES]
}
