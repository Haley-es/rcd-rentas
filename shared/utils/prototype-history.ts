import type { Role } from '../../app/types/domain'
import type { ChangeValue, FieldChange, PrototypeHistoryEntry } from '../types/prototype-history'

export const canManageDeletedCases = (role: Role) => ['Profesional', 'Gestor de campañas', 'Socio'].includes(role)

export function flattenHistoryValues(value: object, prefix = ''): Record<string, ChangeValue> {
  const result: Record<string, ChangeValue> = {}
  for (const [key, child] of Object.entries(value)) {
    if (!prefix && ['id', 'history'].includes(key)) continue
    const path = prefix ? `${prefix}.${key}` : key
    if (child && typeof child === 'object' && !Array.isArray(child)) Object.assign(result, flattenHistoryValues(child, path))
    else result[path] = child ?? null
  }
  return result
}

export function changedHistoryFields(before: object, after: object): Record<string, FieldChange> {
  const oldValues = flattenHistoryValues(before)
  const newValues = flattenHistoryValues(after)
  const changes: Record<string, FieldChange> = {}
  for (const key of new Set([...Object.keys(oldValues), ...Object.keys(newValues)])) {
    const old = oldValues[key] ?? null
    const next = newValues[key] ?? null
    if (JSON.stringify(old) !== JSON.stringify(next)) changes[key] = { old, new: next }
  }
  return changes
}

const labels: Record<string, string> = {
  name: 'Cliente', email: 'Email', campaign: 'Campaña', segment: 'Segmento', owner: 'Responsable', scenario: 'Escenario',
  opened: 'Expediente abierto', contact: 'Estado de contacto', contactedAt: 'Fecha de contacto', reminderAt: 'Recordatorio',
  rentaType: 'Tipo de Renta', presenter: 'Presentador', fee: 'Honorarios', 'ph.state': 'Estado PH', 'ph.version': 'Versión PH',
  'ph.approvedVersion': 'PH aprobada', 'ph.signedVersion': 'PH firmada', 'ph.sentAt': 'Envío PH', 'ph.note': 'Nota PH',
  'identity.dni': 'DNI validado', 'identity.dniValidUntil': 'Caducidad DNI', 'identity.certificate': 'Certificado validado',
  'identity.authorization': 'Autorización validada', pbc: 'Estado PBC', pbcNote: 'Nota PBC', nav: 'Referencia NAV',
  portalSent: 'Portal enviado', documents: 'Documentos y versiones', delivered: 'Documentación entregada', docsComplete: 'Documentación completa',
  'tax.state': 'Estado fiscal', 'tax.version': 'Versión borrador', 'tax.note': 'Nota fiscal', 'tax.receipt': 'Justificante',
  'extraction.state': 'Estado extracción', 'extraction.rows': 'Filas extraídas', 'extraction.note': 'Nota extracción',
  'invoice.number': 'Número de factura', 'invoice.amount': 'Importe factura', 'invoice.sent': 'Factura enviada',
  today: 'Reloj demo', teams: 'Teams', signatureEmail: 'Recordatorio de firma', documentReminderDays: 'Días de recordatorio documental',
}
export const historyFieldLabel = (field: string) => labels[field] ?? field
export const historyOperationLabel = (operation: PrototypeHistoryEntry['operation']) => ({
  INSERT: 'Creación', UPDATE: 'Cambio', DELETE: 'Eliminación', RESTORE: 'Restauración',
}[operation])
export function historyValueLabel(value: ChangeValue): string {
  if (value === null) return '(vacío)'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
}
export const historyDateLabel = (value: string) => new Date(value).toLocaleString('es-ES', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
})
