import type { CaseFile } from '../../app/types/domain'
import type { PrototypePortalSnapshot } from '../../shared/types/prototype'
import type { StoredPrototypeState } from './prototype-store'
import { prototypeFailure } from '../utils/prototype-errors'

export interface PrototypePortalScope { caseId: string; token: unknown }
export function portalCase(state: StoredPrototypeState, scope: PrototypePortalScope): CaseFile {
  if (scope.token !== `demo-${scope.caseId}`) prototypeFailure(403, 'ACTION_FORBIDDEN', 'Enlace inválido o expirado. No se muestran datos de ningún cliente.')
  const item = state.cases.find(item => item.id === scope.caseId)
  if (!item) prototypeFailure(404, 'CASE_NOT_FOUND', 'Expediente no encontrado.')
  return item
}

export function projectPrototypePortal(state: StoredPrototypeState, scope: PrototypePortalScope, username: string): PrototypePortalSnapshot {
  const item = portalCase(state, scope)
  const readOnly = ['No interesado', 'Retirado'].includes(item.contact) || item.tax.state === 'Cerrado'
  const presented = ['Presentado', 'Cerrado'].includes(item.tax.state)
  const prior720 = item.campaign === '720' && item.ph.prior
  const signed = item.ph.state === 'Firmada' && item.ph.signedVersion === item.ph.version
  const earlyIdentity = item.campaign === '720' && !prior720 &&
    (!item.opened || !item.identity.dni && !signed) && !readOnly && !presented
  const phVisible = !prior720 && item.opened && ['Enviada', 'Firmada', 'Rechazada'].includes(item.ph.state)
  const draftVisible = item.campaign === 'Renta' && item.tax.version > 0 &&
    ['En revisión cliente', 'Cambios solicitados', 'Aceptado', 'Presentado', 'Cerrado'].includes(item.tax.state)
  const receiptAvailable = presented && !!item.tax.receipt && (item.campaign === 'Renta' && item.presenter === 'Cliente' || item.tax.receiptSent)
  const invoiceAvailable = !!item.invoice.number && item.invoice.sent
  return {
    schemaVersion: 1, datasetId: state.datasetId, revision: state.revision, today: state.today,
    role: Object.hasOwn(state.rolesByPrincipal, username) ? state.rolesByPrincipal[username]! : 'Profesional',
    case: {
      id: item.id, name: item.name, email: item.email, campaign: item.campaign,
      opened: item.opened, contact: item.contact, contactedAt: item.contactedAt,
      rentaType: item.rentaType, presenter: item.presenter, fee: item.fee, owner: item.owner,
      identity: { ...item.identity }, portalSent: item.portalSent,
      documents: item.documents.map(doc => ({ ...doc })), delivered: item.delivered, docsComplete: item.docsComplete,
      ph: { state: item.ph.state, version: item.ph.version, approvedVersion: item.ph.approvedVersion,
        signedVersion: item.ph.signedVersion, sentAt: item.ph.sentAt, prior: item.ph.prior,
        ...(item.ph.priorConfirmed === undefined ? {} : { priorConfirmed: item.ph.priorConfirmed }) },
      tax: { state: item.tax.state, version: item.tax.version, acceptedVersion: item.tax.acceptedVersion,
        receipt: receiptAvailable ? item.tax.receipt : '', receiptSent: item.tax.receiptSent,
        ...(item.tax.presentationDate ? { presentationDate: item.tax.presentationDate } : {}),
        ...(draftVisible && item.tax.drafts ? { drafts: item.tax.drafts.map(({ version, date }) => ({ version, date })) } : {}) },
      invoice: invoiceAvailable ? { ...item.invoice } : { number: '', amount: 0, sent: false },
    },
    capabilities: {
      canUpload: !readOnly && (item.portalSent || earlyIdentity),
      canSign: !readOnly && !prior720 && item.opened && item.ph.state === 'Enviada' &&
        item.ph.approvedVersion === item.ph.version && !!item.ph.sentAt,
      canWithdraw: !readOnly && item.opened && !presented,
      canDeliver: !readOnly && item.portalSent && item.documents.length > 0 && !item.delivered,
      canRespondToDraft: !readOnly && item.campaign === 'Renta' && item.tax.state === 'En revisión cliente' && item.tax.version > 0,
      canPresent: !readOnly && item.campaign === 'Renta' && item.presenter === 'Cliente' &&
        item.tax.state === 'Aceptado' && item.tax.acceptedVersion === item.tax.version && item.tax.version > 0 &&
        signed && item.docsComplete && item.identity.dni && !!item.identity.dniValidUntil &&
        item.identity.dniValidUntil >= state.today && item.pbc === 'Apto' && !!item.nav,
      phVisible, draftVisible, receiptAvailable, invoiceAvailable,
    },
  }
}
