<script setup lang="ts">
import type { ActionResult, WorkflowAction } from '../types/domain'
import { daysBetween, stage } from '../utils/format'
import { nextTask } from '../utils/workflow'
const { cases, today, role, signatureEmail, documentReminderDays, act } = useMockApp()
const bucket = ref('Todas')
const feedback = ref<ActionResult | null>(null)
const tasks = computed(() => cases.value.filter(item => !['No interesado', 'Retirado'].includes(item.contact) && item.tax.state !== 'Cerrado').map(item => ({ item, text: nextTask(item, today.value), area: item.extraction.state === 'Incidencia IT' ? 'IT' : item.pbc === 'Incidencia' || item.pbc === 'No apto' ? 'PBC' : !item.opened ? 'Captación' : 'Fiscal' })).filter(task => bucket.value === 'Todas' || task.area === bucket.value))
function evaluate() {
  if (!['Profesional', 'Paralegal', 'Gestor de campañas'].includes(role.value)) { feedback.value = { ok: false, message: 'Solo profesional, paralegal o gestor puede evaluar seguimientos.' }; return }
  const results: ActionResult[] = []
  for (const item of cases.value) {
    if (['No interesado', 'Retirado'].includes(item.contact) || item.tax.state === 'Cerrado') continue
    const actions: WorkflowAction[] = []
    if (!item.opened && !item.reminderAt && daysBetween(item.contactedAt, today.value) >= 7) actions.push({ type: 'remind' })
    if (!item.opened && item.reminderAt && item.contact !== 'Llamada pendiente' && daysBetween(item.reminderAt, today.value) >= 3) actions.push({ type: 'call' })
    if (item.ph.state === 'Enviada' && item.ph.sentAt && daysBetween(item.ph.sentAt, today.value) >= 3) {
      if (!item.ph.followupAt) actions.push({ type: 'ph-call' })
      if (signatureEmail.value && !item.history.some(event => event.text === `Recordatorio de firma PH v${item.ph.version} (simulación).`)) actions.push({ type: 'ph-remind' })
    }
    const since = item.docsRequestedAt ?? item.contactedAt
    if (item.portalSent && !item.docsComplete && daysBetween(since, today.value) >= documentReminderDays.value && item.docsReminderKey !== `${since}:${item.documents.length}`) actions.push({ type: 'docs-remind', afterDays: documentReminderDays.value })
    for (const action of actions) results.push(act(item.id, action))
  }
  const errors = results.filter(result => !result.ok)
  feedback.value = errors.length ? { ok: false, message: errors.map(result => result.message).join(' ') } : { ok: true, message: results.length ? `${results.length} eventos simulados registrados. Reevaluar no duplica avisos; no hay envíos reales.` : 'Ningún seguimiento nuevo vencido. No se ha modificado ningún expediente.' }
}
</script>

<template>
  <section><div class="page-heading"><div><p class="eyebrow">EL SIGUIENTE PASO, CLARO</p><h1>Tareas y seguimiento<span class="heading-dot">.</span></h1><p>Prioridades de negocio, PBC e IT separadas. Reloj demo, nunca envíos reales.</p></div><Button label="Evaluar seguimientos" icon="pi pi-clock" @click="evaluate" /></div><Message v-if="feedback" :severity="feedback.ok ? 'success' : 'error'" role="status" class="feedback">{{ feedback.message }}</Message>
    <div class="filter-bar"><SelectButton v-model="bucket" :options="['Todas', 'Captación', 'Fiscal', 'PBC', 'IT']" :allow-empty="false" /><label class="inline-label"><ToggleSwitch v-model="signatureEmail" aria-label="Recordatorio de firma por correo" />Correo de firma opcional</label><label class="inline-label" for="doc-days">Recordatorio documental<InputNumber v-model="documentReminderDays" input-id="doc-days" :min="1" :max="30" :use-grouping="false" class="small-number" />días</label></div><p class="footnote">Captación: 7 días + 3 adicionales. Firma: llamada a 3 días. Cadencia documental configurable y correo de firma: supuestos de mockup.</p>
    <div class="task-grid"><NuxtLink v-for="task in tasks" :key="task.item.id" :to="`/expedientes/${task.item.id}`" class="task-card"><div class="task-top"><span class="campaign-badge" :class="{ model: task.item.campaign === '720' }">{{ task.item.campaign }}</span><Tag :value="task.area" :severity="task.area === 'IT' || task.area === 'PBC' ? 'danger' : 'secondary'" /></div><h3>{{ task.text }}</h3><p>{{ task.item.name }}<small>{{ task.item.id }} · {{ task.item.owner || 'Sin responsable' }}</small></p><div class="task-footer"><span>{{ stage(task.item) }}</span><i class="pi pi-arrow-up-right" /></div></NuxtLink></div><div v-if="!tasks.length" class="panel empty-state"><i class="pi pi-check-circle" /><h3>Sin tareas en esta bandeja</h3><p>Cambia el filtro para revisar otras áreas.</p></div>
  </section>
</template>
