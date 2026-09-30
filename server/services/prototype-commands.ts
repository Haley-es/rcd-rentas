import type { Prisma } from '@prisma/client'
import type { ActionResult, Role, WorkflowAction } from '../../app/types/domain'
import { runAction } from '../../app/utils/workflow'
import { daysBetween } from '../../app/utils/format'
import type { CommandEnvelope, PrototypeCommand, PrototypeCommandResult } from '../../shared/types/prototype'
import { date, PrototypeValidationError } from '../../shared/utils/prototype-validation'
import type { PrototypeSessionContext } from '../utils/prototype-auth'
import { prototypeFailure } from '../utils/prototype-errors'
import { internalPrototypeSnapshot, mutatePrototype, newPrototypePayload, prototypeRole,
  type PrototypeArtifacts, type PrototypeMutation, type StoredPrototypeState } from './prototype-store'
import { portalCase, projectPrototypePortal, type PrototypePortalScope } from './prototype-portal'
import { prepareCommandArtifacts } from './prototype-artifacts'
import { describePrototypeFiles } from './prototype-file-descriptors'

const staff: Role[] = ['Profesional', 'Paralegal', 'Gestor de campañas']
const permissions: Record<WorkflowAction['type'], Role[]> = {
  invite: staff, remind: staff, call: staff, respond: ['Cliente'], 'contact-outcome': staff, assign: staff,
  'ph-submit': ['Profesional'], 'ph-review': ['Socio'], 'ph-edit': ['Profesional', 'Socio'], 'ph-send': ['Profesional'],
  'ph-sign': ['Cliente'], 'ph-reject': ['Cliente'], 'ph-call': staff, 'ph-remind': staff, withdraw: ['Cliente', 'Profesional'],
  identity: staff, 'request-identity': staff, 'prior-confirm': ['Profesional'], 'pbc-start': ['Profesional', 'Paralegal', 'Altas'],
  'pbc-decide': ['PBC', 'Socio'], 'nav-register': ['Altas'], 'portal-send': staff,
  'add-document': ['Cliente', 'Paralegal', 'Profesional'], 'deliver-documents': ['Cliente'],
  'review-document': ['Profesional'], 'complete-documents': ['Profesional'], 'docs-remind': staff,
  'tax-draft': ['Profesional'], 'tax-send': ['Profesional'], 'tax-respond': ['Cliente'],
  present: ['Cliente', 'Profesional'], 'receipt-send': ['Profesional'], extract: ['Profesional'],
  'extraction-review': ['Profesional'], 'it-report': ['Profesional'], 'it-resolve': ['IT'], criteria: ['Profesional'],
  invoice: ['Profesional', 'Altas', 'Administrativo'], 'invoice-send': ['Profesional', 'Altas', 'Administrativo'], close: ['Profesional'],
}
const portalActions: WorkflowAction['type'][] = ['respond', 'ph-sign', 'ph-reject', 'withdraw',
  'add-document', 'deliver-documents', 'tax-respond', 'present']

