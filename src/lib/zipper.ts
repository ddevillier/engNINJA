
import JSZip from 'jszip'

export async function zipPngs(files: { path:string, blob:Blob }[], zipName='engninja-tiles.zip'){
  const zip = new JSZip()
  for (const f of files){
    zip.file(f.path, f.blob)
  }
  const content = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(content)
  const a = document.createElement('a')
  a.href = url
  a.download = zipName
  a.click()
  URL.revokeObjectURL(url)
}
