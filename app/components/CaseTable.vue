<script setup lang="ts">
import type { CaseFile } from '../types/domain'
import { initials, stage, statusSeverity, money } from '../utils/format'
import { nextTask } from '../utils/workflow'
defineProps<{ items: CaseFile[]; compact?: boolean }>()
const { today } = useMockApp()
</script>

<template>
  <DataTable :value="items" data-key="id" :paginator="!compact" :rows="8" :rows-per-page-options="[8, 18]" class="case-table" striped-rows>
    <template #empty><div class="empty-state"><i class="pi pi-search" /><h3>No hay resultados</h3><p>Prueba otros filtros o busca otro cliente.</p></div></template>
    <Column header="CLIENTE / EXPEDIENTE">
      <template #body="{ data }"><NuxtLink :to="`/expedientes/${data.id}`" class="client-cell"><span class="avatar" :class="data.campaign === '720' ? 'lavender' : 'mint'">{{ initials(data.name) }}</span><span><strong>{{ data.name }}</strong><small>{{ data.id }} · {{ data.segment }}</small></span></NuxtLink></template>
    </Column>
    <Column header="CAMPAÑA" field="campaign" sortable><template #body="{ data }"><span class="campaign-badge" :class="{ model: data.campaign === '720' }">{{ data.campaign === '720' ? 'Modelo 720' : 'Renta' }}</span></template></Column>
    <Column header="FASE"><template #body="{ data }"><Tag :value="stage(data)" :severity="statusSeverity(data.tax.state === 'Cerrado' ? 'Cerrado' : data.pbc === 'Incidencia' ? 'Incidencia' : stage(data))" /></template></Column>
    <Column v-if="!compact" header="RESPONSABLE" field="owner" sortable />
    <Column v-if="!compact" header="HONORARIOS"><template #body="{ data }">{{ money(data.fee) }}</template></Column>
    <Column header="SIGUIENTE PASO"><template #body="{ data }"><span class="next-step">{{ nextTask(data, today) }}</span></template></Column>
    <Column header=""><template #body="{ data }"><NuxtLink :to="`/expedientes/${data.id}`" class="open-case" :aria-label="`Abrir expediente de ${data.name}`"><i class="pi pi-arrow-up-right" aria-hidden="true" /></NuxtLink></template></Column>
  </DataTable>
</template>
