export interface DesktopBridge {
  readStorage(): Promise<Record<string, string>>
  writeStorage(data: Record<string, string>): Promise<void>
  getInfo(): Promise<{ version: string; server: string }>
  navigation(action: 'back' | 'forward' | 'reload'): Promise<void>
  setTheme(dark: boolean): Promise<void>
  onNavigation(callback: (state: { back: boolean; forward: boolean }) => void): () => void
}

declare global { interface Window { ravenDesktop?: DesktopBridge } }

let ready = false
let scheduled = false
const nativeStorage = window.localStorage

function snapshot(): Record<string, string> {
  return Object.fromEntries(Array.from({ length: nativeStorage.length }, (_, index) => {
    const key = nativeStorage.key(index)!
    return [key, nativeStorage.getItem(key) || '']
  }))
}

function persist() {
  if (!ready || !window.ravenDesktop || scheduled) return
  scheduled = true
  queueMicrotask(() => {
    scheduled = false
    void window.ravenDesktop!.writeStorage(snapshot()).catch(() => {
      window.dispatchEvent(new Event('raven-storage-error'))
    })
  })
}

export const desktopStorage: Storage = {
  get length() { return nativeStorage.length },
  key(index) { return nativeStorage.key(index) },
  getItem(key) { return nativeStorage.getItem(key) },
  setItem(key, value) { nativeStorage.setItem(key, value); persist() },
  removeItem(key) { nativeStorage.removeItem(key); persist() },
  clear() { nativeStorage.clear(); persist() },
}

export async function initializeDesktopStorage() {
  if (window.ravenDesktop) {
    const saved = await window.ravenDesktop.readStorage()
    // A popup shares live origin storage with the main window; do not overwrite it.
    if (nativeStorage.length === 0) {
      for (const [key, value] of Object.entries(saved)) nativeStorage.setItem(key, value)
    }
    if (!nativeStorage.getItem('sub2api_locale')) nativeStorage.setItem('sub2api_locale', 'zh')
  }
  ready = true
  window.addEventListener('storage', persist)
  window.addEventListener('pagehide', persist)
}
