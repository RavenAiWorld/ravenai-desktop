<template>
  <div class="w-36 min-w-0">
    <a v-if="url" :href="url" target="_blank" rel="noopener noreferrer" :title="attachment.name" class="block h-24 overflow-hidden rounded border border-rv-line bg-rv-canvas">
      <img :src="url" :alt="attachment.name" class="h-full w-full object-contain" loading="lazy" />
    </a>
    <button v-else type="button" class="flex h-24 w-full items-center justify-center rounded border border-rv-line bg-rv-canvas text-xs text-rv-fg-3" :disabled="loading" @click="load">
      {{ loading ? t('support.loading') : t('support.retry') }}
    </button>
    <a v-if="url" :href="url" :download="attachment.name" class="mt-1 flex min-w-0 items-center gap-1 text-xs text-rv-fg-3" :title="attachment.name">
      <Icon name="download" size="xs" class="shrink-0" />
      <span class="truncate">{{ attachment.name }}</span>
    </a>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { supportTicketsAPI, type TicketAttachment } from '@/api/supportTickets'
import Icon from '@/components/icons/Icon.vue'

const props = defineProps<{ attachment: TicketAttachment; ticketId: number; admin: boolean }>()
const { t } = useI18n()
const url = ref('')
const loading = ref(false)
let disposed = false

async function load() {
  if (loading.value) return
  loading.value = true
  try {
    const blob = await supportTicketsAPI.attachment(props.admin, props.ticketId, props.attachment.id)
    if (!disposed) {
      if (url.value) URL.revokeObjectURL(url.value)
      url.value = URL.createObjectURL(blob)
    }
  } catch {
    // The thumbnail itself offers retry without exposing an unauthenticated URL.
  } finally {
    loading.value = false
  }
}

onMounted(load)
onBeforeUnmount(() => {
  disposed = true
  if (url.value) URL.revokeObjectURL(url.value)
})
</script>
