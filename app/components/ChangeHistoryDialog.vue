<script setup lang="ts">
const visible = defineModel<boolean>('visible', { default: false })
const props = defineProps<{ caseId: string; name: string }>()
const { entries, loading, error, load } = useChangeHistory()
const { revision } = useMockApp()
watch([visible, () => props.caseId, revision], () => {
  if (visible.value) void load({ recordId: props.caseId })
  else entries.value = []
})
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="`Cambios de ${name} · ${caseId}`" :style="{ width: '1100px', maxWidth: 'calc(100vw - 24px)' }">
    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
    <ChangeHistoryTable v-else :entries="entries" :loading="loading" />
    <template #footer><Button label="Actualizar cambios" icon="pi pi-refresh" severity="secondary" :loading="loading" @click="load({ recordId: caseId })" /><Button label="Cerrar" severity="secondary" @click="visible = false" /></template>
  </Dialog>
</template>
