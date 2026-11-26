<template>
  <AppLayout hide-heading>
    <div class="trace-page">
      <header class="trace-heading">
        <div class="trace-heading-row">
          <h1>{{ t('modelTrace.title') }}</h1>
          <span v-if="activeReport && activeReport.status !== 'stale'" class="trace-result" :data-result="activeReport.status" role="status">
            <Icon :name="activeReport.status === 'passed' ? 'checkCircle' : 'exclamationCircle'" size="sm" aria-hidden="true" />
            {{ t('modelTrace.status.' + activeReport.status) }}
          </span>
        </div>
        <p v-if="activeReport && hasArtifacts" class="trace-completed-at">
          <time :datetime="activeReport.completed_at">
            {{ t('modelTrace.completedAt', { time: formatCompletedTime(activeReport.completed_at) }) }}
          </time>
          <span>{{ t('modelTrace.timezone') }}</span>
        </p>
      </header>

      <div v-if="loading || (switching && !activeReport)" class="trace-loading" role="status" :aria-label="t('modelTrace.loading')">
        <div class="trace-skeleton-block" /><div class="trace-skeleton-block" />
        <span class="sr-only">{{ t('modelTrace.loading') }}</span>
      </div>
      <div v-else-if="failed" class="trace-notice">
        <Icon name="exclamationCircle" size="lg" aria-hidden="true" />
        <p role="alert">{{ t('modelTrace.error') }}</p>
        <button type="button" class="trace-inline-action" @click="load">
          <Icon name="refresh" size="sm" aria-hidden="true" />{{ t('modelTrace.retry') }}
        </button>
      </div>
      <div v-else-if="!activeReport || !hasArtifacts" class="trace-notice" role="status">
        <Icon name="inbox" size="lg" aria-hidden="true" />
        <p>{{ t('modelTrace.empty') }}</p>
      </div>

      <div v-else class="trace-works" :class="{ 'trace-works-pair': hasText && hasImage }">
        <section v-if="activeReport.text && hasText" class="trace-section trace-text-section" aria-labelledby="trace-text-title">
          <div class="trace-section-head">
            <span class="trace-index" aria-hidden="true">01</span>
            <h2 id="trace-text-title">{{ t('modelTrace.textTest') }}</h2>
          </div>
          <dl class="trace-dialogue">
            <div class="trace-question-block">
              <dt class="trace-col-label">{{ t('modelTrace.question') }}</dt>
              <dd id="trace-question" ref="questionEl" class="trace-question" :class="{ 'is-clamped': !questionExpanded }">{{ activeReport.text.question }}</dd>
              <dd v-if="questionNeedsToggle" class="trace-disclosure">
                <button type="button" class="trace-expand-btn trace-inline-action" aria-controls="trace-question"
                  :aria-expanded="questionExpanded" @click="questionExpanded = !questionExpanded">
                  {{ t(questionExpanded ? 'modelTrace.collapseQuestion' : 'modelTrace.expandQuestion') }}
                  <Icon name="chevronDown" size="xs" class="trace-chevron" aria-hidden="true" />
                </button>
              </dd>
            </div>
            <div class="trace-answer-block">
              <dt class="trace-col-label">{{ t('modelTrace.answer') }}</dt>
              <dd class="trace-answer" :class="{ 'is-long': isLongAnswer }">{{ activeReport.text.answer }}</dd>
              <dd class="trace-model-line">
                <span>{{ t('modelTrace.textModel') }}</span>
                <code>{{ textModel || t('modelTrace.modelUnspecified') }}</code>
              </dd>
            </div>
          </dl>
        </section>

        <section v-if="activeReport.image && hasImage" class="trace-section trace-image-section" aria-labelledby="trace-image-title">
          <div class="trace-section-head">
            <span class="trace-index" aria-hidden="true">02</span>
            <h2 id="trace-image-title">{{ t('modelTrace.imageTest') }}</h2>
          </div>
          <figure class="trace-image-body">
            <div v-if="imageLoading" class="trace-image-skeleton" role="status" :aria-label="t('modelTrace.loading')" />
            <button
              v-else-if="imageBlobUrl && !imageFailed"
              type="button"
              class="trace-image-trigger"
              :aria-label="t('modelTrace.zoomImage')"
              :title="t('modelTrace.zoomImage')"
              @click="lightboxOpen = true"
            >
              <img :src="imageBlobUrl" :alt="activeReport.image.title || t('modelTrace.imageTest')"
                loading="lazy" class="trace-image" @error="onImageError" />
              <span class="trace-image-loupe"><Icon name="search" size="sm" aria-hidden="true" /></span>
            </button>
            <div v-else class="trace-image-fallback" role="status">
              <Icon name="exclamationCircle" size="md" aria-hidden="true" />
              {{ t('modelTrace.imageUnavailable') }}
            </div>
            <figcaption>
              <div v-if="activeReport.image.title || activeReport.image.generated_at" class="trace-image-meta">
                <span v-if="activeReport.image.title" class="trace-image-caption">{{ activeReport.image.title }}</span>
                <time v-if="activeReport.image.generated_at" class="trace-image-time" :datetime="activeReport.image.generated_at">
                  {{ formatImageTime(activeReport.image.generated_at) }}
                </time>
              </div>
              <p class="trace-model-line">
                <span>{{ t('modelTrace.imageModel') }}</span>
                <code>{{ imageModel || t('modelTrace.modelUnspecified') }}</code>
              </p>
            </figcaption>
          </figure>
        </section>
      </div>

      <nav v-if="!loading && !failed" class="trace-history" aria-labelledby="trace-history-title" :aria-busy="switching">
        <div class="trace-history-head">
          <Icon name="clock" size="sm" aria-hidden="true" />
          <h2 id="trace-history-title">{{ t('modelTrace.historyTitle') }}</h2>
          <span>{{ t('modelTrace.historyPeriod') }}</span>
        </div>
        <ul v-if="history.length" class="trace-history-list">
          <li v-for="item in history" :key="item.id">
            <button type="button" class="trace-history-row" :class="{ 'is-current': item.id === selectedID }"
              :aria-current="item.id === selectedID ? 'true' : undefined" :disabled="switching" @click="openReport(item.id)">
              <time :datetime="item.completed_at">{{ formatCompletedTime(item.completed_at) }}</time>
              <span v-if="item.status !== 'stale'" class="trace-history-result" :data-result="item.status">{{ t('modelTrace.status.' + item.status) }}</span>
              <span class="trace-selection" v-if="item.id === selectedID">{{ t('modelTrace.viewing') }}</span>
              <Icon v-else name="chevronRight" size="xs" aria-hidden="true" />
            </button>
          </li>
        </ul>
        <p v-else class="trace-history-empty">{{ t('modelTrace.historyEmpty') }}</p>
        <p v-if="historyFailed" class="trace-switch-error" role="alert">{{ t('modelTrace.error') }}</p>
      </nav>

      <BaseDialog :show="lightboxOpen && !!imageBlobUrl && !imageFailed"
        :title="activeReport?.image?.title || t('modelTrace.imageTest')"
        width="extra-wide" close-on-click-outside @close="lightboxOpen = false">
        <div class="trace-lightbox">
          <img v-if="imageBlobUrl && !imageFailed" :src="imageBlobUrl"
            :alt="activeReport?.image?.title || t('modelTrace.imageTest')" class="trace-lightbox-img" />
        </div>
      </BaseDialog>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import Icon from '@/components/icons/Icon.vue'
