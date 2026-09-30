<script setup lang="ts">
import type { ActionResult, CaseFile } from '../types/domain'
import { dateLabel, daysBetween, statusSeverity } from '../utils/format'
const { cases, teams, role, today, inviteMany, setSettings, pending } = useMockApp()
const campaign = ref('Todas')
const segment = ref('Todos los segmentos')
const search = ref('')
const selection = ref<CaseFile[]>([])
const feedback = ref<ActionResult | null>(null)
const filtered = computed(() => cases.value.filter(item => (campaign.value === 'Todas' || item.campaign === campaign.value) && (segment.value === 'Todos los segmentos' || item.segment === segment.value) && item.name.toLowerCase().includes(search.value.toLowerCase())))
const eligible = computed(() => selection.value.filter(item => !item.opened && !['No interesado', 'Retirado'].includes(item.contact) && !item.ph.prior))
async function invite() {
  if (!eligible.value.length) { feedback.value = { ok: false, message: 'Selecciona contactos elegibles sin expediente. No se enviará al 720 con PH previa ni a clientes retirados.' }; return }
  const result = await inviteMany(selection.value.map(item => item.id))
  feedback.value = result
  if (result.ok) selection.value = []
}
</script>

<template>
  <section><div class="page-heading"><div><p class="eyebrow">DEL CONTACTO AL EXPEDIENTE</p><h1>Comunicación<span class="heading-dot">.</span></h1><p>Invita, escucha y acompaña. Cada respuesta queda conectada al expediente.</p></div><Button label="Enviar invitación simulada" icon="pi pi-send" :disabled="!['Profesional', 'Paralegal', 'Gestor de campañas'].includes(role)" @click="invite" /></div>
    <Message v-if="feedback" :severity="feedback.ok ? 'success' : 'error'" class="feedback" role="status">{{ feedback.message }}</Message>
    <div class="stats-grid communication-stats"><div class="stat-card"><div class="stat-top">Contactos en esta vista</div><strong>{{ filtered.length }}</strong><small>Listas ficticias · Ejercicio 2025</small></div><div class="stat-card"><div class="stat-top">Sin respuesta</div><strong>{{ filtered.filter(item => !item.opened && !['No interesado', 'Retirado'].includes(item.contact)).length }}</strong><small>7 días a recordatorio · 3 más a llamada</small></div><div class="stat-card"><div class="stat-top">Aceptaciones</div><strong>{{ filtered.filter(item => item.contact === 'Aceptado').length }}</strong><small>Expediente único por campaña</small></div><div class="stat-card"><div class="stat-top">No interesados / retirados</div><strong>{{ filtered.filter(item => ['No interesado', 'Retirado'].includes(item.contact)).length }}</strong><small>Sin seguimientos automáticos</small></div></div>
    <div class="filter-bar"><IconField><InputIcon class="pi pi-search" /><InputText v-model="search" placeholder="Buscar contacto" aria-label="Buscar contacto" /></IconField><SelectButton v-model="campaign" :options="['Todas', 'Renta', '720']" :allow-empty="false" /><Select v-model="segment" :options="['Todos los segmentos', 'Nuevo cliente', 'Cliente recurrente']" aria-label="Segmento" /><label class="inline-label"><ToggleSwitch :model-value="teams" :disabled="pending" aria-label="Avisos Teams simulados" @update:model-value="value => setSettings({ teams: value })" />Teams simulado</label></div>
    <section class="panel table-panel"><DataTable v-model:selection="selection" :value="filtered" data-key="id" paginator :rows="10"><template #empty><p class="empty-note">No hay contactos con estos filtros.</p></template><Column selection-mode="multiple" header-style="width: 3rem" /><Column header="CLIENTE"><template #body="{ data }"><NuxtLink :to="`/expedientes/${data.id}`" class="client-cell"><span><strong>{{ data.name }}</strong><small>{{ data.email }}</small></span></NuxtLink></template></Column><Column header="CAMPAÑA"><template #body="{ data }"><span class="campaign-badge" :class="{ model: data.campaign === '720' }">{{ data.campaign }}</span></template></Column><Column field="segment" header="SEGMENTO" /><Column header="RESPUESTA"><template #body="{ data }"><Tag :value="data.contact" :severity="statusSeverity(data.contact)" /></template></Column><Column header="ÚLTIMO ENVÍO"><template #body="{ data }"><span>{{ dateLabel(data.reminderAt || data.contactedAt) }}</span><small class="table-small">{{ daysBetween(data.reminderAt || data.contactedAt, today) }} días demo</small></template></Column><Column header=""><template #body="{ data }"><NuxtLink :to="`/portal/${data.id}?token=demo-${data.id}`" class="text-link">{{ !data.opened ? 'Simular respuesta' : 'Ver portal' }}<i class="pi pi-arrow-up-right" /></NuxtLink></template></Column></DataTable></section>
    <p class="footnote">720 con PH previa conserva antecedentes y acceso directo: no recibe nueva captación, PH ni alta automática. Selección elegible: {{ eligible.length }}.</p>
  </section>
</template>
