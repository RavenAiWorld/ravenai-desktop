<template>
  <div
    v-if="!dialogOnly && mode === 'checkbox' && documents.length > 0"
    class="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 dark:border-amber-700/70 dark:bg-amber-950/40"
  >
    <div class="flex items-start gap-2">
      <input
        ref="consentRef"
        id="login-agreement-consent"
        type="checkbox"
        :checked="accepted"
        class="mt-[2px] h-4 w-4 flex-shrink-0 rounded border-amber-400 text-amber-600 focus:ring-amber-500 dark:border-amber-600 dark:bg-dark-900"
        @change="handleCheckboxChange"
      />
      <div class="min-w-0 flex-1">
        <p class="text-[13px] leading-5 text-amber-900 dark:text-amber-100">
          <label
            for="login-agreement-consent"
            class="cursor-pointer"
          >
            {{ t('legal.loginAgreementPrompt.checkboxPrefix') }}
          </label>
          <template v-for="(doc, index) in documents" :key="doc.id || doc.title">
            <RouterLink
              :to="documentRoute(doc)"
              target="_blank"
              rel="noopener noreferrer"
              class="font-medium text-amber-900 underline underline-offset-4 transition hover:text-amber-700 dark:text-amber-200 dark:hover:text-amber-100"
            >
              {{ doc.title }}
            </RouterLink>
            <span v-if="index < documents.length - 1">{{ t('legal.loginAgreementPrompt.documentSeparator') }}</span>
          </template>
        </p>
      </div>
    </div>
  </div>

  <div
    v-else-if="!dialogOnly && !accepted && documents.length > 0"
    class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/70 dark:bg-amber-950/40 dark:text-amber-100"
  >
    <div class="flex items-start gap-3">
      <Icon name="shield" size="sm" class="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-300" />
      <div class="min-w-0 flex-1">
        <p class="font-medium">{{ t('legal.loginAgreementPrompt.noticeTitle') }}</p>
        <p class="mt-1 text-amber-800 dark:text-amber-200">
          {{ t('legal.loginAgreementPrompt.noticeDescription') }}
        </p>
      </div>
      <button
        type="button"
        class="btn btn-primary btn-sm flex-shrink-0"
        @click="emit('open')"
      >
        {{ t('legal.loginAgreementPrompt.viewTerms') }}
      </button>
    </div>
  </div>

  <Teleport to="body">
    <Transition name="agreement-fade">
      <div
        v-if="dialogVisible"
        class="fixed inset-0 z-[140] flex items-center justify-center overflow-y-auto bg-gray-950/60 p-4 backdrop-blur-sm"
      >
        <div
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="agreement-dialog-title"
          class="w-full max-w-[600px] overflow-hidden rounded-2xl border border-rv-line bg-rv-raised shadow-2xl"
          @keydown="keepFocusInside"
        >
          <div class="border-b border-rv-line px-6 py-5">
            <div class="flex items-start gap-4">
              <span class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-rv-line text-rv-fg-2">
                <Icon name="shield" size="md" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 id="agreement-dialog-title" class="text-lg font-semibold tracking-tight text-rv-fg">
                    {{ t(regionNotice ? 'legal.loginAgreementPrompt.regionTitle' : 'legal.loginAgreementPrompt.dialogTitle') }}
                  </h2>
                  <span
                    v-if="updatedAt"
                    class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-dark-800 dark:text-dark-300"
                  >
                    {{ updatedAt }}
                  </span>
                </div>
                <p v-if="!regionNotice" class="mt-2 text-sm leading-6 text-gray-600 dark:text-dark-300">
                  {{
                    t('legal.loginAgreementPrompt.dialogDescription', {
                      date: updatedAt || t('legal.loginAgreementPrompt.recently'),
                    })
                  }}
                </p>
              </div>
            </div>
          </div>

          <div class="max-h-[58vh] overflow-y-auto px-6 py-5">
            <template v-if="regionNotice">
              <p class="mb-3 text-base font-semibold leading-7 text-gray-950 dark:text-white">
                {{ t('legal.loginAgreementPrompt.regionRestriction') }}
              </p>
              <p class="mb-5 text-sm leading-6 text-gray-600 dark:text-dark-300">
                {{ t('legal.loginAgreementPrompt.regionEligibility') }}
              </p>
            </template>
            <div class="mb-3 flex items-center justify-between gap-3">
              <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('legal.loginAgreementPrompt.relatedDocuments') }}</p>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <RouterLink
                v-for="(doc, index) in documents"
                :key="doc.id || doc.title"
                :to="documentRoute(doc)"
                target="_blank"
                rel="noopener noreferrer"
                class="group flex min-h-[64px] w-full items-center gap-3 rounded-xl border border-rv-line bg-rv-surface px-4 py-3 text-left transition hover:border-rv-line-strong hover:bg-rv-hover/40"
              >
                <span class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white text-gray-700 ring-1 ring-gray-200 transition group-hover:bg-primary-50 group-hover:text-primary-700 group-hover:ring-primary-100 dark:bg-dark-900 dark:text-dark-200 dark:ring-dark-700 dark:group-hover:bg-primary-500/10 dark:group-hover:text-primary-200 dark:group-hover:ring-primary-500/20">
                  <Icon :name="documentIcon(index, doc.title)" size="sm" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold text-gray-950 dark:text-white">{{ doc.title }}</span>
                </span>
                <span class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition group-hover:bg-primary-50 group-hover:text-primary-600 dark:group-hover:bg-primary-500/10 dark:group-hover:text-primary-300">
                  <Icon name="externalLink" size="sm" />
                </span>
              </RouterLink>
            </div>
            <label
              v-if="regionNotice"
              class="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-gray-100 px-4 py-3 text-sm leading-6 text-gray-800 dark:bg-dark-800 dark:text-dark-100"
            >
              <input
                ref="acknowledgementRef"
                v-model="acknowledged"
                type="checkbox"
                class="mt-1 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span>{{ t('legal.loginAgreementPrompt.regionAcknowledgement') }}</span>
            </label>
          </div>

          <div class="border-t border-rv-line bg-rv-thead px-6 py-4">
            <div class="grid grid-cols-2 gap-3">
              <button
                type="button"
                class="btn btn-secondary btn-lg w-full"
                @click="emit('reject')"
              >
                {{ t(regionNotice && dialogOnly ? 'legal.loginAgreementPrompt.rejectAndExit' : 'legal.loginAgreementPrompt.reject') }}
              </button>
              <button
                type="button"
                :disabled="regionNotice && !acknowledged"
                class="btn btn-primary btn-lg w-full"
                @click="emit('accept')"
              >
                {{ t('legal.loginAgreementPrompt.accept') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
import type { LoginAgreementDocument } from '@/types'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  accepted: boolean
  documents: LoginAgreementDocument[]
  mode: 'modal' | 'checkbox' | string
  updatedAt?: string
  visible: boolean
  dialogOnly?: boolean
}>(), {
  updatedAt: '',
  dialogOnly: false
})

