<script setup lang="ts">
import type { ActionResult, WorkflowAction } from '../../types/domain'
const route = useRoute()
const { portalSnapshot, actPortal, uploadDocument, setRole, pending, synchronized } = useMockApp()
const id = computed(() => String(route.params.id))
const validLink = computed(() => route.query.token === `demo-${id.value}`)
const expediente = computed(() => validLink.value ? portalSnapshot.value?.case : undefined)
const feedback = ref<ActionResult | null>(null)
async function perform(action: WorkflowAction) {
  const result = await actPortal(id.value, action)
  feedback.value = result
  return result
}
async function back() { if ((await setRole('Profesional')).ok) await navigateTo(`/expedientes/${id.value}`) }
async function upload(file: File, kind: string) {
  const result = await uploadDocument(id.value, file, kind, true)
  feedback.value = result
  return result
}
</script>

<template>
  <div class="portal-page"><div class="portal-tools"><Button label="Volver a gestión demo" icon="pi pi-arrow-left" text severity="secondary" :disabled="pending || !synchronized" @click="back" /><span>Vista exclusiva de este cliente · Acceso ficticio, no autenticación real</span></div><Message v-if="!expediente" severity="error" role="alert">Enlace inválido o expirado. No se muestran datos de ningún cliente. Solicita un nuevo acceso al profesional.</Message><template v-else><div v-if="feedback" role="status" aria-live="polite" class="feedback"><Message :severity="feedback.ok ? 'success' : 'error'">{{ feedback.message }}</Message></div><ClientPortal v-if="portalSnapshot" :expediente="expediente" :capabilities="portalSnapshot.capabilities" :perform="perform" :upload="upload" :pending="pending" /></template></div>
</template>
