
import { desktopStorage as localStorage } from '@/desktop/storage'
import { readonly, ref } from 'vue'

const isDark = ref(typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
let observer: MutationObserver | null = null

/**
 * Reactive view of the `.dark` class on <html>. Theme toggles live in several places
 * (sidebar, auth and public headers); observing the class keeps every consumer in sync.
 */
export function useDarkMode() {
  if (!observer && typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
    observer = new MutationObserver(() => {
      isDark.value = document.documentElement.classList.contains('dark')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  }
  return readonly(isDark)
}

/** Toggle and persist the theme; consumers update through the class observer. */
export function setDarkMode(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
  isDark.value = dark
  try {
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  } catch {
    // Storage may be unavailable (private mode); the class change still applies.
  }
}
