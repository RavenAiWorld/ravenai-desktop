<template>
  <AppLayout hide-heading>
    <div class="ticket-page" :class="{ 'has-ticket': !!selectedID }" data-testid="support-center">
      <header class="ticket-page-header">
        <h1>{{ t(isAdmin ? 'support.adminTitle' : 'support.title') }}</h1>
        <div class="flex shrink-0 items-center gap-2">
          <button type="button" class="ticket-icon-button" :disabled="listLoading || detailLoading" :title="t('support.refresh')" :aria-label="t('support.refresh')" @click="refreshAll">
            <Icon name="refresh" size="sm" :class="{ 'animate-spin': listLoading }" />
          </button>
          <button v-if="!isAdmin" type="button" class="btn btn-primary ticket-primary gap-1.5" @click="showCreate = true">
            <Icon name="plus" size="sm" />{{ t('support.newTicket') }}
          </button>
        </div>
      </header>

      <div class="ticket-filters" role="tablist" :aria-label="t('support.title')">
        <button v-for="filter in filters" :key="filter.value" type="button" role="tab" :aria-selected="activeFilter === filter.value" :class="{ active: activeFilter === filter.value }" @click="activeFilter = filter.value">
          {{ filter.label }}<span>{{ filter.count }}</span>
        </button>
      </div>

      <div class="ticket-workspace" :class="{ 'has-selection': !!selectedID }">
        <section class="ticket-list-pane" :aria-label="t('support.title')">
          <div class="ticket-list-tools">
            <div class="relative">
              <Icon name="search" size="sm" class="pointer-events-none absolute left-2.5 top-2.5 text-rv-fg-3" />
              <input v-model="search" type="search" class="input w-full pl-8" :placeholder="t(isAdmin ? 'support.adminSearch' : 'support.search')" :aria-label="t('support.search')" maxlength="128" />
            </div>
            <div class="flex min-w-0 gap-2">
              <select v-model="category" class="input min-w-0 flex-1" :aria-label="t('support.category')">
                <option value="">{{ t('support.allCategories') }}</option>
                <option v-for="value in categories" :key="value" :value="value">{{ t(`support.categories.${value}`) }}</option>
              </select>
              <select v-if="isAdmin" v-model="priority" class="input min-w-0 flex-1" :aria-label="t('support.priority')">
                <option value="">{{ t('support.allPriorities') }}</option>
                <option v-for="value in priorities" :key="value" :value="value">{{ t(`support.priorities.${value}`) }}</option>
              </select>
            </div>
          </div>

          <div v-if="listError" class="ticket-error" role="alert">
            <span>{{ listError }}</span><button type="button" @click="loadList()">{{ t('support.retry') }}</button>
          </div>
          <div class="ticket-list-scroll" :aria-busy="listLoading">
            <div v-if="listLoading && !items.length" class="ticket-empty">{{ t('support.loading') }}</div>
            <div v-else-if="!items.length && !listError" class="ticket-empty">
              <Icon name="inbox" size="xl" class="mb-3 text-rv-fg-3" />
              <p>{{ t(hasFilters ? 'support.noResults' : 'support.empty') }}</p>
            </div>
            <button v-for="item in items" :key="item.id" type="button" class="ticket-list-row" :class="{ selected: selectedID === item.id, unread: item.unread }" :aria-current="selectedID === item.id ? 'true' : undefined" @click="openTicket(item.id)">
              <div class="flex items-center justify-between gap-2 text-xs text-rv-fg-3">
                <span>#{{ item.id }}</span>
                <time :datetime="item.updated_at" :title="dateTime(item.updated_at)">{{ shortDate(item.updated_at) }}</time>
              </div>
              <div class="my-1.5 flex min-w-0 items-start gap-2">
                <span v-if="item.unread" class="ticket-unread-dot mt-1.5" :title="t('support.unread')" />
                <strong class="min-w-0 flex-1 break-words text-sm leading-5">{{ item.title }}</strong>
                <span v-if="item.priority === 'high'" class="ticket-priority-high shrink-0">{{ t('support.priorities.high') }}</span>
              </div>
              <p v-if="isAdmin" class="mb-1 truncate text-xs text-rv-fg-3">{{ item.customer_name || item.customer_email }}</p>
              <p class="truncate text-xs text-rv-fg-3">{{ item.last_message_preview }}</p>
              <div class="mt-2 flex items-center gap-2">
                <span class="ticket-status" :class="`status-${item.status}`">{{ t(`support.statuses.${item.status}`) }}</span>
                <span class="text-xs text-rv-fg-3">{{ t(`support.categories.${item.category}`) }}</span>
              </div>
            </button>
          </div>
          <div class="ticket-pagination">
            <span>{{ t('support.pagination', { from: total ? (page - 1) * 20 + 1 : 0, to: Math.min(page * 20, total), total }) }}</span>
            <div class="flex items-center gap-1">
              <button type="button" class="ticket-icon-button" :disabled="page <= 1 || listLoading" :title="t('support.previous')" :aria-label="t('support.previous')" @click="page--"><Icon name="chevronLeft" size="sm" /></button>
              <button type="button" class="ticket-icon-button" :disabled="page >= pages || listLoading" :title="t('support.next')" :aria-label="t('support.next')" @click="page++"><Icon name="chevronRight" size="sm" /></button>
            </div>
          </div>
        </section>

        <section class="ticket-detail-pane" :aria-label="t('support.conversation')" :aria-busy="detailLoading">
          <div v-if="!selectedID" class="ticket-empty">
            <Icon name="chatBubble" size="xl" class="mb-3 text-rv-fg-3" />
            <p>{{ t('support.selectTicket') }}</p>
          </div>
          <div v-else-if="detailLoading && !detail" class="ticket-empty">{{ t('support.loading') }}</div>
          <template v-else>
            <div v-if="detailError" class="ticket-error" role="alert">
              <span>{{ detailError }}</span><button type="button" @click="loadDetail()">{{ t('support.retry') }}</button>
            </div>
            <button v-if="!detail" type="button" class="ticket-back m-4" @click="backToList"><Icon name="arrowLeft" size="sm" />{{ t('support.back') }}</button>
            <template v-if="detail">
              <header class="ticket-detail-header">
                <div class="flex min-w-0 items-start gap-2">
                  <button type="button" class="ticket-icon-button ticket-mobile-back shrink-0" :title="t('support.back')" :aria-label="t('support.back')" @click="backToList"><Icon name="arrowLeft" size="sm" /></button>
                  <div class="min-w-0 flex-1">
                    <div class="mb-1 flex flex-wrap items-center gap-2 text-xs text-rv-fg-3">
                      <span>#{{ detail.ticket.id }}</span><span>{{ t(`support.categories.${detail.ticket.category}`) }}</span>
                      <span class="ticket-status" :class="`status-${detail.ticket.status}`">{{ t(`support.statuses.${detail.ticket.status}`) }}</span>
                    </div>
                    <h2 class="break-words text-base font-semibold leading-6">{{ detail.ticket.title }}</h2>
                    <p v-if="isAdmin" class="mt-1 break-all text-xs text-rv-fg-3">{{ detail.ticket.customer_name }}<span v-if="detail.ticket.customer_name"> · </span>{{ detail.ticket.customer_email }}</p>
                    <p v-if="detail.ticket.request_id" class="mt-1 break-all font-mono text-xs text-rv-fg-3">{{ t('support.requestID') }}: {{ detail.ticket.request_id }}</p>
                  </div>
                </div>
                <div class="ticket-detail-actions">
                  <template v-if="isAdmin">
                    <select :value="detail.ticket.status" class="input min-w-0" :disabled="updating || sending" :aria-label="t('support.statuses.' + detail.ticket.status)" @change="changeSelect($event, 'status')">
                      <option v-for="value in statuses" :key="value" :value="value">{{ t(`support.statuses.${value}`) }}</option>
                    </select>
                    <select :value="detail.ticket.priority" class="input min-w-0" :disabled="updating || sending" :aria-label="t('support.priority')" @change="changeSelect($event, 'priority')">
                      <option v-for="value in priorities" :key="value" :value="value">{{ t(`support.priorities.${value}`) }}</option>
                    </select>
                  </template>
                  <button v-else type="button" class="btn btn-secondary gap-1.5" :disabled="updating || sending" @click="updateTicket({ status: detail.ticket.status === 'closed' ? 'open' : 'closed' })">
                    <Icon :name="detail.ticket.status === 'closed' ? 'refresh' : 'checkCircle'" size="sm" />{{ t(detail.ticket.status === 'closed' ? 'support.reopen' : 'support.close') }}
                  </button>
                </div>
              </header>

              <div ref="conversation" class="ticket-conversation" role="log" :aria-label="t('support.conversation')" aria-live="polite">
                <article v-for="message in detail.messages" :key="message.id" class="ticket-message" :class="{ 'from-admin': message.author_role === 'admin', 'ticket-event': message.kind !== 'reply' }">
                  <template v-if="message.kind === 'reply'">
                    <div class="mb-2 flex flex-wrap items-center justify-between gap-1 text-xs">
                      <strong class="flex items-center gap-1.5" :class="message.author_role === 'admin' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rv-fg'">
                        <Icon :name="message.author_role === 'admin' ? 'shield' : 'userCircle'" size="sm" />{{ actorLabel(message) }}
                      </strong>
                      <time class="text-rv-fg-3" :datetime="message.created_at">{{ dateTime(message.created_at) }}</time>
                    </div>
                    <p class="ticket-message-content">{{ message.content }}</p>
                    <div v-if="message.attachments.length" class="mt-3 flex flex-wrap gap-3">
                      <SupportAttachment v-for="attachment in message.attachments" :key="`${isAdmin}-${detail.ticket.id}-${attachment.id}`" :attachment="attachment" :ticket-id="detail.ticket.id" :admin="isAdmin" />
                    </div>
                  </template>
                  <template v-else>
                    <Icon name="clock" size="xs" class="shrink-0" /><span>{{ eventText(message) }}</span><time :datetime="message.created_at">{{ shortDate(message.created_at) }}</time>
                  </template>
                </article>
              </div>

              <div v-if="detail.ticket.status === 'closed'" class="ticket-closed">
                <Icon name="lock" size="sm" /><span>{{ t('support.closed') }}</span>
                <button type="button" class="ml-auto text-sm font-medium text-rv-success" :disabled="updating" @click="updateTicket({ status: 'open' })">{{ t('support.reopen') }}</button>
              </div>
              <form v-else class="ticket-composer" @submit.prevent="sendReply">
                <label for="ticket-reply" class="sr-only">{{ t('support.reply') }}</label>
                <textarea id="ticket-reply" v-model="replyContent" class="input w-full resize-none" rows="3" maxlength="10000" required :disabled="sending" :placeholder="t('support.reply')" />
                <div class="ticket-composer-footer">
                  <SupportFilePicker v-model="replyFiles" :disabled="sending" />
                  <div class="flex min-w-0 items-center gap-2">
                    <select v-if="isAdmin" v-model="replyStatus" class="input min-w-0" :disabled="sending" :aria-label="t('support.reply')">
                      <option value="waiting">{{ t('support.send') }}</option>
                      <option value="resolved">{{ t('support.sendAndResolve') }}</option>
                    </select>
                    <button type="submit" class="btn btn-primary ticket-primary shrink-0 gap-1.5" :disabled="sending || updating || !replyContent.trim()">
                      <Icon name="arrowUp" size="sm" />{{ t('support.send') }}
                    </button>
                  </div>
                </div>
              </form>
            </template>
          </template>
        </section>
      </div>
    </div>

    <BaseDialog :show="showCreate" :title="t('support.newTicket')" width="wide" :close-on-escape="!creating" :show-close-button="!creating" @close="showCreate = false">
      <form id="support-create-form" class="space-y-4" @submit.prevent="createTicket">
        <div>
          <label for="ticket-subject" class="input-label">{{ t('support.subject') }}</label>
          <input id="ticket-subject" v-model="newTicket.title" class="input w-full" maxlength="120" required :disabled="creating" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="ticket-category" class="input-label">{{ t('support.category') }}</label>
            <select id="ticket-category" v-model="newTicket.category" class="input w-full" :disabled="creating">
              <option v-for="value in categories" :key="value" :value="value">{{ t(`support.categories.${value}`) }}</option>
            </select>
          </div>
          <div>
            <label for="ticket-priority" class="input-label">{{ t('support.priority') }}</label>
            <select id="ticket-priority" v-model="newTicket.priority" class="input w-full" :disabled="creating">
              <option v-for="value in priorities" :key="value" :value="value">{{ t(`support.priorities.${value}`) }}</option>
            </select>
          </div>
        </div>
        <div>
          <label for="ticket-request-id" class="input-label">{{ t('support.requestID') }} <span class="font-normal text-rv-fg-3">({{ t('support.optional') }})</span></label>
          <input id="ticket-request-id" v-model="newTicket.request_id" class="input w-full font-mono" maxlength="128" :disabled="creating" />
        </div>
        <div>
          <label for="ticket-content" class="input-label">{{ t('support.message') }}</label>
          <textarea id="ticket-content" v-model="newTicket.content" class="input w-full resize-y" rows="6" maxlength="10000" required :disabled="creating" />
        </div>
        <SupportFilePicker v-model="newFiles" :disabled="creating" />
      </form>
      <template #footer>
        <button type="button" class="btn btn-secondary" :disabled="creating" @click="showCreate = false">{{ t('support.cancel') }}</button>
        <button type="submit" form="support-create-form" class="btn btn-primary ticket-primary gap-1.5" :disabled="creating || !newTicket.title.trim() || !newTicket.content.trim()"><Icon name="plus" size="sm" />{{ t('support.create') }}</button>
      </template>
    </BaseDialog>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Icon from '@/components/icons/Icon.vue'
