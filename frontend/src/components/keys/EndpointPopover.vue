<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { useClipboard } from '@/composables/useClipboard'
import type { CustomEndpoint } from '@/types'

const props = defineProps<{
  apiBaseUrl: string
  customEndpoints: CustomEndpoint[]
}>()

const { t } = useI18n()
const { copyToClipboard } = useClipboard()
const copiedEndpoint = shallowRef<CustomEndpoint | null>(null)
const panelId = useId()

let copiedResetTimer: number | undefined

function defaultEndpoints(value: string): CustomEndpoint[] {
  const base = value.trim()
  if (!base) return []

  try {
    const url = new URL(base)
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      const path = url.pathname.replace(/\/+$/, '').replace(/(?:\/v1)+$/, '')
      const root = url.origin + path
      const suffix = url.search + url.hash
      return [
        { name: t('keys.endpoints.openaiFormat'), endpoint: root + '/v1' + suffix, description: '' },
        { name: t('keys.endpoints.anthropicFormat'), endpoint: root + suffix, description: '' },
      ]
    }
  } catch {
    // Keep nonstandard configured addresses verbatim.
  }
  return [{ name: t('keys.endpoints.default'), endpoint: base, description: '' }]
}

const allEndpoints = computed(() => [...defaultEndpoints(props.apiBaseUrl), ...props.customEndpoints])

