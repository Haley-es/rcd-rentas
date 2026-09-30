<script setup lang="ts">
import type { ActionResult } from '../types/domain'
import { stage } from '../utils/format'
import { nextTask } from '../utils/workflow'
const { cases, today, signatureEmail, documentReminderDays, evaluateFollowups, setSettings, pending } = useMockApp()
const bucket = ref('Todas')
const feedback = ref<ActionResult | null>(null)
const tasks = computed(() => cases.value.filter(item => !['No interesado', 'Retirado'].includes(item.contact) && item.tax.state !== 'Cerrado').map(item => ({ item, text: nextTask(item, today.value), area: item.extraction.state === 'Incidencia IT' ? 'IT' : item.pbc === 'Incidencia' || item.pbc === 'No apto' ? 'PBC' : !item.opened ? 'Captación' : 'Fiscal' })).filter(task => bucket.value === 'Todas' || task.area === bucket.value))
async function evaluate() { feedback.value = await evaluateFollowups() }
async function changeReminderDays(value: number | null) { feedback.value = await setSettings({ documentReminderDays: value ?? 0 }) }
</script>

<template>
  <section><div class="page-heading"><div><p class="eyebrow">EL SIGUIENTE PASO, CLARO</p><h1>Tareas y seguimiento<span class="heading-dot">.</span></h1><p>Prioridades de negocio, PBC e IT separadas. Reloj demo, nunca envíos reales.</p></div><Button label="Evaluar seguimientos" icon="pi pi-clock" @click="evaluate" /></div><Message v-if="feedback" :severity="feedback.ok ? 'success' : 'error'" role="status" class="feedback">{{ feedback.message }}</Message>
    <div class="filter-bar"><SelectButton v-model="bucket" :options="['Todas', 'Captación', 'Fiscal', 'PBC', 'IT']" :allow-empty="false" /><label class="inline-label"><ToggleSwitch :model-value="signatureEmail" :disabled="pending" aria-label="Recordatorio de firma por correo" @update:model-value="value => setSettings({ signatureEmail: value })" />Correo de firma opcional</label><label class="inline-label" for="doc-days">Recordatorio documental<InputNumber :model-value="documentReminderDays" input-id="doc-days" :min="1" :max="30" :use-grouping="false" class="small-number" :disabled="pending" @update:model-value="changeReminderDays" />días</label></div><p class="footnote">Captación: 7 días + 3 adicionales. Firma: llamada a 3 días. Cadencia documental configurable y correo de firma: supuestos de mockup.</p>
    <div class="task-grid"><NuxtLink v-for="task in tasks" :key="task.item.id" :to="`/expedientes/${task.item.id}`" class="task-card"><div class="task-top"><span class="campaign-badge" :class="{ model: task.item.campaign === '720' }">{{ task.item.campaign }}</span><Tag :value="task.area" :severity="task.area === 'IT' || task.area === 'PBC' ? 'danger' : 'secondary'" /></div><h3>{{ task.text }}</h3><p>{{ task.item.name }}<small>{{ task.item.id }} · {{ task.item.owner || 'Sin responsable' }}</small></p><div class="task-footer"><span>{{ stage(task.item) }}</span><i class="pi pi-arrow-up-right" /></div></NuxtLink></div><div v-if="!tasks.length" class="panel empty-state"><i class="pi pi-check-circle" /><h3>Sin tareas en esta bandeja</h3><p>Cambia el filtro para revisar otras áreas.</p></div>
  </section>
</template>
