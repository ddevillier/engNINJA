
import * as pdfjsLib from 'pdfjs-dist'
import 'pdfjs-dist/build/pdf.worker.mjs'

export async function loadPdf(file: File | Blob){
  const data = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data }).promise
  return pdf
}

export function computeScale(dpi: number){
  // PDF units: 72 points per inch. To render at target DPI:
  return dpi / 72
}

export async function renderPageToCanvas(page: any, dpi: number){
  const scale = computeScale(dpi)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const renderTask = page.render({ canvasContext: ctx, viewport })
  await renderTask.promise
  return canvas
}

export async function renderPageThumb(page: any, maxW=200){
  const viewport = page.getViewport({ scale: 1 })
  const scale = Math.min(1, maxW / viewport.width)
  const vp = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(vp.width)
  canvas.height = Math.ceil(vp.height)
  const ctx = canvas.getContext('2d')!
  const renderTask = page.render({ canvasContext: ctx, viewport: vp })
  await renderTask.promise
  return canvas
}
