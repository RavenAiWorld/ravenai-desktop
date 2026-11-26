import type { ImageQuality, ImageRatio, ImageTier } from '@/api/imageStudio'

export interface StudioImage {
  id: string
  createdAt: number
  prompt: string
  model: string
  tier: ImageTier
  ratio: ImageRatio
  quality: ImageQuality
  blob: Blob
}

async function openGallery(userID: number): Promise<IDBDatabase> {
  if (!Number.isSafeInteger(userID) || userID <= 0) throw new Error('Authenticated user required')
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`sub2api-image-studio-${userID}`, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('images', { keyPath: 'id' })
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Gallery database is busy'))
    request.onsuccess = () => resolve(request.result)
  })
}

async function transaction<T>(userID: number, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openGallery(userID)
  return new Promise((resolve, reject) => {
    const tx = db.transaction('images', mode)
    const request = run(tx.objectStore('images'))
    tx.oncomplete = () => { db.close(); resolve(request.result) }
    tx.onerror = () => { db.close(); reject(tx.error || request.error) }
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Gallery save failed')) }
  })
}

export async function loadStudioImages(userID: number) {
  const images = await transaction<StudioImage[]>(userID, 'readonly', store => store.getAll())
  return images.sort((a, b) => b.createdAt - a.createdAt)
}
export async function saveStudioImage(userID: number, image: StudioImage) {
  await transaction(userID, 'readwrite', store => store.put(image))
}
export async function deleteStudioImage(userID: number, id: string) {
  await transaction(userID, 'readwrite', store => store.delete(id))
}

export function decodeStudioImage(encoded: string): Blob {
  const raw = atob(encoded)
  const bytes = Uint8Array.from(raw, ch => ch.charCodeAt(0))
  let type = 'image/png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8) type = 'image/jpeg'
  else if (raw.startsWith('RIFF') && raw.slice(8, 12) === 'WEBP') type = 'image/webp'
  return new Blob([bytes], { type })
}
