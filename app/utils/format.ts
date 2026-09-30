export const money = (value: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value)
export const dateLabel = (value: string) => new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value))
export const daysBetween = (from: string, to: string) => Math.floor((Date.parse(to) - Date.parse(from)) / 86_400_000)
export const initials = (name: string) => name.split(' ').slice(0, 2).map(word => word[0]).join('')
export const stage = (item: import('../types/domain').CaseFile) => {
  if (['No interesado', 'Retirado'].includes(item.contact)) return 'Descartado'
  if (!item.opened) return 'Captación'
  if (item.tax.state === 'Cerrado') return 'Cerrado'
  if (item.tax.state === 'Presentado') return 'Facturación'
  if (item.tax.state !== 'Pendiente') return 'Presentación'
  if (item.campaign === '720' && item.extraction.state !== 'Pendiente') return 'Extracción'
  if (item.ph.state !== 'Firmada' && item.ph.state !== 'No necesaria') return 'Honorarios'
  if (!item.portalSent) return 'Validaciones'
  return 'Documentación'
}
export const statusSeverity = (value: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' => {
  if (['Firmada', 'Apto', 'Válido', 'Aceptado', 'Presentado', 'Cerrado', 'Revisado', 'Aprobada', 'Cargado en Criteria'].includes(value)) return 'success'
  if (['Incidencia', 'Incidencia IT', 'No apto', 'Rechazada', 'Sustituir', 'Retirado'].includes(value)) return 'danger'
  if (['En revisión', 'Cambios solicitados', 'Llamada pendiente', 'Recordatorio', 'En revisión cliente'].includes(value)) return 'warn'
  return ['Enviada', 'Enviado', 'Extraído'].includes(value) ? 'info' : 'secondary'
}
