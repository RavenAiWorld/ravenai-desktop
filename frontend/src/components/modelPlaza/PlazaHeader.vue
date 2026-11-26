<!-- Copyright (C) 2023-2026 QuantumNous. AGPL-3.0-or-later.
     Port of New API 6f23339 pricing/index.tsx and search-bar.tsx; see THIRD_PARTY_NOTICES.md. -->
<template>
  <header class="plaza-heading" :class="{ embedded }">
    <h1>{{ t('modelPlaza.title') }}</h1>
    <p>{{ t('modelPlaza.catalogTotal', { count: modelCount }) }}</p>
    <div class="catalog-meta"><span>{{ t('modelPlaza.groupCount', { count: groupCount }) }}</span><span aria-hidden="true">·</span><span>{{ t('modelPlaza.vendorCount', { count: vendorCount }) }}</span><span aria-hidden="true">·</span><span>USD</span></div>
    <div class="plaza-search-wrap">
      <Icon name="search" size="sm" class="search-icon" />
      <input ref="searchInput" v-model="query" type="search" autocomplete="off" spellcheck="false" :placeholder="t('modelPlaza.toolbar.searchPlaceholder')" :aria-label="t('modelPlaza.toolbar.searchPlaceholder')" class="plaza-search" />
      <button v-if="query" type="button" class="search-clear" :title="t('modelPlaza.toolbar.clearSearch')" :aria-label="t('modelPlaza.toolbar.clearSearch')" @click="query = ''"><Icon name="x" size="sm" /></button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Icon from '@/components/icons/Icon.vue'
defineProps<{ embedded?: boolean; modelCount: number; groupCount: number; vendorCount: number }>()
const query = defineModel<string>('query', { required: true })
const { t } = useI18n()
const searchInput = ref<HTMLInputElement | null>(null)
function focusSearch(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !document.querySelector('[aria-modal="true"]')) {
    event.preventDefault()
    searchInput.value?.focus()
  }
  if (event.key === 'Escape' && document.activeElement === searchInput.value) searchInput.value?.blur()
}
onMounted(() => document.addEventListener('keydown', focusSearch))
onBeforeUnmount(() => document.removeEventListener('keydown', focusSearch))
</script>

<style scoped>
.plaza-heading { @apply mx-auto flex max-w-3xl flex-col items-center pb-10 pt-10 text-center; }
.plaza-heading h1 { margin: 0; font-size: 56px; font-weight: 700; line-height: 1.15; color: var(--plaza-foreground); }
.plaza-heading > p { @apply mt-4 text-base; color: color-mix(in oklch, var(--plaza-muted-foreground) 80%, transparent); }
.catalog-meta { @apply mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-sm leading-relaxed; color: color-mix(in oklch, var(--plaza-muted-foreground) 60%, transparent); }
.plaza-search-wrap { @apply relative mt-6 w-full max-w-2xl; }
.plaza-search { @apply h-10 w-full border pl-10 pr-10 text-sm transition-colors focus:outline-none; border-radius: var(--plaza-radius); border-color: var(--plaza-border); background: var(--plaza-background); color: var(--plaza-foreground); }
.plaza-search::placeholder { color: color-mix(in oklch, var(--plaza-muted-foreground) 50%, transparent); }
.plaza-search:focus { border-color: var(--plaza-primary); box-shadow: 0 0 0 2px color-mix(in oklch, var(--plaza-primary) 20%, transparent); }
.plaza-search { text-overflow: ellipsis; }
.plaza-search::-webkit-search-cancel-button { display: none; }
.search-icon { @apply pointer-events-none absolute left-3.5 top-3 text-gray-400; }
.search-clear { @apply absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center text-gray-400; border-radius: var(--plaza-radius-md); }
.search-clear:hover { background: var(--plaza-muted); }
.embedded { @apply pb-7 pt-1; }
.embedded h1 { font-size: 32px; }
@media (max-width: 639px) { .plaza-heading { @apply pb-5 pt-5; } .plaza-heading h1 { font-size: 32px; } .plaza-heading > p { @apply mt-3 text-sm; } .catalog-meta { @apply text-xs; } .plaza-search-wrap { @apply mt-4; } .plaza-search { font-size: 16px; } }
</style>
