
import { desktopStorage as localStorage } from '@/desktop/storage'
export const MODEL_PLAZA_CHANGED = 'sub2api:model-plaza-changed'

/** Notify this page and other same-origin tabs only after a successful save. */
export function notifyModelPlazaChanged(): void {
  window.dispatchEvent(new Event(MODEL_PLAZA_CHANGED))
  try {
    localStorage.setItem(MODEL_PLAZA_CHANGED, `${Date.now()}:${Math.random()}`)
  } catch {
    // Visible pages also poll when browser storage is unavailable.
  }
}