import SupportFilePicker from '@/components/support/SupportFilePicker.vue'
import SupportAttachment from '@/components/support/SupportAttachment.vue'
import { supportTicketsAPI, type SupportTicket, type TicketCategory, type TicketDetail, type TicketMessage, type TicketPriority, type TicketStatus, type TicketSummary } from '@/api/supportTickets'
import { encodeTicketFiles } from '@/utils/supportTickets'
import { useAppStore } from '@/stores/app'
import { useSupportTicketStore } from '@/stores/supportTickets'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const app = useAppStore()
const badges = useSupportTicketStore()
const isAdmin = computed(() => route.meta.requiresAdmin === true)
const basePath = computed(() => isAdmin.value ? '/admin/support' : '/support')
const selectedID = computed(() => {
  const raw = String(route.params.id ?? '')
  return /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : 0
})
const categories: TicketCategory[] = ['account', 'billing', 'api', 'image', 'other']
const priorities: TicketPriority[] = ['low', 'normal', 'high']
const statuses: TicketStatus[] = ['open', 'waiting', 'resolved', 'closed']
const summary = ref<TicketSummary>({ total: 0, open: 0, waiting: 0, resolved: 0, closed: 0, unread: 0 })
const filters = computed(() => [
  { value: 'all', label: t('support.all'), count: summary.value.total },
  { value: 'unread', label: t('support.unread'), count: summary.value.unread },
  ...statuses.map(value => ({ value, label: t(`support.statuses.${value}`), count: summary.value[value] }))
])
const activeFilter = ref('all')
const search = ref('')
const debouncedSearch = ref('')
const category = ref('')
const priority = ref('')
const page = ref(1)
const pages = ref(1)
const total = ref(0)
const items = ref<SupportTicket[]>([])
const detail = ref<TicketDetail | null>(null)
const listLoading = ref(false)
const detailLoading = ref(false)
const listError = ref('')
const detailError = ref('')
const sending = ref(false)
const updating = ref(false)
const creating = ref(false)
const showCreate = ref(false)
const replyContent = ref('')
const replyFiles = ref<File[]>([])
const replyStatus = ref<'waiting' | 'resolved'>('waiting')
const newFiles = ref<File[]>([])
const newTicket = reactive({ title: '', category: 'api' as TicketCategory, priority: 'normal' as TicketPriority, request_id: '', content: '' })
const conversation = ref<HTMLElement | null>(null)
const hasFilters = computed(() => activeFilter.value !== 'all' || !!debouncedSearch.value || !!category.value || !!priority.value)
const hasDraft = computed(() => !!replyContent.value.trim() || replyFiles.value.length > 0)
let listGeneration = 0
let detailGeneration = 0
let summaryGeneration = 0
let disposed = false
let searchTimer: ReturnType<typeof setTimeout> | undefined
let pollTimer: ReturnType<typeof setInterval> | undefined