import {
  getModelTrace,
  getModelTraceImage,
  getModelTraceReport,
  modelTraceRetainedUntil,
  type ModelTraceSnapshot
} from '@/api/modelTrace'

const { t, locale } = useI18n()
const snapshot = ref<ModelTraceSnapshot>()
const loading = ref(true)
const failed = ref(false)
const now = ref(0)

const questionEl = ref<HTMLElement | null>(null)
const questionExpanded = ref(false)
const questionOverflows = ref(false)

const imageBlobUrl = ref('')
const imageLoading = ref(false)
const imageFailed = ref(false)
const lightboxOpen = ref(false)

let clockStart = 0
let clockOffset = 0
let wallStart = 0
let timer: number | undefined
let refreshTimer: number | undefined
let listRequest: AbortController | undefined
let snapshotRequest: AbortController | undefined
let imageRequest: AbortController | undefined
let resizeObserver: ResizeObserver | undefined

const activeReport = computed(() => snapshot.value?.report)
const textModel = computed(() => activeReport.value?.stages.find(s => s.key === 'text')?.model)
const imageModel = computed(() => activeReport.value?.stages.find(s => s.key === 'image')?.model)

const hasText = computed(() => !!(activeReport.value?.text?.question && activeReport.value.text.answer))
const hasImage = computed(() => !!activeReport.value?.image?.url)
const hasArtifacts = computed(() => hasText.value || hasImage.value)