interface AppliedCommand extends ActionResult {
  applied: number
  results?: PrototypeCommandResult['results']
}
export function applyPrototypeCommand(state: StoredPrototypeState, command: PrototypeCommand,
  username: string, scope?: PrototypePortalScope): PrototypeMutation<AppliedCommand> {
  const role = scope ? 'Cliente' : prototypeRole(state, username)
  if (scope) {
    portalCase(state, scope)
    if (command.type !== 'workflow' || command.caseId !== scope.caseId || !portalActions.includes(command.action.type)) {
      prototypeFailure(403, 'ACTION_FORBIDDEN', 'Acción no permitida en este portal.')
    }
  } else if (role === 'Cliente' && command.type !== 'set-role') {
    prototypeFailure(403, 'ACTION_FORBIDDEN', 'El rol Cliente no puede ejecutar comandos internos.')
  }
  const workflow = (caseId: string, action: WorkflowAction): ActionResult => {
    const item = state.cases.find(item => item.id === caseId)
    if (!item) prototypeFailure(404, 'CASE_NOT_FOUND', 'Expediente no encontrado.')
    if (!permissions[action.type].includes(role)) prototypeFailure(403, 'ACTION_FORBIDDEN', 'Rol incorrecto. ' +
      (action.type === 'ph-review' ? 'Solo socio puede revisar la PH pendiente.' : 'Esta acción no está permitida para tu rol.'))
    return runAction(item, action, role, state.today)
  }
  let result: AppliedCommand
  switch (command.type) {
    case 'workflow': {
      const outcome = workflow(command.caseId, command.action)
      result = { ...outcome, applied: outcome.ok ? 1 : 0 }
      break
    }
    case 'set-role': {
      const changed = prototypeRole(state, username) !== command.role
      Object.defineProperty(state.rolesByPrincipal, username, { value: command.role, writable: true, enumerable: true, configurable: true })
      return { changed, result: { ok: true, message: `Rol demo confirmado: ${command.role}.`, applied: 0 } }
    }
    case 'set-settings': {
      let changed = false
      for (const key of ['teams', 'signatureEmail', 'documentReminderDays'] as const) {
        if (command[key] !== undefined && command[key] !== state[key]) changed = true
      }
      if (command.teams !== undefined) state.teams = command.teams
      if (command.signatureEmail !== undefined) state.signatureEmail = command.signatureEmail
      if (command.documentReminderDays !== undefined) state.documentReminderDays = command.documentReminderDays
      return { changed, result: { ok: true, message: 'Ajustes confirmados en SQL Server.', applied: 0 } }
    }
    case 'advance-days': {
      const next = new Date(`${state.today}T00:00:00Z`)
      next.setUTCDate(next.getUTCDate() + command.days)
      const value = next.toISOString().slice(0, 10)
      try { date(value, 'today') }
      catch (cause) {
        if (!(cause instanceof PrototypeValidationError)) throw cause
        prototypeFailure(400, 'COMMAND_INVALID', 'El avance produciría una fecha demo inválida.')
      }
      state.today = value
      return { changed: true, result: { ok: true, message: 'Reloj demo confirmado.', applied: 0 } }
    }
    case 'reset-demo':
      Object.assign(state, newPrototypePayload(), { datasetId: crypto.randomUUID() })
      return { changed: true, result: { ok: true, message: 'Datos compartidos reiniciados: 18 escenarios ficticios.', applied: 0 } }
    case 'invite-many':
    case 'evaluate-followups': {
      if (!staff.includes(role)) prototypeFailure(403, 'ACTION_FORBIDDEN', 'Solo profesional, paralegal o gestor puede evaluar seguimientos o invitar.')
      const results: NonNullable<AppliedCommand['results']> = []
      const act = (caseId: string, action: WorkflowAction) => results.push({ caseId, action: action.type, ...workflow(caseId, action) })
      if (command.type === 'invite-many') {
        for (const caseId of command.caseIds) act(caseId, { type: 'invite' })
      } else {
        for (const item of state.cases) {
          if (['No interesado', 'Retirado'].includes(item.contact) || item.tax.state === 'Cerrado') continue
          if (!item.opened && !item.reminderAt && daysBetween(item.contactedAt, state.today) >= 7) act(item.id, { type: 'remind' })
          if (!item.opened && item.reminderAt && item.contact !== 'Llamada pendiente' && daysBetween(item.reminderAt, state.today) >= 3) act(item.id, { type: 'call' })
          if (item.ph.state === 'Enviada' && item.ph.sentAt && daysBetween(item.ph.sentAt, state.today) >= 3) {
            if (!item.ph.followupAt) act(item.id, { type: 'ph-call' })
            if (state.signatureEmail && !item.history.some(event => event.text === `Recordatorio de firma PH v${item.ph.version} (simulación).`)) act(item.id, { type: 'ph-remind' })
          }
          const since = item.docsRequestedAt ?? item.contactedAt
          if (item.portalSent && !item.docsComplete && daysBetween(since, state.today) >= state.documentReminderDays &&
            item.docsReminderKey !== `${since}:${item.documents.length}`) act(item.id, { type: 'docs-remind', afterDays: state.documentReminderDays })
        }
      }
      const applied = results.filter(result => result.ok).length
      const rejected = results.filter(result => !result.ok)
      result = { ok: !rejected.length, applied, results, message:
        `${applied} eventos confirmados. ${rejected.map(result => `${result.caseId}: ${result.message}`).join(' ') || 'Sin envíos reales; reevaluar no duplica avisos.'}` }
      break
    }
  }
  return { changed: result.applied > 0, result }
}

export type PrototypeArtifactPreparation = (context: {
  state: StoredPrototypeState
  command: PrototypeCommand
  tx: Prisma.TransactionClient
}) => Promise<PrototypeArtifacts | undefined>

export async function executePrototypeCommand(session: PrototypeSessionContext, envelope: CommandEnvelope,
  scope?: PrototypePortalScope, prepareArtifacts?: PrototypeArtifactPreparation): Promise<PrototypeCommandResult> {
  if (envelope.command.type === 'workflow' && envelope.command.action.type === 'add-document' && !prepareArtifacts) {
    prototypeFailure(400, 'UPLOAD_INVALID', 'La aportación exige bytes reales mediante el endpoint multipart de archivos.')
  }
  const { state, result, cleanupPending } = await mutatePrototype({
    session, datasetId: envelope.datasetId, expectedRevision: envelope.expectedRevision,
    apply: async (state, tx) => {
      const mutation = applyPrototypeCommand(state, envelope.command, session.username, scope)
      if (mutation.changed) mutation.artifacts = await (prepareArtifacts ?
        prepareArtifacts({ state, command: envelope.command, tx }) :
        prepareCommandArtifacts({ state, command: envelope.command, tx }, session.username))
      return mutation
    },
  })
  const role = prototypeRole(state, session.username)
  const snapshot = scope ? projectPrototypePortal(state, scope, session.username) :
    role === 'Cliente' ? undefined : internalPrototypeSnapshot(state, session)
  if (snapshot) snapshot.files = await describePrototypeFiles(state, session.username, scope)
  if (!result.ok && envelope.command.type === 'workflow') {
    prototypeFailure(422, 'WORKFLOW_REJECTED', result.message, { snapshot })
  }
  return { ...result, ...(cleanupPending ? { message: 'Datos reiniciados; limpieza de archivos pendiente. Ejecuta reconciliación local tras 24 horas.' } : {}),
    ...(snapshot ? { snapshot } : {}), datasetId: state.datasetId, revision: state.revision, role }
}
