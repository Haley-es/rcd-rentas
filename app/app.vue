<script setup lang="ts">
const ready = ref(false)
onMounted(() => { ready.value = true })
</script>

<template>
  <div :data-app-ready="ready">
    <NuxtLayout>
      <NuxtPage :page-key="route => route.path" />
    </NuxtLayout>
  </div>
</template>
