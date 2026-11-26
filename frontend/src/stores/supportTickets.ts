import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { supportTicketsAPI } from '@/api/supportTickets'
import { useAuthStore } from './auth'

export const useSupportTicketStore = defineStore('supportTickets', () => {
  const auth = useAuthStore()
  const userUnread = ref(0)
  const adminUnread = ref(0)
  let lastRefresh = 0
  let pending: Promise<void> | null = null
  let generation = 0
  let refreshRequested = false

  watch(() => [auth.user?.id, auth.isAdmin], () => {
    generation++
    lastRefresh = 0
    userUnread.value = 0
    adminUnread.value = 0
    pending = null
    refreshRequested = false
  })

  async function refresh(force = false): Promise<void> {
    if (!auth.isAuthenticated || document.hidden) return
    if (pending) {
      if (force) refreshRequested = true
      return pending
    }
    if (!force && Date.now() - lastRefresh < 30000) return
    const current = generation
    pending = (async () => {
      try {
        const [personal, admin] = await Promise.all([
          supportTicketsAPI.summary(),
          auth.isAdmin ? supportTicketsAPI.summary(true) : Promise.resolve(null)
        ])
        if (current !== generation) return
        userUnread.value = personal.unread
        adminUnread.value = admin?.unread ?? 0
        lastRefresh = Date.now()
      } catch {
        // A badge refresh must not interrupt the page the user is working on.
      } finally {
        if (current === generation) {
          pending = null
          if (refreshRequested) {
            refreshRequested = false
            void refresh(true)
          }
        }
      }
    })()
    return pending
  }

  return { userUnread, adminUnread, refresh }
})
