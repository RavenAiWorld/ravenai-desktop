<script setup lang="ts">
import DesktopShell from '@/desktop/DesktopShell.vue'
defineProps<{ hideHeading?: boolean; fillViewport?: boolean }>()
</script>
<template><DesktopShell :hide-heading="hideHeading" :fill-viewport="fillViewport"><template v-if="$slots.actions" #actions><slot name="actions" /></template><slot /></DesktopShell></template>