function addressParts(endpoint: string): string[] {
  const scheme = endpoint.match(/^[a-z][a-z\d+.-]*:\/\//i)?.[0] ?? ''
  const parts = endpoint.slice(scheme.length).split(/(?=[/?&#])/)
  parts[0] = scheme + parts[0]
  return parts
}

async function copy(item: CustomEndpoint) {
  const success = await copyToClipboard(item.endpoint, t('keys.endpoints.copied'))
  if (!success) return

  copiedEndpoint.value = item
  if (copiedResetTimer !== undefined) {
    window.clearTimeout(copiedResetTimer)
  }
  copiedResetTimer = window.setTimeout(() => {
    copiedEndpoint.value = null
    copiedResetTimer = undefined
  }, 1800)
}

function speedTestUrl(endpoint: string): string {
  return `https://www.tcptest.cn/http/${encodeURIComponent(endpoint)}`
}

onBeforeUnmount(() => {
  if (copiedResetTimer !== undefined) {
    window.clearTimeout(copiedResetTimer)
  }
})
</script>

<template>
  <section
    v-if="allEndpoints.length"
    class="endpoint-panel w-full min-w-0 max-w-3xl rounded-lg border border-rv-line-strong bg-rv-surface"
    :aria-labelledby="`${panelId}-title`"
  >
    <header class="flex items-center gap-2 rounded-t-[7px] border-b border-rv-line bg-rv-thead px-3 py-2">
      <Icon name="link" size="sm" aria-hidden="true" class="shrink-0 text-rv-fg-2" />
      <h2 :id="`${panelId}-title`" class="text-sm font-semibold text-rv-fg">{{ t('keys.endpoints.title') }}</h2>
    </header>

    <dl class="divide-y divide-rv-line">
      <div v-for="(item, index) in allEndpoints" :key="index" class="endpoint-row">
        <dt class="endpoint-label min-w-0 text-13 font-medium text-rv-fg-2 [overflow-wrap:anywhere]">{{ item.name }}</dt>
        <dd class="min-w-0">
          <div class="endpoint-address-line">
            <button
              type="button"
              class="endpoint-copy group/copy grid w-full min-w-0 items-start overflow-visible rounded-md text-left focus-visible:outline-none"
              :aria-label="t('keys.endpoints.copyNamed', { name: item.name })"
              :aria-describedby="`${panelId}-address-${index}${item.description ? ` ${panelId}-description-${index}` : ''}`"
              @click="copy(item)"
            >
              <code
                :id="`${panelId}-address-${index}`"
                class="min-w-0 self-center font-mono text-13 text-rv-fg [overflow-wrap:anywhere] group-hover/copy:text-rv-accent-fg group-hover/copy:underline group-focus-visible/copy:text-rv-accent-fg group-focus-visible/copy:underline"
              >
                <template v-for="(part, partIndex) in addressParts(item.endpoint)" :key="partIndex"><wbr v-if="partIndex > 0" />{{ part }}</template>
              </code>
              <span class="endpoint-action endpoint-copy-action" :class="{ 'endpoint-action--copied': copiedEndpoint === item }">
                <Icon :name="copiedEndpoint === item ? 'check' : 'copy'" size="sm" :stroke-width="1.75" aria-hidden="true" />
                <span aria-hidden="true" class="endpoint-hint group-hover/copy:visible group-focus-visible/copy:visible">
                  {{ t(copiedEndpoint === item ? 'keys.endpoints.copiedHint' : 'keys.endpoints.clickToCopy') }}
                </span>
              </span>
            </button>

            <a
              :href="speedTestUrl(item.endpoint)"
              target="_blank"
              rel="noopener noreferrer"
              class="endpoint-action endpoint-speed-action group/speed"
              :aria-label="t('keys.endpoints.speedTest')"
              :aria-describedby="`${panelId}-address-${index}`"
            >
              <Icon name="bolt" size="sm" :stroke-width="1.75" aria-hidden="true" />
              <span aria-hidden="true" class="endpoint-hint group-hover/speed:visible group-focus-visible/speed:visible">
                {{ t('keys.endpoints.speedTest') }}
              </span>
            </a>
          </div>
          <p
            v-if="item.description"
            :id="`${panelId}-description-${index}`"
            class="mt-1 text-xs text-rv-fg-2 [overflow-wrap:anywhere]"
          >{{ item.description }}</p>
        </dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.endpoint-panel {
  container-type: inline-size;
}

.endpoint-row {
  --action-size: 2rem;
  --action-gap: 0.375rem;
  --row-inset: 0.75rem;
  @apply relative grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-x-3 gap-y-1 py-1.5;
  padding-inline: var(--row-inset);
}

/* Keep controls beside the label so the address can use the full line in narrow columns. */
.endpoint-label {
  @apply py-1.5;
  min-height: var(--action-size);
  padding-inline-end: calc(2 * var(--action-size) + var(--action-gap) + 0.5rem);
}

.endpoint-copy-action,
.endpoint-speed-action {
  @apply absolute top-1.5;
}

.endpoint-copy-action {
  inset-inline-end: calc(var(--row-inset) + var(--action-size) + var(--action-gap));
}

.endpoint-speed-action {
  inset-inline-end: var(--row-inset);
}

/* The filter column can be narrow even on a desktop with the page actions beside it. */
@container (min-width: 34rem) {
  .endpoint-row {
    grid-template-columns: 12rem minmax(0, 1fr);
  }

  .endpoint-label {
    padding-inline-end: 0;
  }

  .endpoint-address-line {
    @apply grid grid-cols-[minmax(0,1fr)_auto] items-start;
    column-gap: var(--action-gap);
  }

  .endpoint-copy {
    @apply grid-cols-[minmax(0,1fr)_auto] gap-2;
  }

  .endpoint-copy code {
    @apply py-1;
  }

  .endpoint-copy-action,
  .endpoint-speed-action {
    @apply relative inset-auto;
  }
}

.endpoint-action {
  @apply flex shrink-0 items-center justify-center rounded-md border border-rv-line-strong bg-rv-muted text-rv-fg-2;
  width: var(--action-size);
  height: var(--action-size);
}

.endpoint-action:where(:hover, :focus-visible),
.endpoint-copy:where(:hover, :focus-visible) .endpoint-action {
  @apply border-rv-accent bg-rv-accent-soft text-rv-accent-fg;
}

.endpoint-action:focus-visible,
.endpoint-copy:focus-visible .endpoint-action {
  @apply outline outline-2 outline-offset-2 outline-rv-accent;
}

.endpoint-copy .endpoint-action--copied {
  @apply border-rv-success bg-rv-success-soft text-rv-success;
}

.endpoint-hint {
  @apply pointer-events-none invisible absolute bottom-full right-0 z-20 mb-1.5 w-max rounded-md border border-rv-line-strong bg-rv-raised px-2 py-1 text-left text-xs font-normal text-rv-fg-2 shadow-md [overflow-wrap:anywhere];
}
</style>
