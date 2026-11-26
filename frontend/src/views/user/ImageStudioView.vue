<template>
  <AppLayout hide-heading fill-viewport>
    <iframe
      class="block min-h-0 w-full flex-1 border-0"
      src="/assets/studio/"
      :title="t('imageStudio.title')"
      allow="clipboard-write 'self'"
    />
  </AppLayout>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppLayout from '@/components/layout/AppLayout.vue'

const { t } = useI18n()
</script>
