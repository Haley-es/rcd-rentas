import type { NuxtApp } from '#app'
import type { ActionResult, Role, WorkflowAction } from '../types/domain'
import type { PrototypeCommand, PrototypeCommandResult, PrototypePortalSnapshot, PrototypeSnapshot } from '../../shared/types/prototype'
import type { PrototypeFileDescriptor } from '../../shared/types/prototype-files'

interface ScopeActivity { generation: number; scope: string; loading?: Promise<boolean> }
const activities = new WeakMap<NuxtApp, ScopeActivity>()

export function useMockApp() {
  const app = useNuxtApp()
  const route = app.$router.currentRoute
  const auth = usePrototypeAuth()
  const { request } = auth
  const snapshot = useState<PrototypeSnapshot | null>('prototype-snapshot', () => null)
  const portalSnapshot = useState<PrototypePortalSnapshot | null>('prototype-portal-snapshot', () => null)
  const control = useState<{ datasetId: string; revision: number; role: Role } | null>('prototype-control', () => null)
  const pending = useState('prototype-mutation-pending', () => false)
  const loading = useState('prototype-loading', () => false)
  const error = useState('prototype-error', () => '')
  const synchronized = useState('prototype-synchronized', () => false)
  const confirmedScope = useState('prototype-scope', () => '')
  let active = activities.get(app)
  if (!active) { active = { generation: 0, scope: '' }; activities.set(app, active) }
  const activity = active
  const current = computed(() => portalSnapshot.value ?? snapshot.value)
  const ready = computed(() => current.value != null && confirmedScope.value === scopeUrl(route.value.path, route.value.query.token))
  const cases = computed(() => snapshot.value?.cases ?? [])
  const role = computed(() => control.value?.role ?? current.value?.role ?? 'Profesional')
  const today = computed(() => current.value?.today ?? '')
  const teams = computed(() => snapshot.value?.teams ?? true)
  const signatureEmail = computed(() => snapshot.value?.signatureEmail ?? false)
  const documentReminderDays = computed(() => snapshot.value?.documentReminderDays ?? 3)
  const revision = computed(() => control.value?.revision ?? current.value?.revision ?? -1)
  const datasetId = computed(() => control.value?.datasetId ?? current.value?.datasetId ?? '')
  const files = computed(() => current.value?.files ?? [])

  function scopeUrl(path: string, token: unknown) {
    return path.startsWith('/portal/') ?
      `/api/prototype/portal/${encodeURIComponent(decodeURIComponent(path.slice('/portal/'.length)))}?token=${encodeURIComponent(typeof token === 'string' ? token : '')}` :
      '/api/prototype/state'
  }
  function accept(next: PrototypeSnapshot | PrototypePortalSnapshot) {
    if (current.value && next.revision < current.value.revision) return
    control.value = { datasetId: next.datasetId, revision: next.revision, role: next.role }
    if ('case' in next) { snapshot.value = null; portalSnapshot.value = next }
    else { portalSnapshot.value = null; snapshot.value = next }
    synchronized.value = true
  }
  function failure(cause: unknown): { status: number; message: string; snapshot?: PrototypeSnapshot | PrototypePortalSnapshot } {
    if (cause && typeof cause === 'object' && 'data' in cause) {
      const data = cause.data as { statusCode?: number; data?: { message?: string; snapshot?: PrototypeSnapshot | PrototypePortalSnapshot } } | undefined
      if (data?.data?.message) return { status: data.statusCode ?? 0, message: data.data.message, snapshot: data.data.snapshot }
    }
    return { status: 0, message: 'Respuesta no confirmada. Comprueba conexión y actualiza antes de reintentar.' }
  }
  async function refresh(path = route.value.path, token: unknown = route.value.query.token): Promise<boolean> {
    const url = scopeUrl(path, token)
    if (activity.loading && activity.scope === url) return activity.loading
    const generation = ++activity.generation
    if (activity.scope !== url) {
      snapshot.value = null; portalSnapshot.value = null
      synchronized.value = false
    }
    activity.scope = url
    loading.value = true
    const work = (async () => {
      try {
        const next = await request<PrototypeSnapshot | PrototypePortalSnapshot>(url)
        if (generation !== activity.generation) return false
        accept(next)
        confirmedScope.value = url
        error.value = ''
        auth.error.value = ''
        return true
      } catch (cause) {
        if (generation !== activity.generation) return false
        const failed = failure(cause)
        error.value = failed.message
        synchronized.value = false
        if (failed.status === 403 && !path.startsWith('/portal/')) {
          snapshot.value = null
          control.value = control.value ? { ...control.value, role: 'Cliente' } : null
          await app.runWithContext(() => navigateTo('/portal/DEMO-R08?token=demo-DEMO-R08'))
        }
        return false
      } finally {
        if (generation === activity.generation) { loading.value = false; activity.loading = undefined }
      }
    })()
    activity.loading = work
    return work
  }
  async function command(command: PrototypeCommand, portal = false): Promise<ActionResult> {
    if (pending.value) return { ok: false, message: 'Ya hay una operación pendiente. Espera su confirmación.' }
    if (!synchronized.value || !datasetId.value) {
      error.value = 'Estado no sincronizado. Actualiza antes de confirmar cambios.'
      return { ok: false, message: error.value }
    }
    pending.value = true
    error.value = ''
    const commandScope = activity.scope
    const sentDataset = datasetId.value
    const base = portal ? scopeUrl(route.value.path, route.value.query.token) : '/api/prototype'
    const url = portal ? base.replace('?', '/commands?') : `${base}/commands`
    try {
      const result = await request<PrototypeCommandResult>(url, {
        method: 'POST', body: { datasetId: sentDataset, expectedRevision: revision.value, command },
      })
      if (commandScope !== activity.scope || sentDataset !== datasetId.value) {
        await refresh()
        return { ok: false, message: 'Ámbito cambiado durante la petición. Se ha consultado el resultado confirmado; no se ha repetido la acción.' }
      }
      if (result.revision >= revision.value) {
        control.value = { datasetId: result.datasetId, revision: result.revision, role: result.role }
        if (result.snapshot) accept(result.snapshot)
        else { snapshot.value = null; portalSnapshot.value = null }
      }
      if (!result.ok) error.value = result.message
      return result
    } catch (cause) {
      const failed = failure(cause)
      if (failed.snapshot && commandScope === activity.scope && sentDataset === datasetId.value) accept(failed.snapshot)
      if (failed.status === 409) {
        await refresh()
        error.value = `${failed.message} Edición conservada; revisa antes de confirmar otra vez.`
      } else {
        error.value = failed.message
        if (failed.status === 0 || failed.status >= 500) synchronized.value = false
      }
      return { ok: false, message: error.value }
    } finally { pending.value = false }
  }
  const act = (id: string, action: WorkflowAction) => command({ type: 'workflow', caseId: id, action })
  const actPortal = (id: string, action: WorkflowAction) => command({ type: 'workflow', caseId: id, action }, true)
  const setRole = (value: Role) => command({ type: 'set-role', role: value })
  const setSettings = (values: Omit<Extract<PrototypeCommand, { type: 'set-settings' }>, 'type'>) => command({ type: 'set-settings', ...values })
  const advanceDays = (days: number) => command({ type: 'advance-days', days })
  const reset = () => command({ type: 'reset-demo', confirm: true })
  const inviteMany = (caseIds: string[]) => command({ type: 'invite-many', caseIds })
  const evaluateFollowups = () => command({ type: 'evaluate-followups' })
  function fileBase(caseId: string, portal: boolean) {
    return `/api/prototype/${portal ? 'portal' : 'cases'}/${encodeURIComponent(caseId)}/files`
  }
  const portalQuery = () => `?token=${encodeURIComponent(typeof route.value.query.token === 'string' ? route.value.query.token : '')}`
  async function fileMutation(caseId: string, body: FormData | object, portal: boolean, suffix = ''): Promise<ActionResult> {
    if (pending.value) return { ok: false, message: 'Ya hay una operación pendiente.' }
    if (!synchronized.value) return { ok: false, message: 'Actualiza antes de confirmar cambios.' }
    pending.value = true
    error.value = ''
    const commandScope = activity.scope
    try {
      const result = await request<PrototypeCommandResult>(`${fileBase(caseId, portal)}${suffix}${portal ? portalQuery() : ''}`, { method: 'POST', body })
      if (commandScope !== activity.scope) { await refresh(); return { ok: false, message: 'Ámbito cambiado. Consulta el resultado; no se ha repetido la carga.' } }
      if (result.snapshot) accept(result.snapshot)
      return result
    } catch (cause) {
      const failed = failure(cause)
      if (failed.status === 409) await refresh()
      else if (failed.status === 0 || failed.status >= 500) synchronized.value = false
      error.value = `${failed.message} Selección conservada; consulta estado antes de reintentar.`
      return { ok: false, message: error.value }
    } finally { pending.value = false }
  }
  async function uploadDocument(caseId: string, file: File, kind: string, portal = route.value.path.startsWith('/portal/')) {
    const body = new FormData()
    body.append('file', file); body.append('kind', kind)
    body.append('datasetId', datasetId.value); body.append('expectedRevision', String(revision.value))
    return fileMutation(caseId, body, portal)
  }
  const generateDemoArtifacts = (caseId: string, portal = route.value.path.startsWith('/portal/')) => fileMutation(caseId, {
    datasetId: datasetId.value, expectedRevision: revision.value, confirm: true,
  }, portal, '/artifacts')
  async function downloadFile(file: PrototypeFileDescriptor, portal = route.value.path.startsWith('/portal/')): Promise<ActionResult> {
    if (!file.fileId) return { ok: false, message: 'Muestra precargada: solo metadatos. Original no disponible.' }
    try {
      const blob = await request<Blob>(`${fileBase(file.caseId, portal)}/${file.fileId}/download${portal ? portalQuery() : ''}`, { responseType: 'blob' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = file.originalName
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      return { ok: true, message: 'Bytes confirmados descargados.' }
    } catch (cause) {
      const failed = failure(cause)
      error.value = failed.message
      return { ok: false, message: error.value }
    }
  }
  return { cases, role, today, teams, signatureEmail, documentReminderDays, act, actPortal, advanceDays, reset,
    setRole, setSettings, inviteMany, evaluateFollowups, ready, pending, loading, error, synchronized,
    revision, datasetId, refresh, files, uploadDocument, downloadFile, generateDemoArtifacts, portalSnapshot: computed(() => portalSnapshot.value) }
}
