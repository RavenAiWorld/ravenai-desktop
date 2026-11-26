<template>
  <!-- 登录后默认使用后台布局。 -->
  <AppLayout v-if="isEmbedded" class="model-plaza-shell">
    <ModelPlazaContent
      :response="data"
      :loading="loading"
      :error="loadFailed"
      :fetched-at="fetchedAt"
      embedded
      @refresh="load"
    />
  </AppLayout>

  <!-- 独立形态：与首页共用站点顶栏和页脚 -->
  <div v-else class="model-plaza-public newapi-plaza flex min-h-screen flex-col">
    <PublicHeader active="plaza" />
    <main class="mx-auto w-full max-w-[1600px] flex-1 px-4 pb-10 pt-6 sm:px-6 xl:px-8">
      <ModelPlazaContent
        :response="data"
        :loading="loading"
        :error="loadFailed"
        :fetched-at="fetchedAt"
        @refresh="load"
      />
    </main>
    <PublicFooter />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import PublicHeader from '@/components/layout/PublicHeader.vue'
import PublicFooter from '@/components/layout/PublicFooter.vue'
import ModelPlazaContent from '@/components/modelPlaza/ModelPlazaContent.vue'
import { useModelPlaza } from '@/composables/useModelPlaza'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const appStore = useAppStore()
const authStore = useAuthStore()

// 公开链接与显式 standalone 参数使用独立形态。
const isEmbedded = computed(() => authStore.isAuthenticated && route.query.standalone !== '1')

const { data, loading, loadFailed, fetchedAt, load } = useModelPlaza()

onMounted(() => {
  void appStore.fetchPublicSettings()
})
</script>

<style scoped>
.model-plaza-public { background: rgb(var(--rv-canvas)); }
.model-plaza-shell :deep(.bg-mesh-gradient) { display: none; }
</style>
