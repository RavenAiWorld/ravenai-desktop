<template>
  <div v-if="siteKey" class="relative w-full" :class="{ 'min-h-[78px]': !action }" data-testid="hcaptcha-widget">
    <div v-if="loading && !action" role="status" class="absolute inset-0 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
      {{ t('auth.captchaLoading') }}
    </div>
    <div ref="containerRef"></div>
    <i18n-t v-if="action" keypath="auth.hcaptchaDisclosure" tag="p" class="text-xs leading-5 text-gray-500 dark:text-dark-400">
      <template #privacy>
        <a href="https://www.hcaptcha.com/privacy" target="_blank" rel="noopener noreferrer" class="underline hover:text-gray-700 dark:hover:text-dark-200">{{ t('auth.hcaptchaPrivacy') }}</a>
      </template>
      <template #terms>
        <a href="https://www.hcaptcha.com/terms" target="_blank" rel="noopener noreferrer" class="underline hover:text-gray-700 dark:hover:text-dark-200">{{ t('auth.hcaptchaTerms') }}</a>
      </template>
    </i18n-t>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { loadHCaptcha } from '@/utils/hcaptcha'

const props = withDefaults(defineProps<{ siteKey: string; action?: boolean }>(), { action: false })
const emit = defineEmits<{
  verify: [token: string]
  expire: []
  error: []
}>()
const { t } = useI18n()
const loading = ref(true)
const containerRef = ref<HTMLElement | null>(null)
let widgetId: string | null = null
let mounted = false
let generation = 0
let pendingProof: Promise<string | null> | null = null
let resolveProof: ((token: string | null) => void) | null = null

function finishProof(token: string | null): void {
  const resolve = resolveProof
  pendingProof = null
  resolveProof = null
  resolve?.(token)
}

function removeWidget(): void {
  generation += 1
  finishProof(null)
  if (widgetId !== null && window.hcaptcha) {
    window.hcaptcha.remove(widgetId)
    widgetId = null
  }
}

async function renderWidget(): Promise<void> {
  if (!props.siteKey) return
  const version = generation
  loading.value = true
  try {
    await loadHCaptcha()
    if (!mounted || version !== generation || !containerRef.value || !window.hcaptcha || widgetId !== null) return
    widgetId = window.hcaptcha.render(containerRef.value, {
      sitekey: props.siteKey,
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      size: props.action ? 'invisible' : containerRef.value.clientWidth > 0 && containerRef.value.clientWidth < 303 ? 'compact' : 'normal',
      callback: token => {
        if (!mounted || version !== generation) return
        emit('verify', token)
        finishProof(token)
      },
      'expired-callback': () => {
        if (!mounted || version !== generation) return
        emit('expire')
        finishProof(null)
      },
      'chalexpired-callback': () => {
        if (!mounted || version !== generation) return
        emit('expire')
        finishProof(null)
      },
      'error-callback': () => {
        if (!mounted || version !== generation) return
        emit('error')
        finishProof(null)
      },
      'close-callback': () => {
        if (version === generation) finishProof(null)
      }
    })
  } catch {
    if (mounted && version === generation) {
      emit('error')
      finishProof(null)
    }
  } finally {
    if (mounted && version === generation) loading.value = false
  }
}

function reset(): void {
  if (props.action) {
    removeWidget()
    return
  }
  finishProof(null)
  if (widgetId !== null && window.hcaptcha) window.hcaptcha.reset(widgetId)
  else void renderWidget()
}

function verify(): Promise<string | null> {
  if (!props.action || !mounted) return Promise.resolve(null)
  if (pendingProof) return pendingProof

  const proof = new Promise<string | null>(resolve => { resolveProof = resolve })
  pendingProof = proof
  void (async () => {
    try {
      await renderWidget()
      if (!mounted || pendingProof !== proof) return
      if (widgetId === null || !window.hcaptcha) {
        finishProof(null)
        return
      }
      window.hcaptcha.execute(widgetId)
    } catch {
      if (mounted && pendingProof === proof) {
        emit('error')
        finishProof(null)
      }
    }
  })()
  return proof
}

onMounted(() => {
  mounted = true
  if (!props.action) void renderWidget()
})
onUnmounted(() => {
  mounted = false
  removeWidget()
})
watch(() => [props.siteKey, props.action], () => {
  removeWidget()
  emit('expire')
  if (!props.action) void renderWidget()
})
defineExpose({ reset, verify })
</script>
