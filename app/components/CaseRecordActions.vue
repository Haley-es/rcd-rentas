<script setup lang="ts">
import { canManageDeletedCases } from '../../shared/utils/prototype-history'
const props = defineProps<{ caseId: string; name: string; labelled?: boolean }>()
const { deleteCase, role, pending, synchronized } = useMockApp()
const route = useRoute()
const historyVisible = ref(false)
const deleteVisible = ref(false)
const error = ref('')
async function remove() {
  const result = await deleteCase(props.caseId)
  if (!result.ok) { error.value = result.message; return }
  deleteVisible.value = false
  if (route.path === `/expedientes/${props.caseId}`) await navigateTo('/expedientes')
}
</script>

<template>
  <span class="record-actions">
    <Button :label="labelled ? 'Mostrar cambios' : undefined" icon="pi pi-history" text size="small" :aria-label="labelled ? 'Mostrar cambios' : `Mostrar cambios de ${caseId}`" @click="historyVisible = true" />
    <Button v-if="canManageDeletedCases(role)" :label="labelled ? 'Enviar a papelera' : undefined" icon="pi pi-trash" text size="small" severity="danger" :aria-label="`Enviar ${caseId} a papelera`" :disabled="pending || !synchronized" @click="deleteVisible = true; error = ''" />
    <ChangeHistoryDialog v-model:visible="historyVisible" :case-id="caseId" :name="name" />
    <Dialog v-model:visible="deleteVisible" modal header="Enviar expediente a papelera" :style="{ width: '460px', maxWidth: 'calc(100vw - 24px)' }" :closable="!pending">
      <p>¿Enviar <strong>{{ name }} · {{ caseId }}</strong> a la papelera?</p>
      <p>Dejará de aparecer en gestión y su portal quedará inaccesible. Se conservan datos, historial y archivos para restaurarlo con su ID original.</p>
      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
      <template #footer><Button label="Cancelar" severity="secondary" :disabled="pending" @click="deleteVisible = false" /><Button label="Confirmar eliminación" icon="pi pi-trash" severity="danger" :loading="pending" :disabled="!synchronized" @click="remove" /></template>
    </Dialog>
  </span>
</template>

<style scoped>
.record-actions { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 4px; }
</style>
