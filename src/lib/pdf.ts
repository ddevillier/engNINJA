import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy, PageViewport } from 'pdfjs-dist'
import 'pdfjs-dist/build/pdf.worker.mjs'
import { PDF_POINTS_PER_INCH, THUMB_MAX_WIDTH } from './constants'

export async function loadPdf(file: File | Blob): Promise<PDFDocumentProxy> {
  const data = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data }).promise
  return pdf
}

export function computeScale(dpi: number): number {
  // PDF units: 72 points per inch. To render at target DPI:
  return dpi / PDF_POINTS_PER_INCH
}

export async function renderPage(
  page: PDFPageProxy, 
  canvas: HTMLCanvasElement, 
  dpi: number
): Promise<HTMLCanvasElement> {
  const scale = computeScale(dpi)
  const viewport = page.getViewport({ scale })
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const renderTask = page.render({ canvasContext: ctx, viewport })
  await renderTask.promise
  return canvas
}

export async function renderPageToCanvas(page: PDFPageProxy, dpi: number): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  return renderPage(page, canvas, dpi)
}

export async function renderPageThumb(page: PDFPageProxy, maxW = THUMB_MAX_WIDTH): Promise<HTMLCanvasElement> {
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