function errorText(error: unknown, fallback: string): string {
  const err = error as { status?: number; reason?: string }
  const reasons: Record<string, string> = {
    SUPPORT_TICKET_INVALID: 'support.invalid',
    SUPPORT_TICKET_LIMIT: 'support.limit',
    SUPPORT_TICKET_CLOSED: 'support.reopenFirst',
    SUPPORT_TICKET_ATTACHMENT_INVALID: 'support.fileInvalid'
  }
  if (err?.status === 404) return t('support.notFound')
  if (err?.reason && reasons[err.reason]) return t(reasons[err.reason])
  return t(fallback)
}

async function loadList(quiet = false) {
  const generation = ++listGeneration
  if (!quiet) listLoading.value = true
  const admin = isAdmin.value
  try {
    const result = await supportTicketsAPI.list(admin, {
      page: page.value, page_size: 20,
      status: statuses.includes(activeFilter.value as TicketStatus) ? activeFilter.value : undefined,
      unread_only: activeFilter.value === 'unread',
      category: category.value || undefined, priority: priority.value || undefined,
      search: debouncedSearch.value || undefined
    })
    if (disposed || generation !== listGeneration) return
    items.value = result.items
    total.value = result.total
    pages.value = result.pages
    listError.value = ''
    if (page.value > result.pages) page.value = result.pages
  } catch (error) {
    if (!disposed && generation === listGeneration) listError.value = errorText(error, 'support.loadError')
  } finally {
    if (generation === listGeneration) listLoading.value = false
  }
}

