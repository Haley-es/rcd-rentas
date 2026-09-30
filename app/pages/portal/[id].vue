<script setup lang="ts">
import type { ActionResult, WorkflowAction } from '../../types/domain'
const route = useRoute()
const { cases, act, role } = useMockApp()
const id = computed(() => String(route.params.id))
const validLink = computed(() => route.query.token === `demo-${id.value}`)
const expediente = computed(() => validLink.value ? cases.value.find(item => item.id === id.value) : undefined)
const feedback = ref<ActionResult | null>(null)
function perform(action: WorkflowAction) {
  feedback.value = act(id.value, action, 'Cliente')
}
function back() { role.value = 'Profesional'; navigateTo(`/expedientes/${id.value}`) }
</script>

<template>
  <div class="portal-page"><div class="portal-tools"><Button label="Volver a gestión demo" icon="pi pi-arrow-left" text severity="secondary" @click="back" /><span>Vista exclusiva de este cliente · Acceso ficticio, no autenticación real</span></div><Message v-if="!expediente" severity="error" role="alert">Enlace inválido o expirado. No se muestran datos de ningún cliente. Solicita un nuevo acceso al profesional.</Message><template v-else><div v-if="feedback" role="status" aria-live="polite" class="feedback"><Message :severity="feedback.ok ? 'success' : 'error'">{{ feedback.message }}</Message></div><ClientPortal :expediente="expediente" @action="perform" /></template></div>
</template>
