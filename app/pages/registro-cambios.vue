<script setup lang="ts">
import { historyFieldLabel, historyOperationLabel } from '../../shared/utils/prototype-history'
const { entries, loading, error, load } = useChangeHistory()
const { revision, datasetId, refresh } = useMockApp()
const search = ref('')
const table = ref<string | null>(null)
const filtered = computed(() => {
  const terms = search.value.toLocaleLowerCase('es').split(/\s+/).filter(Boolean)
  return entries.value.filter(entry => (!table.value || entry.tableName === table.value) && terms.every(term =>
    [entry.recordId, entry.recordLabel, entry.changedBy, entry.changedRole, historyOperationLabel(entry.operation),
      ...Object.keys(entry.changes).map(historyFieldLabel), JSON.stringify(entry.changes)].join(' ').toLocaleLowerCase('es').includes(term)))
})
watch([revision, datasetId], () => { void load() }, { immediate: true })
async function reload() { if (await refresh()) await load() }
</script>

<template>
  <section>
    <div class="page-heading"><div><p class="eyebrow">TRAZABILIDAD</p><h1>Registro de cambios<span class="heading-dot">.</span></h1><p>Valores anteriores y nuevos, autor y fecha de cada cambio confirmado.</p></div><Button label="Actualizar" icon="pi pi-refresh" severity="secondary" :loading="loading" @click="reload" /></div>
    <div class="filter-bar history-filters"><IconField><InputIcon class="pi pi-search" /><InputText v-model="search" placeholder="Buscar registro, campo, valor o autor" aria-label="Buscar cambios" /></IconField><Select v-model="table" :options="[{ label: 'Expedientes', value: 'expedientes' }, { label: 'Ajustes', value: 'ajustes' }]" option-label="label" option-value="value" show-clear placeholder="Todos los registros" aria-label="Filtrar tipo de registro" /><span role="status">{{ filtered.length }} {{ filtered.length === 1 ? 'evento' : 'eventos' }}</span></div>
    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
    <section v-else class="panel table-panel"><ChangeHistoryTable :entries="filtered" :loading="loading" /></section>
  </section>
</template>

<style scoped>
.history-filters { flex-wrap: wrap; }
.history-filters :deep(input) { width: 100%; }
.history-filters > * { min-width: 0; max-width: 100%; }
</style>