const history = computed(() => snapshot.value?.history ?? [])
const selectedID = computed(() => activeReport.value?.id)
const switching = ref(false)
const historyFailed = ref(false)

async function openReport(id: string) {
  if (!id || switching.value || !history.value.some(item => item.id === id)) return
  if (id === snapshot.value?.report?.id) return
  listRequest?.abort()
  snapshotRequest?.abort()
  const current = new AbortController()
  snapshotRequest = current
  switching.value = true
  historyFailed.value = false
  try {
    const value = await getModelTraceReport(id, current.signal)
    if (current.signal.aborted) return
    const previous = activeReport.value
    acceptSnapshot(value)
    const retained = snapshot.value
    if (retained && !retained.report && previous && retained.history.some(item =>
      item.id === previous.id && item.completed_at === previous.completed_at
    )) {
      snapshot.value = { ...retained, report: previous }
      refreshWindow()
    }
  } catch {
    if (!current.signal.aborted) {
      historyFailed.value = true
    }
  } finally {
    if (!current.signal.aborted) switching.value = false
  }
}

const isLongAnswer = computed(() => {
  const a = activeReport.value?.text?.answer ?? ''
  return a.length > 56 || a.includes('\n')
})
const questionNeedsToggle = computed(() => questionExpanded.value || questionOverflows.value)

// All report times render in Beijing time so they match the site's billing day.
const timeZone = 'Asia/Shanghai'

const completedFormatter = computed(() => new Intl.DateTimeFormat(locale.value || undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone
}))

const imageTimeFormatter = computed(() => new Intl.DateTimeFormat(locale.value || undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone
}))

function formatCompletedTime(value: string) {
  return completedFormatter.value.format(new Date(value))
}

function formatImageTime(value: string) {
  return imageTimeFormatter.value.format(new Date(value))
}

function measureQuestionOverflow() {
  const el = questionEl.value
  if (!el) {
    questionOverflows.value = false
    return
  }
  if (!questionExpanded.value) questionOverflows.value = el.scrollHeight > el.clientHeight + 2
}

function clearImage() {
  lightboxOpen.value = false
  if (imageBlobUrl.value) {
    URL.revokeObjectURL(imageBlobUrl.value)
    imageBlobUrl.value = ''
  }
}

function onImageError() {
  clearImage()
  imageFailed.value = true
}

async function loadImage(url?: string) {
  imageRequest?.abort()
  clearImage()
  imageFailed.value = false
  if (!url) {
    imageLoading.value = false
    imageFailed.value = true
    return
  }
  const current = new AbortController()
  imageRequest = current
  imageLoading.value = true
  try {
    const blob = await getModelTraceImage(url, current.signal)
    if (current.signal.aborted) return
    imageBlobUrl.value = URL.createObjectURL(blob)
  } catch {
    if (!current.signal.aborted) imageFailed.value = true
  } finally {
    if (!current.signal.aborted) imageLoading.value = false
  }
}

function serverNow() {
  // Use the server's clock; wall elapsed also accounts for systems that suspend performance.now().
  return clockStart + Math.max(performance.now() - clockOffset, Date.now() - wallStart, 0)
}