const emit = defineEmits<{
  accept: []
  reject: []
  open: []
}>()

const dialogVisible = computed(() => props.visible && documents.value.length > 0)
const documents = computed(() => props.documents.filter((doc) => doc.title.trim()))
const updatedAt = computed(() => props.updatedAt || '')
const accepted = computed(() => props.accepted)
const mode = computed(() => props.mode === 'checkbox' ? 'checkbox' : 'modal')
const regionNotice = computed(() => ['service-terms', 'privacy-policy'].every(
  (id) => documents.value.some((document) => document.id === id)
))
const acknowledged = ref(false)
const dialogRef = ref<HTMLElement | null>(null)
const acknowledgementRef = ref<HTMLInputElement | null>(null)
const consentRef = ref<HTMLInputElement | null>(null)

defineExpose({
  focus: () => consentRef.value?.focus()
})

watch(dialogVisible, async (visible) => {
  acknowledged.value = false
  if (visible) {
    await nextTick()
    if (regionNotice.value) acknowledgementRef.value?.focus()
    else dialogRef.value?.querySelector<HTMLElement>('a, button')?.focus()
  }
}, { immediate: true })

function keepFocusInside(event: KeyboardEvent): void {
  if (event.key !== 'Tab' || !dialogRef.value) return
  const elements = Array.from(dialogRef.value.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled])'
  ))
  if (!elements.length) return
  const first = elements[0]
  const last = elements[elements.length - 1]
  if (event.shiftKey && (document.activeElement === first || !dialogRef.value.contains(document.activeElement))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.value.contains(document.activeElement))) {
    event.preventDefault()
    first.focus()
  }
}

function documentRoute(doc: LoginAgreementDocument) {
  return {
    name: 'LegalDocument',
    params: {
      documentId: doc.id || doc.title,
    },
  }
}

function handleCheckboxChange(event: Event): void {
  const checked = (event.target as HTMLInputElement).checked
  if (checked) {
    emit('accept')
  } else {
    emit('reject')
  }
}

function documentIcon(index: number, title: string): 'document' | 'shield' | 'globe' | 'cog' {
  const normalizedTitle = title.toLowerCase()
  if (
    normalizedTitle.includes('policy') ||
    normalizedTitle.includes('privacy') ||
    title.includes('政策') ||
    title.includes('隐私')
  ) {
    return 'shield'
  }
  if (
    normalizedTitle.includes('country') ||
    normalizedTitle.includes('region') ||
    title.includes('国家') ||
    title.includes('地区')
  ) {
    return 'globe'
  }
  if (index === 3) {
    return 'cog'
  }
  return 'document'
}
</script>

<style scoped>
.agreement-fade-enter-active,
.agreement-fade-leave-active {
  transition: opacity 0.18s ease;
}

.agreement-fade-enter-from,
.agreement-fade-leave-to {
  opacity: 0;
}

.agreement-fade-enter-active > div,
.agreement-fade-leave-active > div {
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.agreement-fade-enter-from > div,
.agreement-fade-leave-to > div {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
</style>
