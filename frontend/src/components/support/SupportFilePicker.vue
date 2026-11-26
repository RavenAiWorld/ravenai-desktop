<template>
  <div class="min-w-0">
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="ticket-icon-button" :disabled="disabled || modelValue.length >= 3" :title="t('support.attach')" :aria-label="t('support.attach')" @click="input?.click()">
        <Icon name="upload" size="sm" />
      </button>
      <input ref="input" class="sr-only" type="file" accept="image/png,image/jpeg" multiple :disabled="disabled" :aria-label="t('support.attach')" @change="addFiles" />
      <div v-for="(file, index) in modelValue" :key="`${file.name}-${index}`" class="relative h-12 w-12 shrink-0">
        <img :src="previews[index]" :alt="file.name" class="h-full w-full rounded border border-rv-line object-cover" />
        <button type="button" class="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded bg-rv-surface text-rv-fg shadow-sm" :disabled="disabled" :title="t('support.removeFile')" :aria-label="t('support.removeFile')" @click="remove(index)">
          <Icon name="x" size="xs" />
        </button>
      </div>
    </div>
    <p v-if="error" role="alert" class="mt-2 text-xs text-red-600 dark:text-red-400">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import { validateTicketFiles } from '@/utils/supportTickets'

const props = defineProps<{ modelValue: File[]; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [files: File[]] }>()
const { t } = useI18n()
const input = ref<HTMLInputElement | null>(null)
const previews = ref<string[]>([])
const error = ref('')

watch(() => props.modelValue, files => {
  previews.value.forEach(url => URL.revokeObjectURL(url))
  previews.value = files.map(file => URL.createObjectURL(file))
  error.value = ''
}, { immediate: true })

function addFiles(event: Event) {
  const target = event.target as HTMLInputElement
  const next = [...props.modelValue, ...Array.from(target.files ?? [])]
  target.value = ''
  const invalid = validateTicketFiles(next)
  if (invalid) {
    error.value = t(`support.fileErrors.${invalid}`)
    return
  }
  emit('update:modelValue', next)
}

function remove(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
}

onBeforeUnmount(() => previews.value.forEach(url => URL.revokeObjectURL(url)))
</script>

<style scoped>
.ticket-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid rgb(var(--rv-line));
  border-radius: 6px;
  color: rgb(var(--rv-fg-3));
}
.ticket-icon-button:hover { background: rgb(var(--rv-hover)); }
.ticket-icon-button:disabled { opacity: .4; cursor: not-allowed; }
</style>
