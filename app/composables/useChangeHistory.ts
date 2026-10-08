import type { PrototypeHistoryEntry, PrototypeHistorySnapshot } from '../../shared/types/prototype-history'

const activePopovers = new WeakMap<object, () => void>()

export function useChangeHistory() {
  const app = useNuxtApp()
  const { request, session } = usePrototypeAuth()
  const { datasetId, role } = useMockApp()
  const { isAdminIT } = useAccessRole()
  const entries = ref<PrototypeHistoryEntry[]>([])
  const loading = ref(false)
  const error = ref('')
  let generation = 0
  const isClient = () => role.value === 'Cliente'
  async function load(filters: { recordId?: string; trash?: boolean } = {}) {
    const current = ++generation
    entries.value = []
    error.value = ''
    if (!datasetId.value || isClient() || !session.value.authenticated || filters.trash && !isAdminIT.value) return
    loading.value = true
    const query = new URLSearchParams()
    if (filters.recordId) query.set('recordId', filters.recordId)
    if (filters.trash) query.set('trash', 'true')
    try {
      const result = await request<PrototypeHistorySnapshot>(`/api/prototype/history?${query}`)
      if (current !== generation || result.datasetId !== datasetId.value || isClient() || !session.value.authenticated) return
      entries.value = result.entries
    } catch (cause) {
      if (current !== generation) return
      const data = (cause as { data?: { data?: { message?: string } } })?.data
      error.value = data?.data?.message ?? 'No se pudo cargar el historial. Actualiza para reintentar.'
    } finally { if (current === generation) loading.value = false }
  }
  watch([datasetId, role, isAdminIT, () => session.value.authenticated ? session.value.user.username : null],
    () => { generation++; entries.value = []; loading.value = false })
  onScopeDispose(() => { generation++ })
  function registerPopover(hide: () => void) { activePopovers.get(app)?.(); activePopovers.set(app, hide) }
  function unregisterPopover(hide: () => void) { if (activePopovers.get(app) === hide) activePopovers.delete(app) }
  return { entries, loading, error, load, registerPopover, unregisterPopover }
}