function refreshWindow() {
  window.clearTimeout(timer)
  const current = snapshot.value
  if (!current) return
  now.value = serverNow()
  const cutoff = (item: { completed_at: string }) => modelTraceRetainedUntil(item.completed_at)
  const report = current.report && now.value < cutoff(current.report) ? current.report : undefined
  const history = current.history.filter(item => now.value < cutoff(item))
  if (report !== current.report || history.length !== current.history.length) {
    snapshot.value = { server_time: current.server_time, report, history }
  }
  const deadlines = history.map(cutoff)
  if (report) deadlines.push(cutoff(report))
  const next = Math.min(...deadlines.filter(deadline => deadline > now.value))
  if (Number.isFinite(next)) timer = window.setTimeout(refreshWindow, Math.ceil(next - now.value))
  if (current.report && !report && history.length && !loading.value && !switching.value) void openReport(history[0].id)
}

function acceptSnapshot(value: ModelTraceSnapshot) {
  clockStart = Math.max(Date.parse(value.server_time), clockStart ? serverNow() : 0)
  clockOffset = performance.now()
  wallStart = Date.now()
  snapshot.value = value
  refreshWindow()
}

function onVisibilityChange() {
  if (!document.hidden) {
    refreshWindow()
    void refreshList()
  }
}

async function refreshList() {
  if (document.hidden || loading.value || switching.value || !snapshot.value || listRequest) return
  const current = new AbortController()
  listRequest = current
  const previous = activeReport.value
  const browsingOlder = previous && history.value[0]?.id !== previous.id
  try {
    const value = await getModelTrace(current.signal)
    if (current.signal.aborted) return
    const keep = browsingOlder && value.history.some(item => item.id === previous.id && item.completed_at === previous.completed_at)
    acceptSnapshot(keep ? { ...value, report: previous } : value)
  } catch {
    // A temporary read failure does not invalidate the last authorized snapshot.
  } finally {
    if (listRequest === current) listRequest = undefined
  }
}

async function load() {
  listRequest?.abort()
  snapshotRequest?.abort()
  const current = new AbortController()
  snapshotRequest = current
  loading.value = true
  failed.value = false
  historyFailed.value = false
  switching.value = false
  snapshot.value = undefined
  questionExpanded.value = false
  questionOverflows.value = false
  try {
    const value = await getModelTrace(current.signal)
    if (current.signal.aborted) return
    acceptSnapshot(value)
  } catch {
    if (!current.signal.aborted) failed.value = true
  } finally {
    if (!current.signal.aborted) loading.value = false
  }
  if (!current.signal.aborted && !failed.value && !activeReport.value && history.value.length) {
    void openReport(history.value[0].id)
  }
}

watch(() => activeReport.value?.image?.url, (url) => {
  if (!activeReport.value?.image) {
    imageRequest?.abort()
    clearImage()
    imageLoading.value = false
    imageFailed.value = false
    return
  }
  void loadImage(url)
}, { immediate: true })

watch([() => activeReport.value?.id, () => activeReport.value?.text?.question], async () => {
  questionExpanded.value = false
  questionOverflows.value = false
  await nextTick()
  measureQuestionOverflow()
  resizeObserver?.disconnect()
  if (questionEl.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => measureQuestionOverflow())
    resizeObserver.observe(questionEl.value)
  }
})

watch(locale, () => {
  void load()
})

onMounted(() => {
  void load()
  refreshTimer = window.setInterval(refreshList, 60_000)
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pageshow', refreshWindow)
})

onUnmounted(() => {
  window.clearInterval(refreshTimer)
  listRequest?.abort()
  snapshotRequest?.abort()
  imageRequest?.abort()
  resizeObserver?.disconnect()
  clearImage()
  window.clearTimeout(timer)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('pageshow', refreshWindow)
})
</script>

