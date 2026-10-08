<script setup lang="ts">
import type { PrototypeHistoryEntry } from '../../shared/types/prototype-history'
import { flattenHistoryValues, historyDateLabel, historyFieldLabel, historyValueLabel } from '../../shared/utils/prototype-history'
const { isAdminIT } = useAccessRole()
const { entries, loading, error, load } = useChangeHistory()
const { revision, datasetId, role, restoreCase, refresh, pending, synchronized } = useMockApp()
const search = ref('')
const selected = ref<PrototypeHistoryEntry | null>(null)
const restoreTarget = ref<PrototypeHistoryEntry | null>(null)
const feedback = ref<{ ok: boolean; message: string } | null>(null)
const filtered = computed(() => {
  const terms = search.value.toLocaleLowerCase('es').split(/\s+/).filter(Boolean)
  return entries.value.filter(entry => terms.every(term => [entry.recordId, entry.recordLabel, entry.changedBy,
    entry.changedRole, JSON.stringify(entry.snapshot)].join(' ').toLocaleLowerCase('es').includes(term)))
})
const detailRows = computed(() => selected.value?.snapshot ? Object.entries(flattenHistoryValues(selected.value.snapshot))
  .map(([field, value]) => ({ field: historyFieldLabel(field), value: historyValueLabel(value) })) : [])
watch([revision, datasetId, role, isAdminIT], () => { selected.value = null; restoreTarget.value = null; if (isAdminIT.value) void load({ trash: true }) }, { immediate: true })
async function reload() { if (await refresh()) await load({ trash: true }) }
async function restore() {
  if (!restoreTarget.value || !isAdminIT.value) return
  feedback.value = await restoreCase(restoreTarget.value.id)
  if (feedback.value.ok) { restoreTarget.value = null; selected.value = null; await load({ trash: true }) }
}
</script>

<template>
  <section v-if="isAdminIT">
    <div class="page-heading"><div><p class="eyebrow">RECUPERACIÓN</p><h1>Papelera<span class="heading-dot">.</span></h1><p>Expedientes eliminados. Consulta sus datos y restaura el registro original.</p></div><Button label="Actualizar" icon="pi pi-refresh" severity="secondary" :loading="loading" @click="reload" /></div>
    <div class="filter-bar"><IconField class="trash-search"><InputIcon class="pi pi-search" /><InputText v-model="search" placeholder="Buscar en todos los campos" aria-label="Buscar en papelera" /></IconField><span role="status">{{ filtered.length }} {{ filtered.length === 1 ? 'registro eliminado' : 'registros eliminados' }}</span></div>
    <Message v-if="feedback" :severity="feedback.ok ? 'success' : 'error'" :closable="false" role="status">{{ feedback.message }}</Message>
    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
    <section v-else class="panel table-panel">
      <DataTable :value="filtered" :loading="loading" data-key="id" striped-rows scrollable paginator :rows="10">
        <template #empty><div class="empty-state"><i class="pi pi-trash" aria-hidden="true" /><h3>No hay registros eliminados</h3></div></template>
        <Column header="Registro"><template #body="{ data }"><Tag value="Expediente" severity="secondary" /><strong class="record-name">{{ data.recordLabel }}</strong></template></Column>
        <Column field="recordId" header="ID original" sortable />
        <Column field="changedBy" header="Eliminado por" sortable />
        <Column field="changedAt" header="Fecha" sortable><template #body="{ data }">{{ historyDateLabel(data.changedAt) }}</template></Column>
        <Column header="Acciones"><template #body="{ data }"><div class="trash-actions"><Button icon="pi pi-eye" text :aria-label="`Ver datos de ${data.recordId}`" @click="selected = data" /><Button v-if="isAdminIT" icon="pi pi-history" text severity="success" :aria-label="`Restaurar ${data.recordId}`" :disabled="pending || !synchronized" @click="restoreTarget = data" /></div></template></Column>
      </DataTable>
    </section>
    <Dialog :visible="!!selected" modal :header="`Datos eliminados · ${selected?.recordId ?? ''}`" :style="{ width: '720px', maxWidth: 'calc(100vw - 24px)' }" @update:visible="selected = null">
      <DataTable :value="detailRows" striped-rows scrollable><Column field="field" header="Campo" /><Column header="Valor"><template #body="{ data }"><pre>{{ data.value }}</pre></template></Column></DataTable>
      <template #footer><Button label="Cerrar" severity="secondary" @click="selected = null" /><Button v-if="isAdminIT" label="Restaurar" icon="pi pi-history" severity="success" :disabled="pending || !synchronized" @click="restoreTarget = selected" /></template>
    </Dialog>
    <Dialog :visible="!!restoreTarget" modal header="Confirmar restauración" :style="{ width: '460px', maxWidth: 'calc(100vw - 24px)' }" :closable="!pending" @update:visible="restoreTarget = null">
      <p>¿Restaurar <strong>{{ restoreTarget?.recordLabel }} · {{ restoreTarget?.recordId }}</strong>?</p><p>Recuperará ID, datos, historial y archivos originales. El portal volverá a estar disponible.</p>
      <Message v-if="feedback && !feedback.ok" severity="error" :closable="false">{{ feedback.message }}</Message>
      <template #footer><Button label="Cancelar" severity="secondary" :disabled="pending" @click="restoreTarget = null" /><Button label="Confirmar restauración" icon="pi pi-history" severity="success" :loading="pending" :disabled="!synchronized" @click="restore" /></template>
    </Dialog>
  </section>
</template>

<style scoped>
.trash-search { min-width: 0; max-width: 100%; }
.trash-search :deep(input) { width: 100%; }
.trash-actions { display: flex; }
.record-name { display: block; margin-top: 6px; }
pre { font: inherit; white-space: pre-wrap; overflow-wrap: anywhere; max-width: 440px; max-height: 240px; overflow: auto; }
</style>
