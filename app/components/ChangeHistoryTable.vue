<script setup lang="ts">
import type { PrototypeHistoryEntry } from '../../shared/types/prototype-history'
import { historyDateLabel, historyFieldLabel, historyOperationLabel, historyValueLabel } from '../../shared/utils/prototype-history'
const props = defineProps<{ entries: PrototypeHistoryEntry[]; loading?: boolean; fieldName?: string }>()
const rows = computed(() => props.entries.flatMap(entry => Object.entries(entry.changes)
  .filter(([field]) => !props.fieldName || field === props.fieldName)
  .map(([field, values]) => ({ ...entry, field, ...values }))))
</script>

<template>
  <DataTable :value="rows" :loading="loading" striped-rows scrollable paginator :rows="10" :rows-per-page-options="[10, 25, 50]" class="history-table" size="small">
    <template #empty><div class="empty-history"><i class="pi pi-history" aria-hidden="true" />No hay cambios registrados.</div></template>
    <Column header="Registro"><template #body="{ data }"><strong>{{ data.recordLabel }}</strong><small>{{ data.recordId }}</small></template></Column>
    <Column header="Operación"><template #body="{ data }"><Tag :value="historyOperationLabel(data.operation)" severity="secondary" /></template></Column>
    <Column header="Campo"><template #body="{ data }">{{ historyFieldLabel(data.field) }}</template></Column>
    <Column header="Valor anterior"><template #body="{ data }"><pre :class="{ empty: data.old === null }">{{ historyValueLabel(data.old) }}</pre></template></Column>
    <Column header="Valor nuevo"><template #body="{ data }"><pre :class="{ empty: data.new === null }">{{ historyValueLabel(data.new) }}</pre></template></Column>
    <Column header="Fecha"><template #body="{ data }"><time :datetime="data.changedAt">{{ historyDateLabel(data.changedAt) }}</time></template></Column>
    <Column header="Modificado por"><template #body="{ data }">{{ data.changedBy }}<small>{{ data.changedRole }}</small></template></Column>
  </DataTable>
</template>

<style scoped>
.history-table { max-width: 100%; }
.history-table :deep(th), .history-table :deep(td) { min-width: 140px; }
.history-table :deep(td) { vertical-align: top; }
pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; max-width: 280px; max-height: 220px; overflow: auto; font: inherit; }
small { display: block; color: var(--p-text-muted-color); margin-top: 4px; }
.empty { font-style: italic; color: var(--p-text-muted-color); }
.empty-history { padding: 24px; display: flex; gap: 8px; justify-content: center; }
</style>