<style scoped>
.trace-page {
  container-type: inline-size;
  max-width: 1120px;
  margin-inline: auto;
  color: rgb(var(--rv-fg));
  letter-spacing: 0;
}
.trace-heading {
  padding-block: 4px 22px;
  border-bottom: 1px solid rgb(var(--rv-line-strong));
}
.trace-heading-row, .trace-section-head, .trace-completed-at, .trace-image-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
}
.trace-heading-row { gap: 12px; }
.trace-heading h1 { margin: 0; font-size: 26px; line-height: 1.28; font-weight: 650; }
.trace-completed-at {
  margin: 7px 0 0;
  gap: 4px 6px;
  font-size: 13px;
  line-height: 1.6;
  color: rgb(var(--rv-fg-3));
  font-variant-numeric: tabular-nums;
}
.trace-result {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: var(--rv-radius-sm);
  font-size: 13px;
  font-weight: 600;
}
[data-result="passed"] { color: rgb(var(--rv-success)); }
[data-result="suspected"] { color: rgb(var(--rv-warning)); }
[data-result="failed"] { color: rgb(var(--rv-danger)); }
.trace-result[data-result="passed"] { background: rgb(var(--rv-success-soft)); }
.trace-result[data-result="suspected"] { background: rgb(var(--rv-warning-soft)); }
.trace-result[data-result="failed"] { background: rgb(var(--rv-danger-soft)); }
.trace-inline-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 550;
  cursor: pointer;
}
[aria-expanded="true"] > .trace-chevron { transform: rotate(180deg); }
.trace-history { margin-top: 26px; border-top: 1px solid rgb(var(--rv-line-strong)); padding-top: 16px; }
.trace-history-head { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.trace-history-head h2 { margin: 0; font-size: 16px; font-weight: 600; }
.trace-history-head > span, .trace-history-empty { font-size: 13px; color: rgb(var(--rv-fg-3)); }
.trace-history-list {
  display: grid;
  gap: 2px;
  max-height: 300px;
  overflow: auto;
  list-style: none;
  padding: 4px;
  margin: 0;
}
.trace-history-row {
  width: 100%;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  min-height: 44px;
  padding: 6px 12px;
  border-radius: var(--rv-radius-sm);
  color: rgb(var(--rv-fg-2));
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-align: start;
}
.trace-history-row:hover { background: rgb(var(--rv-hover)); }
.trace-history-row time { margin-inline-end: auto; }
.trace-selection { font-weight: 550; }
.trace-history-row.is-current { background: rgb(var(--rv-accent-soft)); color: rgb(var(--rv-accent-fg)); }
.trace-history-row:disabled { cursor: progress; }
.trace-switch-error { font-size: 13px; color: rgb(var(--rv-danger)); }
.trace-works, .trace-loading { display: grid; gap: 30px; padding-top: 24px; }
.trace-section { min-width: 0; }
.trace-section-head { gap: 10px; margin-bottom: 19px; }
.trace-section-head h2 { font-size: 18px; font-weight: 650; line-height: 1.45; margin: 0; }
.trace-index {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 25px;
  border-radius: var(--rv-radius-sm);
  background: rgb(var(--rv-accent-soft));
  color: rgb(var(--rv-accent-fg));
  font: 550 12px/1 'Geist Mono', monospace;
}
.trace-image-section .trace-index { background: rgb(var(--rv-muted)); color: rgb(var(--rv-fg-2)); }
.trace-dialogue { margin: 0; max-width: 72ch; }
.trace-dialogue dd { margin: 0; }
.trace-col-label {
  display: block;
  margin-bottom: 7px;
  color: rgb(var(--rv-fg-3));
  font-size: 13px;
  line-height: 1.5;
  font-weight: 550;
}
.trace-question, .trace-answer {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 15px;
  line-height: 1.85;
}
.trace-question.is-clamped {
  display: -webkit-box;
  -webkit-line-clamp: 8;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.trace-inline-action { color: rgb(var(--rv-accent-fg)); }
.trace-inline-action:hover { text-decoration: underline; }
.trace-answer-block {
  margin-top: 21px;
  border-inline-start: 3px solid rgb(var(--rv-accent));
  padding: 11px 16px 14px;
  background: rgb(var(--rv-subtle));
}
.trace-answer-block .trace-col-label { color: rgb(var(--rv-accent-fg)); }
.trace-answer { font-size: 23px; line-height: 1.5; font-weight: 590; }
.trace-answer.is-long { font-size: 15px; line-height: 1.85; font-weight: 450; }
.trace-model-line, .trace-dialogue dd.trace-model-line {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 2px 8px;
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: rgb(var(--rv-fg-3));
}
.trace-model-line code {
  min-width: 0;
  overflow-wrap: anywhere;
  color: rgb(var(--rv-fg-2));
  font-family: 'Geist Mono', monospace;
}
.trace-image-body { margin: 0; max-width: 800px; }
.trace-image-trigger, .trace-image-fallback, .trace-image-skeleton {
  width: 100%;
  border-radius: var(--rv-radius);
  background: rgb(var(--rv-subtle));
  border: 1px solid rgb(var(--rv-line));
}
.trace-image-trigger {
  display: grid;
  place-items: center;
  position: relative;
  padding: 0;
  overflow: hidden;
  cursor: zoom-in;
}
.trace-image { display: block; width: 100%; height: auto; max-height: 65vh; object-fit: contain; }
.trace-image-loupe {
  position: absolute;
  inset-inline-end: 10px;
  bottom: 10px;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  color: rgb(var(--rv-fg));
  background: rgb(var(--rv-raised));
  border: 1px solid rgb(var(--rv-line));
  border-radius: var(--rv-radius-sm);
  box-shadow: var(--rv-shadow-sm);
}
.trace-image-trigger:hover .trace-image-loupe, .trace-image-trigger:focus-visible .trace-image-loupe { color: rgb(var(--rv-accent-fg)); }
.trace-image-meta { align-items: baseline; justify-content: space-between; gap: 4px 12px; margin-top: 10px; }
.trace-image-caption { font-size: 14px; line-height: 1.6; font-weight: 550; overflow-wrap: anywhere; }
.trace-image-time { font: 12px/1.5 'Geist Mono', monospace; color: rgb(var(--rv-fg-3)); }
.trace-image-fallback, .trace-notice {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 164px;
  padding: 20px;
  color: rgb(var(--rv-fg-3));
  font-size: 14px;
  text-align: center;
}
.trace-notice p { margin: 0; }
.trace-image-skeleton, .trace-skeleton-block { background: rgb(var(--rv-muted)); animation: trace-pulse 1.5s ease-in-out infinite; }
.trace-image-skeleton { aspect-ratio: 4 / 3; }
.trace-skeleton-block { min-height: 170px; border-radius: var(--rv-radius); }
.trace-lightbox { display: grid; place-items: center; }
.trace-lightbox-img { display: block; width: auto; height: auto; max-width: 100%; max-height: 75vh; object-fit: contain; }
.trace-page button:focus-visible { outline: 2px solid rgb(var(--rv-accent)); outline-offset: 2px; }

@keyframes trace-pulse { 50% { opacity: 0.48; } }
@media (prefers-reduced-motion: reduce) { .trace-image-skeleton, .trace-skeleton-block { animation: none; } }
@container (min-width: 720px) {
  .trace-works-pair, .trace-loading { grid-template-columns: minmax(0, 1fr) minmax(0, 1.04fr); gap: 28px; }
  .trace-works-pair .trace-image-section { border-inline-start: 1px solid rgb(var(--rv-line)); padding-inline-start: 28px; }
}
@container (max-width: 719px) {
  .trace-works-pair .trace-image-section { padding-top: 21px; border-top: 1px solid rgb(var(--rv-line)); }
}
@container (max-width: 420px) {
  .trace-heading h1 { font-size: 22px; }
  .trace-heading { padding-bottom: 16px; }
  .trace-works, .trace-loading { padding-top: 19px; gap: 24px; }
  .trace-section-head { margin-bottom: 14px; }
  .trace-history-row, .trace-inline-action { min-height: 44px; }
}
</style>
