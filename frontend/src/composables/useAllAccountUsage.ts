import { computed, ref } from 'vue'
import type { AccountListItem, AccountUsageInfo } from '@/types'
import { extractApiErrorMessage } from '@/utils/apiError'

export type UsageQueryState = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled'
export interface UsageQueryOutcome {
  usage?: AccountUsageInfo
  local?: boolean
  skipped?: string
}
export interface UsageQueryRow {
  account: AccountListItem
  state: UsageQueryState
  message: string
  local: boolean
}
interface UsageQueryDependencies {
  list: (page: number, pageSize: number, filters: Record<string, string>) => Promise<{ items: AccountListItem[]; total: number; pages?: number }>
  query: (account: AccountListItem) => Promise<UsageQueryOutcome>
  onUsage?: (id: number, usage: AccountUsageInfo) => void
}

export function useAllAccountUsage(deps: UsageQueryDependencies) {
  const rows = ref<UsageQueryRow[]>([])
  const running = ref(false)
  const discovering = ref(false)
  const error = ref('')
  const stopping = ref(false)
  let cancelled = false
  const counts = computed(() => ({
    total: rows.value.length,
    completed: rows.value.filter(r => !['pending', 'running'].includes(r.state)).length,
    success: rows.value.filter(r => r.state === 'success').length,
    failed: rows.value.filter(r => r.state === 'failed').length,
    skipped: rows.value.filter(r => r.state === 'skipped').length,
    cancelled: rows.value.filter(r => r.state === 'cancelled').length
  }))
  function stop() {
    if (!running.value) return
    cancelled = true
    stopping.value = true
  }
  async function run(retryFailed = false) {
    if (running.value) return
    running.value = true
    cancelled = false
    stopping.value = false
    error.value = ''
    try {
      if (!retryFailed) {
        discovering.value = true
        rows.value = []
        const byID = new Map<number, AccountListItem>()
        // Ignore the current page's filters and selection; order IDs for stable pagination.
        const filters = { lite: '1', include_scheduler_score: '0', sort_by: 'id', sort_order: 'asc' }
        const first = await deps.list(1, 1000, filters)
        for (const account of first.items) byID.set(account.id, account)
        const pages = Math.max(first.pages ?? 0, Math.ceil(first.total / 1000))
        for (let page = 2; page <= pages && !cancelled; page++) {
          const result = await deps.list(page, 1000, filters)
          for (const account of result.items) byID.set(account.id, account)
        }
        if (cancelled) return
        if (byID.size !== first.total) throw new Error('Account list changed or is incomplete. Please retry.')
        rows.value = Array.from(byID.values(), account => ({ account, state: 'pending', message: '', local: false }))
      } else {
        for (const row of rows.value) if (row.state === 'failed') { row.state = 'pending'; row.message = '' }
      }
      discovering.value = false
      const queue = rows.value.filter(r => r.state === 'pending')
      let next = 0
      const worker = async () => {
        while (!cancelled && next < queue.length) {
          const row = queue[next++]
          row.state = 'running'
          try {
            const result = await deps.query(row.account)
            row.state = result.skipped ? 'skipped' : 'success'
            row.message = result.skipped ?? ''
            row.local = result.local === true
            if (result.usage) deps.onUsage?.(row.account.id, result.usage)
          } catch (e) {
            row.state = 'failed'
            row.message = extractApiErrorMessage(e, 'Query failed')
          }
        }
      }
      // Bound upstream pressure, without limiting the number of accounts queried.
      await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker))
      for (const row of queue) if (row.state === 'pending') row.state = 'cancelled'
    } catch (e) {
      error.value = extractApiErrorMessage(e, 'Unable to load accounts')
    } finally {
      discovering.value = false
      running.value = false
      stopping.value = false
    }
  }
  return { rows, counts, running, discovering, stopping, error, run, stop }
}
