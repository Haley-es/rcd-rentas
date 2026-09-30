<script setup lang="ts">
import { stage } from '../../utils/format'
import { downloadDemo } from '../../utils/download'
const { cases } = useMockApp()
const search = ref('')
const campaign = ref('Todas')
const phase = ref('Todas las fases')
const owner = ref('Todo el equipo')
const phases = computed(() => ['Todas las fases', ...new Set(cases.value.map(stage))])
const owners = computed(() => ['Todo el equipo', ...new Set(cases.value.map(item => item.owner))])
const filtered = computed(() => cases.value.filter(item => [item.name, item.id, item.email].some(value => value.toLowerCase().includes(search.value.toLowerCase())) && (campaign.value === 'Todas' || item.campaign === campaign.value) && (phase.value === 'Todas las fases' || stage(item) === phase.value) && (owner.value === 'Todo el equipo' || item.owner === owner.value)))
function exportCases() {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
  downloadDemo('expedientes-demo.csv', '\uFEFF' + [['ID', 'Cliente ficticio', 'Campaña', 'Fase', 'Responsable'], ...filtered.value.map(item => [item.id, item.name, item.campaign, stage(item), item.owner])].map(row => row.map(quote).join(';')).join('\n'), 'text/csv;charset=utf-8')
}
</script>

<template>
  <section><div class="page-heading"><div><p class="eyebrow">GESTIÓN INTERNA</p><h1>Expedientes<span class="heading-dot">.</span></h1><p>Un lugar para cada cliente. Visibilidad para todo el equipo.</p></div><Button label="Exportar vista" icon="pi pi-download" severity="secondary" outlined @click="exportCases" /></div><div class="filter-bar"><IconField><InputIcon class="pi pi-search" /><InputText v-model="search" placeholder="Buscar cliente, email o expediente" aria-label="Buscar expediente" /></IconField><SelectButton v-model="campaign" :options="['Todas', 'Renta', '720']" :allow-empty="false" aria-label="Filtrar campaña" /><Select v-model="phase" :options="phases" aria-label="Filtrar fase" /><Select v-model="owner" :options="owners" aria-label="Filtrar responsable" /><span class="filter-count">{{ filtered.length }} expedientes</span></div><section class="panel table-panel"><CaseTable :items="filtered" /></section><p class="footnote">18 escenarios de demostración. Nombres, correos y documentos ficticios.</p></section>
</template>
