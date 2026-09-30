<script setup lang="ts">
import { roles } from '../types/domain'
import { dateLabel } from '../utils/format'
const { role, today, advanceDays, reset } = useMockApp()
const route = useRoute()
const mobileMenu = ref(false)
const resetDialog = ref(false)
const links = [
  { to: '/', icon: 'pi pi-th-large', text: 'Vista general' },
  { to: '/expedientes', icon: 'pi pi-folder', text: 'Expedientes' },
  { to: '/campanas', icon: 'pi pi-send', text: 'Comunicación' },
  { to: '/tareas', icon: 'pi pi-check-square', text: 'Tareas y seguimiento' },
]
const portal = computed(() => route.path.startsWith('/portal/'))
watch(role, (value) => {
  if (value === 'Cliente' && !portal.value) {
    const id = 'DEMO-R08'
    navigateTo(`/portal/${id}?token=demo-${id}`)
  }
})
</script>

<template>
  <div v-if="portal" class="portal-layout">
    <div class="demo-ribbon">DEMO INTERACTIVA · Datos ficticios · Sin envíos, firma ni presentación real</div>
    <main><slot /></main>
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
        <div class="user-card"><span class="avatar">LT</span><div>Lucía Torres<small>Equipo fiscal · Demo</small></div><i class="pi pi-ellipsis-h" aria-hidden="true" /></div>
      </div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <Button class="menu-button" icon="pi pi-bars" text aria-label="Abrir navegación" @click="mobileMenu = !mobileMenu" />
        <div class="breadcrumb"><span>Campañas fiscales</span><i class="pi pi-angle-right" aria-hidden="true" /><strong>Ejercicio 2025</strong></div>
        <div class="topbar-right"><span class="demo-pill"><span />Entorno de demostración</span><span class="topbar-avatar">LT</span></div>
      </header>
      <div class="simulation-bar">
        <span><i class="pi pi-flask" aria-hidden="true" />Sin BD ni integraciones. Cambios en memoria; recargar reinicia la demo.</span>
        <div class="simulation-controls"><label for="demo-role">Simular rol</label><Select v-model="role" input-id="demo-role" aria-label="Simular rol" :options="roles" size="small" /><span class="sim-date">{{ dateLabel(today) }}</span><Button label="+1 día" severity="secondary" size="small" text @click="advanceDays(1)" /><Button icon="pi pi-refresh" severity="secondary" size="small" text aria-label="Reiniciar demo" @click="resetDialog = true" /></div>
      </div>
      <main id="main" class="page-content"><slot /></main>
      <footer class="app-footer"><span>RCD · Campañas fiscales</span><span>Prototipo · Ejercicio y plazos ilustrativos, no asesoramiento fiscal</span></footer>
    </div>
    <Dialog v-model:visible="resetDialog" modal header="Reiniciar demostración" :style="{ width: '420px' }">
      <p>Se perderán los cambios de esta sesión y se restaurarán los 18 escenarios ficticios.</p>
      <template #footer><Button label="Cancelar" severity="secondary" @click="resetDialog = false" /><Button label="Reiniciar demo" @click="reset(); resetDialog = false" /></template>
    </Dialog>
  </div>
</template>
