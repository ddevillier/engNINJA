
import { set, get, del } from 'idb-keyval'

export async function putBlob(key:string, blob:Blob){
  await set(key, blob)
}

export async function getBlob(key:string): Promise<Blob|undefined> {
  const b = await get(key)
  return b as Blob | undefined
}

export async function deleteBlob(key:string){
  await del(key)
}
