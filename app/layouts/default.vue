<script setup lang="ts">
import { roles } from '../types/domain'
import { dateLabel } from '../utils/format'
const { role, today, advanceDays, reset, setRole, pending: mutationPending, synchronized, error: stateError, refresh } = useMockApp()
const dateText = computed(() => today.value ? dateLabel(today.value) : 'Sin sincronizar')
const { session, logout, pending, error } = usePrototypeAuth()
const username = computed(() => session.value.authenticated ? session.value.user.username : '')
const { accessRole, isAdminIT } = useAccessRole()
const route = useRoute()
const mobileMenu = ref(false)
const resetDialog = ref(false)
const resetFeedback = ref('')
const links = computed(() => [
  { to: '/', icon: 'pi pi-th-large', text: 'Vista general' },
  { to: '/expedientes', icon: 'pi pi-folder', text: 'Expedientes' },
  { to: '/campanas', icon: 'pi pi-send', text: 'Comunicación' },
  { to: '/tareas', icon: 'pi pi-check-square', text: 'Tareas y seguimiento' },
  { to: '/registro-cambios', icon: 'pi pi-history', text: 'Registro de cambios' },
  ...(isAdminIT.value ? [{ to: '/papelera', icon: 'pi pi-trash', text: 'Papelera' }] : []),
])
const portal = computed(() => route.path.startsWith('/portal/'))
async function changeRole(value: import('../types/domain').Role) {
  const result = await setRole(value)
  if (result.ok && value === 'Cliente' && !portal.value) {
    const id = 'DEMO-R08'
    navigateTo(`/portal/${id}?token=demo-${id}`)
  }
}
async function confirmReset() { const result = await reset(); resetFeedback.value = result.message; if (result.ok) resetDialog.value = false }
</script>

<template>
  <div v-if="portal" class="portal-layout">
    <div class="demo-ribbon">DEMO INTERACTIVA · No producción · Datos ficticios · MFA simulado</div>
    <div class="prototype-access"><span>Usuario demo: {{ username }} · Identidad no verificada</span><Button label="Cerrar sesión" severity="secondary" :disabled="pending" @click="logout" /></div>
    <Message v-if="error && !stateError" severity="error" role="alert">{{ error }}</Message>
    <Message v-if="stateError" severity="error" role="alert">{{ stateError }}</Message>
    <Button v-if="stateError" label="Reintentar sincronización" :disabled="mutationPending" @click="refresh()" />
    <main><fieldset class="prototype-actions" :disabled="mutationPending || !synchronized"><slot /></fieldset></main>
  </div>
  <div v-else class="app-layout">
    <a href="#main" class="skip-link">Saltar al contenido</a>
    <aside class="sidebar" :class="{ 'is-open': mobileMenu }">
      <NuxtLink to="/" class="brand"><span class="brand-symbol">r.</span><span>RCD<span class="brand-sub">LEGAL · TAX</span></span></NuxtLink>
      <div class="workspace"><span class="workspace-mark">CF</span><div>Campañas fiscales<small>Espacio de trabajo</small></div><i class="pi pi-angle-down" aria-hidden="true" /></div>
      <p class="nav-caption">GESTIÓN DE CAMPAÑAS</p>
      <nav aria-label="Navegación principal">
        <NuxtLink v-for="link in links" :key="link.to" :to="link.to" :class="{ active: link.to === '/' ? route.path === '/' : route.path.startsWith(link.to) }" @click="mobileMenu = false"><i :class="link.icon" aria-hidden="true" />{{ link.text }}</NuxtLink>
      </nav>
      <div class="sidebar-bottom">
        <div class="help-card"><i class="pi pi-sparkles" aria-hidden="true" /><strong>Todo bajo control.</strong><p>Una campaña, un espacio.<br>Del primer contacto al cierre.</p><span>Prototipo de producto</span></div>
        <div class="user-card"><span class="avatar"><i class="pi pi-user" aria-hidden="true" /></span><div>{{ username }}<small>{{ accessRole }}</small></div></div>
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <Button class="menu-button" icon="pi pi-bars" text aria-label="Abrir navegación" @click="mobileMenu = !mobileMenu" />
        <div class="breadcrumb"><span>Campañas fiscales</span><i class="pi pi-angle-right" aria-hidden="true" /><strong>Ejercicio 2025</strong></div>
        <div class="topbar-right"><span class="demo-pill"><span />No producción · MFA simulado</span><span class="prototype-username">Usuario demo: {{ username }}</span><Button label="Cerrar sesión" severity="secondary" :disabled="pending" @click="logout" /></div>
      </header>
      <div class="simulation-bar">
        <span><i class="pi pi-flask" aria-hidden="true" />SQL Server y archivos privados locales reales · Identidad/MFA ficticios · NAV/Criteria/correo/firma/extractor simulados.</span>
        <div class="simulation-controls"><label for="demo-role">Simular rol</label><Select :model-value="role" input-id="demo-role" aria-label="Simular rol" :options="roles" size="small" :disabled="mutationPending || !synchronized" @update:model-value="changeRole" /><span class="sim-date">{{ dateText }}</span><Button label="+1 día" severity="secondary" size="small" text :disabled="mutationPending || !synchronized" @click="advanceDays(1)" /><Button icon="pi pi-refresh" severity="secondary" size="small" text aria-label="Reiniciar demo" :disabled="mutationPending || !synchronized" @click="resetDialog = true" /></div>
      </div>
      <Message v-if="error && !stateError" severity="error" role="alert">{{ error }}</Message>
      <Message v-if="stateError" severity="error" role="alert">{{ stateError }}</Message>
      <Message v-if="resetFeedback" severity="warn" role="status">{{ resetFeedback }}</Message>
      <Button v-if="stateError" label="Reintentar sincronización" :disabled="mutationPending" @click="refresh()" />
      <main id="main" class="page-content"><fieldset class="prototype-actions" :disabled="mutationPending || !synchronized"><slot /></fieldset></main>
      <footer class="app-footer"><span>RCD · Campañas fiscales</span><span>Prototipo · Ejercicio y plazos ilustrativos, no asesoramiento fiscal</span></footer>
    </div>
    <Dialog v-model:visible="resetDialog" modal header="Reiniciar demostración" :style="{ width: '420px' }">
      <p>Se perderán todos los cambios persistentes y archivos locales compartidos, incluidos los de otros usuarios, y se restaurarán los 18 escenarios ficticios y ajustes iniciales. La sesión de acceso se conserva. Cancelar no elimina nada.</p>
      <template #footer><Button label="Cancelar" severity="secondary" :disabled="mutationPending" @click="resetDialog = false" /><Button label="Reiniciar demo" :disabled="mutationPending || !synchronized" @click="confirmReset" /></template>
    </Dialog>
  </div>
</template>

<style scoped>
.prototype-actions { border: 0; margin: 0; padding: 0; min-width: 0; }
.prototype-access { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding: 12px 20px; background: #fff; }
.prototype-access span, .prototype-username { overflow-wrap: anywhere; min-width: 0; font-size: 11px; }
@media (max-width: 600px) {
  .topbar-right { flex-wrap: wrap; justify-content: flex-end; gap: 6px; min-width: 0; }
  .prototype-username { max-width: 140px; }
}
</style>