async function loadSummary() {
  const generation = ++summaryGeneration
  try {
    const result = await supportTicketsAPI.summary(isAdmin.value)
    if (!disposed && generation === summaryGeneration) summary.value = result
  } catch {
    // Keep the previous counts when a periodic refresh fails.
  }
}

async function loadDetail(quiet = false) {
  const id = selectedID.value
  const admin = isAdmin.value
  const generation = ++detailGeneration
  if (!id) {
    detail.value = null
    detailError.value = ''
    detailLoading.value = false
    return
  }
  const scroll = conversation.value
  const atBottom = !scroll || scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 100
  if (!quiet) detailLoading.value = true
  try {
    const result = await supportTicketsAPI.detail(admin, id)
    if (disposed || generation !== detailGeneration) return
    detail.value = result
    detailError.value = ''
    if (atBottom || !quiet) {
      await nextTick()
      conversation.value?.scrollTo({ top: conversation.value.scrollHeight })
    }
    if (result.ticket.unread && !document.hidden) {
      await supportTicketsAPI.markRead(admin, id, result.ticket.last_message_id)
      if (disposed || generation !== detailGeneration) return
      detail.value.ticket.unread = false
      void loadList(true)
      void loadSummary()
      void badges.refresh(true)
    }
  } catch (error) {
    if (!disposed && generation === detailGeneration) detailError.value = errorText(error, 'support.detailError')
  } finally {
    if (generation === detailGeneration) detailLoading.value = false
  }
}

