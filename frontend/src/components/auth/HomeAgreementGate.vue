<template>
  <LoginAgreementPrompt
    v-if="enabled"
    :accepted="accepted"
    :documents="documents"
    mode="modal"
    :updated-at="settings?.login_agreement_updated_at"
    :visible="!accepted"
    dialog-only
    @accept="accept"
    @reject="exit"
  />
</template>

<script setup lang="ts">
import { desktopStorage as localStorage } from '@/desktop/storage'

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import LoginAgreementPrompt from '@/components/auth/LoginAgreementPrompt.vue'
import { useAppStore } from '@/stores/app'

const storageKey = 'sub2api_login_agreement_consent'
const appStore = useAppStore()
const settings = computed(() => appStore.cachedPublicSettings)
const documents = computed(() => settings.value?.login_agreement_documents?.filter((doc) => doc.title?.trim()) ?? [])
const enabled = computed(() => settings.value?.login_agreement_enabled === true
  && settings.value?.login_agreement_mode !== 'checkbox'
  && ['service-terms', 'privacy-policy'].every((id) => documents.value.some((doc) => doc.id === id)))
const revision = computed(() => settings.value?.login_agreement_revision
  || `${settings.value?.login_agreement_updated_at || ''}:${documents.value.map((doc) => `${doc.id}:${doc.title}`).join('|')}`)
const accepted = ref(false)

function readConsent(): boolean {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null') as { revision?: string } | null
    return !!revision.value && saved?.revision === revision.value
  } catch {
    return false
  }
}

watch([enabled, revision], () => {
  accepted.value = !enabled.value || readConsent()
}, { immediate: true })

function accept(): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify({
      revision: revision.value,
      accepted_at: new Date().toISOString()
    }))
  } catch {
    // The visitor can proceed for this page; other pages will ask again.
  }
  accepted.value = true
}

function exit(): void {
  try {
    localStorage.removeItem(storageKey)
  } catch {
    // Keep the dialog visible if browser storage is unavailable.
  }
  window.location.replace('about:blank')
}

function syncFromOtherTab(event: StorageEvent): void {
  if (event.key === storageKey || event.key === null) accepted.value = readConsent()
}

onMounted(() => window.addEventListener('storage', syncFromOtherTab))
onBeforeUnmount(() => window.removeEventListener('storage', syncFromOtherTab))
</script>
