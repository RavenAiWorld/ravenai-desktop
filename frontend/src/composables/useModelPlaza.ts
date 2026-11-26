import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getModelPlaza, type ModelPlazaResponse } from '@/api/modelPlaza'
import { useAuthStore } from '@/stores/auth'
import { MODEL_PLAZA_CHANGED } from '@/utils/modelPlazaEvents'

export const MODEL_PLAZA_REFRESH_MS = 5000

export function useModelPlaza() {
  const auth = useAuthStore()
  const data = ref<ModelPlazaResponse | null>(null)
  const loading = ref(true)
  const loadFailed = ref(false)
  const fetchedAt = ref<Date | null>(null)
  let controller: AbortController | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  let disposed = false

  async function load(background = false) {
    if (disposed) return
    controller?.abort()
    const request = new AbortController()
    controller = request
    loading.value = !background || data.value === null
    if (!background) loadFailed.value = false
    try {
      const next = await getModelPlaza({ signal: request.signal })
      if (controller !== request || request.signal.aborted) return
      data.value = next
      fetchedAt.value = new Date()
      loadFailed.value = false
    } catch (error) {
      if (controller !== request || request.signal.aborted) return
      const status = error && typeof error === 'object' && 'status' in error ? error.status : 0
      if (status === 401 || status === 403 || status === 404) {
        data.value = null
        fetchedAt.value = null
      }
      loadFailed.value = true
    } finally {
      if (controller === request) {
        controller = null
        loading.value = false
      }
    }
  }

  function refreshVisible() {
    if (!document.hidden) void load(true)
  }

  function resetIdentity() {
    controller?.abort()
    data.value = null
    fetchedAt.value = null
    void load()
  }

  function onStorage(event: StorageEvent) {
    if (event.key === MODEL_PLAZA_CHANGED) refreshVisible()
    if (event.key === 'auth_token' || event.key === 'auth_user' || event.key === null) resetIdentity()
  }

  watch(() => [auth.isAuthenticated, auth.user?.id], resetIdentity)

  onMounted(() => {
    window.addEventListener(MODEL_PLAZA_CHANGED, refreshVisible)
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', refreshVisible)
    document.addEventListener('visibilitychange', refreshVisible)
    timer = setInterval(() => {
      if (!controller) refreshVisible()
    }, MODEL_PLAZA_REFRESH_MS)
    void load()
  })

  onBeforeUnmount(() => {
    disposed = true
    controller?.abort()
    controller = null
    clearInterval(timer)
    window.removeEventListener(MODEL_PLAZA_CHANGED, refreshVisible)
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('focus', refreshVisible)
    document.removeEventListener('visibilitychange', refreshVisible)
  })

  return { data, loading, loadFailed, fetchedAt, load: () => load() }
}