function refreshAll() {
  void loadList()
  void loadSummary()
  void loadDetail(true)
  void badges.refresh(true)
}

function openTicket(id: number) {
  void router.push(`${basePath.value}/${id}`)
}

function backToList() {
  void router.push(basePath.value)
}

async function createTicket() {
  if (creating.value || !newTicket.title.trim() || !newTicket.content.trim()) return
  creating.value = true
  try {
    const attachments = await encodeTicketFiles(newFiles.value)
    const result = await supportTicketsAPI.create({ ...newTicket, attachments })
    showCreate.value = false
    Object.assign(newTicket, { title: '', category: 'api', priority: 'normal', request_id: '', content: '' })
    newFiles.value = []
    activeFilter.value = 'all'
    search.value = ''
    debouncedSearch.value = ''
    category.value = ''
    priority.value = ''
    page.value = 1
    app.showSuccess(t('support.created'))
    void loadList()
    void loadSummary()
    creating.value = false
    await router.push(`/support/${result.id}`)
  } catch (error) {
    app.showError(errorText(error, 'support.actionError'))
  } finally {
    creating.value = false
  }
}

async function sendReply() {
  if (sending.value || !selectedID.value || !replyContent.value.trim()) return
  sending.value = true
  try {
    const attachments = await encodeTicketFiles(replyFiles.value)
    await supportTicketsAPI.reply(isAdmin.value, selectedID.value, {
      content: replyContent.value, attachments, status: isAdmin.value ? replyStatus.value : undefined
    })
    replyContent.value = ''
    replyFiles.value = []
    app.showSuccess(t('support.sent'))
    await loadDetail()
    void loadList(true)
    void loadSummary()
    void badges.refresh(true)
  } catch (error) {
    app.showError(errorText(error, 'support.actionError'))
    // A concurrent close should update the controls without clearing the draft.
    if ((error as { reason?: string })?.reason === 'SUPPORT_TICKET_CLOSED') void loadDetail(true)
  } finally {
    sending.value = false
  }
}

