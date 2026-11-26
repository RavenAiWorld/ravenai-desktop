<template>
  <section v-if="show" class="card overflow-hidden" :aria-label="title">
    <div class="border-b border-gray-100 px-4 py-4 dark:border-dark-700 sm:px-6">
      <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ title }}</h2>
    </div>
    <div class="p-4 sm:p-6"><slot /></div>
    <div class="border-t border-gray-100 px-4 py-4 dark:border-dark-700 sm:px-6"><slot name="footer" /></div>
  </section>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
defineProps<{ show: boolean; title: string }>()
</script>
