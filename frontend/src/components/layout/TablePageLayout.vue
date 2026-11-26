<template>
  <div class="table-page-layout" :class="{ 'mobile-mode': isMobile }">
    <div v-if="$slots.actions" class="layout-section-fixed layout-actions">
      <slot name="actions" />
    </div>

    <div v-if="$slots.filters" class="layout-section-fixed layout-filters">
      <slot name="filters" />
    </div>

    <!-- The table follows its rows; large lists keep a bounded scroll viewport. -->
    <div class="layout-section-scrollable">
      <div class="card table-scroll-container">
        <slot name="table" />
      </div>
    </div>

    <div v-if="$slots.pagination" class="layout-section-fixed layout-pagination">
      <slot name="pagination" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const isMobile = ref(false)

const checkMobile = () => {
  isMobile.value = window.innerWidth < 1024
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<style scoped>
.table-page-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px 16px;
  height: auto;
}
.layout-section-fixed { min-width: 0; }
.layout-actions { grid-column: 2; grid-row: 1; align-self: start; }
.layout-filters { grid-column: 1; grid-row: 1; }
.layout-pagination { grid-column: 1 / -1; }

.layout-section-scrollable {
  @apply min-h-0 min-w-0;
  grid-column: 1 / -1;
}

.table-scroll-container {
  @apply flex flex-col overflow-hidden rounded-xl border border-rv-line bg-rv-surface;
  box-shadow: var(--rv-shadow-sm);
}

.table-scroll-container :deep(.table-wrapper) {
  @apply overflow-x-auto overflow-y-auto;
  flex: 0 1 auto;
  max-height: max(360px, calc(100dvh - 290px));
  scrollbar-gutter: auto;
}

.table-scroll-container :deep(table) {
  @apply w-full;
  min-width: 100%;
  display: table;
}

.table-scroll-container :deep(th) {
  @apply px-3 text-left text-xs font-medium text-rv-fg-3;
}

.table-scroll-container :deep(td) {
  @apply px-3 text-sm text-rv-fg-2;
}

/* 移动端：恢复正常滚动 */
.table-page-layout.mobile-mode { grid-template-columns: minmax(0, 1fr); gap: 12px; }
.mobile-mode .layout-actions, .mobile-mode .layout-filters { grid-column: 1; grid-row: auto; }
.mobile-mode .layout-actions { order: 1; }
.mobile-mode .layout-filters { order: 2; }
.mobile-mode .layout-section-scrollable { order: 3; }
.mobile-mode .layout-pagination { order: 4; }
.table-page-layout.mobile-mode .table-scroll-container {
  @apply h-auto overflow-visible rounded-none border-none bg-transparent;
  box-shadow: none;
}

.table-page-layout.mobile-mode .layout-section-scrollable {
  @apply flex-none min-h-fit;
}

.table-page-layout.mobile-mode .table-scroll-container :deep(table) {
  @apply flex-none;
  display: table;
  min-width: 100%;
}
.table-page-layout.mobile-mode .table-scroll-container :deep(.table-wrapper) { max-height: none; }
</style>