async function updateTicket(input: { status?: TicketStatus; priority?: TicketPriority }) {
  if (updating.value || !selectedID.value) return
  updating.value = true
  try {
    await supportTicketsAPI.update(isAdmin.value, selectedID.value, input)
    app.showSuccess(t('support.updated'))
    await loadDetail(true)
    void loadList(true)
    void loadSummary()
    void badges.refresh(true)
  } catch (error) {
    app.showError(errorText(error, 'support.actionError'))
  } finally {
    updating.value = false
  }
}

async function changeSelect(event: Event, field: 'status' | 'priority') {
  const target = event.target as HTMLSelectElement
  await updateTicket({ [field]: target.value } as { status?: TicketStatus; priority?: TicketPriority })
  if (detail.value) target.value = detail.value.ticket[field]
}

function actorLabel(message: TicketMessage) {
  return t(message.author_role === 'admin' ? 'support.team' : isAdmin.value ? 'support.customer' : 'support.you')
}

function eventText(message: TicketMessage) {
  if (message.kind === 'status' && statuses.includes(message.content as TicketStatus)) {
    return t('support.statusEvent', { actor: actorLabel(message), status: t(`support.statuses.${message.content}`) })
  }
  if (message.kind === 'priority' && priorities.includes(message.content as TicketPriority)) {
    return t('support.priorityEvent', { actor: actorLabel(message), priority: t(`support.priorities.${message.content}`) })
  }
  return message.content
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat(locale.value, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function shortDate(value: string) {
  const date = new Date(value)
  const today = date.toDateString() === new Date().toDateString()
  return new Intl.DateTimeFormat(locale.value, today ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric' }).format(date)
}

watch(search, value => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { debouncedSearch.value = value }, 350)
})

watch([activeFilter, category, priority, debouncedSearch], () => {
  if (page.value !== 1) page.value = 1
  else void loadList()
})
watch(page, () => { void loadList() })

watch([isAdmin, selectedID], ([admin], old) => {
  if (old && admin !== old[0]) {
    items.value = []
    activeFilter.value = 'all'
    page.value = 1
  }
  detail.value = null
  replyContent.value = ''
  replyFiles.value = []
  replyStatus.value = 'waiting'
  void loadList()
  void loadSummary()
  void loadDetail()
}, { immediate: true })

function canNavigate() {
  if (sending.value || updating.value || creating.value) return false
  const hasCreateDraft = showCreate.value && (newTicket.title || newTicket.content || newFiles.value.length)
  return (!hasDraft.value && !hasCreateDraft) || window.confirm(t('support.discard'))
}
onBeforeRouteUpdate((to, from) => to.path === from.path || canNavigate())
onBeforeRouteLeave(() => canNavigate())

function beforeUnload(event: BeforeUnloadEvent) {
  if (hasDraft.value || (showCreate.value && (newTicket.title || newTicket.content || newFiles.value.length))) {
    event.preventDefault()
    event.returnValue = ''
  }
}
function onVisible() {
  if (!document.hidden) refreshAll()
}
onMounted(() => {
  pollTimer = setInterval(() => {
    if (document.hidden || sending.value || updating.value) return
    void loadList(true)
    void loadSummary()
    void loadDetail(true)
  }, 30000)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('beforeunload', beforeUnload)
})
onBeforeUnmount(() => {
  disposed = true
  listGeneration++
  detailGeneration++
  summaryGeneration++
  if (searchTimer) clearTimeout(searchTimer)
  if (pollTimer) clearInterval(pollTimer)
  document.removeEventListener('visibilitychange', onVisible)
  window.removeEventListener('beforeunload', beforeUnload)
})
</script>

<style scoped>
.ticket-page { min-width: 0; color: rgb(var(--rv-fg)); letter-spacing: 0; }
.ticket-primary { color: #fff; background: #15803d; }
.ticket-primary:hover { background: #166534; }
.ticket-primary:focus-visible { outline: 2px solid rgb(var(--rv-success)); outline-offset: 2px; }
.ticket-page .input:focus, #support-create-form .input:focus { border-color: rgb(var(--rv-success)); box-shadow: 0 0 0 3px rgb(var(--rv-success) / 0.15); }
.ticket-page-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; }
.ticket-page-header h1 { font-size: 22px; line-height: 30px; font-weight: 600; }
.ticket-icon-button { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 1px solid rgb(var(--rv-line)); border-radius: 6px; color: rgb(var(--rv-fg-3)); }
.ticket-icon-button:hover { background: rgb(var(--rv-hover)); }
.ticket-icon-button:disabled { opacity: .4; cursor: not-allowed; }
.ticket-filters { display: flex; gap: 20px; min-width: 0; overflow-x: auto; border-bottom: 1px solid rgb(var(--rv-line)); }
.ticket-filters button { display: inline-flex; align-items: center; gap: 6px; min-height: 42px; flex-shrink: 0; border-bottom: 2px solid transparent; font-size: 13px; color: rgb(var(--rv-fg-3)); white-space: nowrap; }
.ticket-filters button.active { border-color: rgb(var(--rv-success)); color: rgb(var(--rv-success)); font-weight: 600; }
.ticket-filters button span { min-width: 18px; padding: 0 4px; border-radius: 4px; background: rgb(var(--rv-hover)); font-size: 11px; text-align: center; font-variant-numeric: tabular-nums; }
.ticket-filters button.active span { color: rgb(var(--rv-success)); background: rgb(var(--rv-success-soft)); }
.ticket-workspace { display: grid; grid-template-columns: minmax(260px, 320px) minmax(0, 1fr); height: min(780px, calc(100dvh - 210px)); min-height: 460px; border-bottom: 1px solid rgb(var(--rv-line)); }
.ticket-list-pane, .ticket-detail-pane { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.ticket-list-pane { border-right: 1px solid rgb(var(--rv-line)); }
.ticket-list-tools { display: flex; flex-direction: column; gap: 8px; padding: 16px 16px 16px 0; }
.ticket-list-tools .input { height: 36px; font-size: 12px; }
.ticket-list-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.ticket-list-row { display: block; width: 100%; padding: 14px 16px 14px 12px; border-left: 3px solid transparent; border-bottom: 1px solid rgb(var(--rv-line)); text-align: left; }
.ticket-list-row:hover { background: rgb(var(--rv-hover)); }
.ticket-list-row.selected { background: rgb(var(--rv-success-soft)); border-left-color: rgb(var(--rv-success)); }
.ticket-list-row strong { font-weight: 500; }
.ticket-list-row.unread strong { font-weight: 650; }
.ticket-unread-dot { width: 6px; height: 6px; border-radius: 50%; background: rgb(var(--rv-success)); flex-shrink: 0; }
.ticket-priority-high { color: #be123c; font-size: 10px; line-height: 18px; font-weight: 600; }
.ticket-status { display: inline-flex; align-items: center; padding: 1px 6px; border-radius: 4px; font-size: 10px; line-height: 16px; font-weight: 500; white-space: nowrap; }
.status-open { color: #0369a1; background: #e0f2fe; }
.status-waiting { color: #a16207; background: #fef9c3; }
.status-resolved { color: #047857; background: #d1fae5; }
.status-closed { color: #52525b; background: #e4e4e7; }
.ticket-pagination { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 52px; padding-right: 12px; font-size: 11px; color: rgb(var(--rv-fg-3)); }
.ticket-empty { display: flex; flex: 1; min-height: 180px; flex-direction: column; align-items: center; justify-content: center; padding: 32px 16px; font-size: 13px; color: rgb(var(--rv-fg-3)); }
.ticket-list-scroll > .ticket-empty { height: 100%; }
.ticket-error { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; padding: 12px; font-size: 12px; color: #b91c1c; background: #fef2f2; }
.ticket-error button { font-weight: 600; text-decoration: underline; }
.ticket-detail-header { display: flex; flex-direction: column; flex-shrink: 0; gap: 12px; max-height: 40%; overflow-y: auto; padding: 16px 0 16px 24px; border-bottom: 1px solid rgb(var(--rv-line)); }
.ticket-detail-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.ticket-detail-actions .input { width: auto; max-width: 180px; height: 32px; padding-top: 4px; padding-bottom: 4px; font-size: 12px; }
.ticket-detail-actions .btn { min-height: 30px; padding: 5px 10px; font-size: 12px; }
.ticket-conversation { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 4px 0 8px 24px; }
.ticket-message { padding: 18px 0; border-bottom: 1px solid rgb(var(--rv-line)); }
.ticket-message.from-admin:not(.ticket-event) { border-left: 2px solid #10b981; padding-left: 14px; }
.ticket-message-content { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13px; line-height: 1.75; }
.ticket-event { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; color: rgb(var(--rv-fg-3)); font-size: 11px; }
.ticket-event time { margin-left: auto; }
.ticket-composer { flex-shrink: 0; border-top: 1px solid rgb(var(--rv-line)); padding: 16px 0 0 24px; }
.ticket-composer textarea { min-height: 82px; max-height: 180px; font-size: 13px; }
.ticket-composer-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-top: 10px; padding-bottom: 14px; }
.ticket-composer-footer select { height: 34px; max-width: 165px; font-size: 12px; }
.ticket-composer-footer .btn { min-height: 34px; font-size: 12px; }
.ticket-closed { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-left: 24px; border-top: 1px solid rgb(var(--rv-line)); min-height: 56px; padding: 12px 0; font-size: 12px; color: rgb(var(--rv-fg-3)); }
.ticket-back { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: rgb(var(--rv-fg-3)); }
.ticket-mobile-back { display: none; }
:global(.dark) .status-open { color: #7dd3fc; background: #0c4a6e; }
:global(.dark) .status-waiting { color: #fde047; background: #713f12; }
:global(.dark) .status-resolved { color: #6ee7b7; background: #064e3b; }
:global(.dark) .status-closed { color: #d4d4d8; background: #3f3f46; }
:global(.dark) .ticket-priority-high { color: #fda4af; }
:global(.dark) .ticket-error { color: #fca5a5; background: #450a0a; }
@media (max-width: 900px) {
  .ticket-workspace { grid-template-columns: 1fr; height: calc(100dvh - 205px); min-height: 440px; }
  .ticket-list-pane { border-right: 0; }
  .ticket-list-tools { padding-right: 0; }
  .ticket-detail-pane { display: none; }
  .ticket-workspace.has-selection .ticket-list-pane { display: none; }
  .ticket-workspace.has-selection .ticket-detail-pane { display: flex; }
  .has-ticket .ticket-filters { display: none; }
  .has-ticket .ticket-workspace { height: calc(100dvh - 163px); }
  .ticket-detail-header { padding-left: 0; }
  .ticket-conversation, .ticket-composer { padding-left: 0; }
  .ticket-closed { margin-left: 0; }
  .ticket-mobile-back { display: inline-flex; }
  .ticket-page-header h1 { font-size: 20px; line-height: 28px; }
  .ticket-filters { gap: 16px; }
}
@media (max-width: 480px) {
  .ticket-composer-footer > div:last-child { margin-left: auto; }
  .ticket-composer-footer select { max-width: 135px; }
  .ticket-detail-header h2 { font-size: 14px; line-height: 21px; }
}
</style>
