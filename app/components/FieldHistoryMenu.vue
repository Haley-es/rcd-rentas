<script setup lang="ts">
import { historyDateLabel, historyValueLabel } from '../../shared/utils/prototype-history'
const props = defineProps<{ caseId: string; fieldName: string; fieldLabel: string }>()
const { entries, loading, error, load, registerPopover, unregisterPopover } = useChangeHistory()
const popover = ref()
const { revision } = useMockApp()
const visible = ref(false)
const rows = computed(() => entries.value.filter(entry => props.fieldName in entry.changes).map(entry => ({
  id: entry.id, changedBy: entry.changedBy, changedAt: entry.changedAt, value: entry.changes[props.fieldName]!.new,
})))
const hide = () => { popover.value?.hide() }
function open(event: Event) {
  if (!visible.value) registerPopover(hide)
  popover.value?.toggle(event)
}
onScopeDispose(() => { unregisterPopover(hide) })
watch(revision, () => { if (visible.value) void load({ recordId: props.caseId }) })
</script>

<template>
  <span class="field-history" @contextmenu.prevent.stop="open">
    <slot />
    <Button icon="pi pi-history" text size="small" :aria-label="`Historial de ${fieldLabel} ${caseId}`" @click="open" />
    <Popover ref="popover" @show="visible = true; load({ recordId: caseId })" @hide="visible = false; unregisterPopover(hide)">
      <div class="field-history-content">
        <strong>Historial de {{ fieldLabel }}</strong>
        <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
        <DataTable v-else :value="rows" :loading="loading" striped-rows size="small" scrollable :rows="10" :paginator="rows.length > 10">
          <template #empty>No hay cambios registrados.</template>
          <Column header="Valor"><template #body="{ data }">{{ historyValueLabel(data.value) }}</template></Column>
          <Column header="Fecha"><template #body="{ data }">{{ historyDateLabel(data.changedAt) }}</template></Column>
          <Column field="changedBy" header="Modificado por" />
        </DataTable>
      </div>
    </Popover>
  </span>
</template>

<style scoped>
.field-history { display: inline-flex; align-items: center; gap: 4px; }
.field-history-content { width: 540px; max-width: calc(100vw - 64px); overflow-wrap: anywhere; }
.field-history-content > strong { display: block; margin-bottom: 12px; }
</style>
