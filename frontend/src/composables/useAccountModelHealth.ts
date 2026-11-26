import { onBeforeUnmount, ref, watch } from 'vue'
import { getAccountModelHealthControls, type ModelHealthControl } from '@/api/admin/modelHealth'

export function parseModelHealthControls(raw: unknown): Record<string, ModelHealthControl> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return Object.fromEntries(Object.entries(raw).flatMap(([model, value]) => {
    if (!value || typeof value !== 'object' || typeof value.enabled !== 'boolean') return []
    return [[model, { enabled: value.enabled, model: typeof value.model === 'string' ? value.model : model,
      rule_id: typeof value.rule_id === 'string' ? value.rule_id : '' }]]
  }))
}

export function useAccountModelHealth(
  account: () => { id: number; platform: string; type: string; extra?: Record<string, unknown> | null } | null | undefined,
  visible: () => boolean
) {
  const controls = ref<Record<string, ModelHealthControl>>({})
  const refreshFailed = ref(false)
  let timer: ReturnType<typeof setInterval> | undefined
  let version = 0
  const stop = () => { version++; if (timer) clearInterval(timer); timer = undefined }
  watch(() => [visible(), account()?.id] as const, () => {
    stop()
    refreshFailed.value = false
    const current = account()
    controls.value = current?.platform === 'openai' && current.type === 'apikey'
      ? parseModelHealthControls(current.extra?.model_health_routes) : {}
    if (!visible() || current?.platform !== 'openai' || current.type !== 'apikey') return
    const requestVersion = version
    let loading = false
    const refresh = async () => {
      if (loading || document.hidden) return
      loading = true
      try {
        const result = await getAccountModelHealthControls(current.id)
        if (requestVersion !== version) return
        controls.value = parseModelHealthControls(result)
        refreshFailed.value = false
      } catch {
        if (requestVersion === version) refreshFailed.value = true
      } finally { loading = false }
    }
    void refresh()
    timer = setInterval(() => { void refresh() }, 5000)
  }, { immediate: true })
  onBeforeUnmount(stop)
  return { controls, refreshFailed }
}
