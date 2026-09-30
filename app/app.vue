<script setup lang="ts">
const ready = ref(false)
const { session } = usePrototypeAuth()
const { ready: stateReady, loading, error, refresh } = useMockApp()
const router = useRouter()
const access = computed(() => ['/login', '/mfa'].includes(router.currentRoute.value.path))
function focus() { if (session.value.authenticated && !access.value) void refresh() }
onMounted(() => { ready.value = true; window.addEventListener('focus', focus) })
onBeforeUnmount(() => { window.removeEventListener('focus', focus) })
</script>

<template>
  <div :data-app-ready="ready">
    <NuxtLayout v-if="access || session.authenticated">
      <NuxtPage v-if="access || stateReady" :page-key="route => route.path" />
      <div v-else class="page-content">
        <p v-if="loading" role="status">Consultando estado en SQL Server...</p>
        <Button label="Reintentar sincronización" :disabled="loading" @click="refresh()" />
      </div>
    </NuxtLayout>
  </div>
</template>
