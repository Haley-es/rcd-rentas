import { documentKinds, type ActionResult, type CaseFile, type Role, type WorkflowAction } from '../types/domain'
import { demoAssets } from '../data/seed'
import { daysBetween } from './format'

function validDate(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}

export function requiredKinds(item: CaseFile): string[] {
  return ['DNI anverso', 'DNI reverso', item.campaign === 'Renta' ? 'Datos fiscales' : 'Bienes en el extranjero']
}

export function currentDocuments(item: CaseFile) {
  return item.documents.filter(doc => !item.documents.some(other => other.kind === doc.kind && other.version > doc.version))
}

export function missingKinds(item: CaseFile) {
  return requiredKinds(item).filter(kind => !currentDocuments(item).some(doc => doc.kind === kind && doc.state === 'Válido'))
}

export function nextTask(item: CaseFile, now: string): string {
  if (item.contact === 'No interesado') return 'Agradecimiento enviado (simulado)'
  if (item.contact === 'Retirado') return 'Retirada definitiva'
  if (!item.opened) {
    if (item.reminderAt && daysBetween(item.reminderAt, now) >= 3) return 'Llamar al cliente'
    if (!item.reminderAt && daysBetween(item.contactedAt, now) >= 7) return 'Enviar recordatorio'
    return 'Esperar respuesta'
  }
  if (item.tax.state === 'Cerrado') return 'Sin tareas pendientes'
  if (item.ph.state === 'Enviada' && item.ph.sentAt && daysBetween(item.ph.sentAt, now) >= 3) return 'Llamar: firma pendiente'
  if (item.ph.state === 'En revisión') return 'Revisión del socio'
  if (item.ph.state === 'Rechazada' || item.ph.state === 'Cambios solicitados') return 'Renegociar propuesta'
  if (!['Firmada', 'No necesaria'].includes(item.ph.state)) return 'Completar propuesta de honorarios'
  if (!item.portalSent) {
    if (item.pbc === 'Incidencia' || item.pbc === 'No apto') return 'Resolver validación PBC'
    if (!item.identity.dni || item.pbc !== 'Apto') return 'Validar identidad y PBC'
    if (!item.nav) return 'Registrar alta NAV manual'
    return 'Enviar acceso al portal'
  }
  if (!item.docsComplete) return item.delivered ? 'Revisar documentación' : 'Esperar documentación del cliente'
  if (item.campaign === '720' && item.extraction.state !== 'Cargado en Criteria') return item.extraction.state === 'Incidencia IT' ? 'Resolver incidencia IT y reintentar' : 'Extraer, revisar y cargar en Criteria'
  if (item.tax.state === 'Pendiente' || item.tax.state === 'Cambios solicitados') return 'Preparar borrador'
  if (item.tax.state === 'Borrador') return 'Enviar borrador al cliente'
  if (item.tax.state === 'En revisión cliente') return 'Esperar aceptación del borrador'
  if (item.tax.state === 'Aceptado') return `Presentar declaración: ${item.presenter}`
  if (!item.tax.receiptSent && item.presenter === 'RCD') return 'Enviar justificante'
  if (!item.invoice.number) return 'Emitir factura / minuta'
  if (!item.invoice.sent) return 'Enviar factura / minuta'
  return 'Cerrar expediente'
}

export function runAction(item: CaseFile, action: WorkflowAction, role: Role, now: string): ActionResult {
  const fail = (message: string): ActionResult => ({ ok: false, message })
  const is = (...allowed: Role[]) => allowed.includes(role)
  const staff = is('Profesional', 'Paralegal', 'Gestor de campañas')
  const professional = is('Profesional')
  const snapshot = () => `Contacto: ${item.contact}; PH: ${item.ph.state}; PBC: ${item.pbc}; documentos: ${item.docsComplete ? 'Completos' : 'Pendientes'}; fiscal: ${item.tax.state}; extractor: ${item.extraction.state}`
  const before = snapshot()
  const activePh = item.ph.state === 'Firmada' && item.ph.signedVersion === item.ph.version
  const validationReady = item.ph.prior ? item.ph.priorConfirmed === true : item.identity.dni && validDate(item.identity.dniValidUntil) && item.identity.dniValidUntil >= now && item.pbc === 'Apto' && !!item.nav
  if (item.tax.state === 'Cerrado') return fail('Expediente cerrado: solo consulta. Reinicia la demo para probar otra vez.')
  if (['No interesado', 'Retirado'].includes(item.contact)) return fail('Cliente fuera de campaña; expediente de solo consulta.')
  if (!item.opened && !['invite', 'remind', 'call', 'respond', 'contact-outcome', 'assign', 'add-document', 'identity', 'request-identity'].includes(action.type)) return fail('Acepta el formulario del cliente antes de tramitar la propuesta o el expediente.')
  let text = ''

  switch (action.type) {
    case 'invite':
      if (!staff || item.opened) return fail('Solo profesional o paralegal puede invitar contactos sin expediente.')
      if (item.history.some(event => event.text === 'Invitación inicial enviada (simulación).' && event.date === now)) return fail('Invitación ya registrada para este contacto en la fecha demo actual.')
      item.contactedAt = now; item.reminderAt = null; item.contact = 'Sin respuesta'
      text = 'Invitación inicial enviada (simulación).'
      break
    case 'remind':
      if (!staff || item.opened || item.reminderAt || daysBetween(item.contactedAt, now) < 7) return fail('Recordatorio disponible a los 7 días sin respuesta, una sola vez por invitación.')
      item.reminderAt = now; item.contact = 'Recordatorio'
      text = 'Recordatorio enviado tras 7 días sin respuesta (simulación).'
      break
    case 'call':
      if (!staff || item.opened || !item.reminderAt || item.contact === 'Llamada pendiente' || daysBetween(item.reminderAt, now) < 3) return fail('La llamada requiere 3 días adicionales desde el recordatorio.')
      item.contact = 'Llamada pendiente'
      text = 'Tarea de llamada creada (simulación).'
      break
    case 'respond':
      if (!is('Cliente') || item.opened) return fail('Respuesta disponible en el formulario del cliente antes de abrir expediente.')
      if (action.accept && !action.consent) return fail('Acepta el envío de la propuesta antes de continuar.')
      if (action.accept && item.campaign === 'Renta' && (!action.rentaType || !action.presenter || !Number.isFinite(action.fee) || (action.fee ?? 0) <= 0)) return fail('Indica tipo de Renta, presentador y honorarios ilustrativos positivos.')
      if (action.accept && item.campaign === '720' && (!validDate(action.dniValidUntil) || action.dniValidUntil < now || !['DNI anverso', 'DNI reverso'].every(kind => currentDocuments(item).some(doc => doc.kind === kind)))) return fail('720 requiere DNI vigente y ambas caras. Indica vigencia futura y adjunta anverso y reverso.')
      item.contact = action.accept ? 'Aceptado' : 'No interesado'; item.opened = action.accept
      if (action.accept) {
        item.rentaType = action.rentaType ?? 'Individual'; item.presenter = action.presenter ?? 'RCD'; item.fee = action.fee ?? item.fee
        item.ph.state = 'Borrador'; item.ph.approvedVersion = null; item.ph.signedVersion = null; item.ph.sentAt = null
        if (item.campaign === '720') item.identity.dniValidUntil = action.dniValidUntil
      }
      text = action.accept ? `Cliente acepta la campaña; expediente abierto y PH ficticia generada sin envío.${item.owner ? ` Responsable: ${item.owner}.` : ' Falta asignar responsable; no se ha notificado a ningún abogado.'}` : 'Cliente no interesado. Agradecimiento enviado (simulación).'
      break
    case 'contact-outcome':
      if (!staff || !action.note.trim()) return fail('Resultado telefónico requiere gestor/profesional/paralegal y nota.')
      if (action.outcome === 'No interesado') item.contact = item.opened ? 'Retirado' : 'No interesado'
      text = `Llamada manual: ${action.outcome}. ${action.note.trim()}. No firma ni presenta declaración.`
      break
    case 'assign':
      if (!staff || !action.owner.trim()) return fail('Asigna un responsable válido.')
      item.owner = action.owner.trim(); text = `Responsable asignado: ${item.owner}. Aviso local.`
      break
    case 'ph-submit':
      if (!professional || !['Borrador', 'Cambios solicitados'].includes(item.ph.state)) return fail('Solo profesional puede solicitar revisión de una PH en borrador.')
      if (item.campaign === '720' && !item.identity.dni) return fail('720 sin PH previa: valida DNI vigente con ambas caras antes de la PH.')
      item.ph.state = 'En revisión'; text = `PH v${item.ph.version} enviada a revisión del socio.`
      break
    case 'ph-review':
      if (!is('Socio') || item.ph.state !== 'En revisión') return fail('Solo socio puede revisar la PH pendiente.')
      if (!action.approve && !action.note.trim()) return fail('Describe los cambios solicitados.')
      item.ph.state = action.approve ? 'Aprobada' : 'Cambios solicitados'; item.ph.approvedVersion = action.approve ? item.ph.version : null; item.ph.note = action.note.trim()
      text = action.approve ? `Socio aprueba PH v${item.ph.version}. No enviada al cliente.` : 'Socio solicita modificaciones de la PH.'
      break
    case 'ph-edit':
      if (!is('Profesional', 'Socio') || item.ph.prior || item.ph.state === 'Firmada') return fail('Solo profesional o socio puede modificar una PH no firmada y no histórica.')
      if (!action.note.trim() || !Number.isFinite(action.fee) || action.fee <= 0) return fail('Indica motivo y honorarios positivos.')
      item.fee = action.fee; item.ph.version++; item.ph.state = 'Borrador'; item.ph.approvedVersion = null; item.ph.signedVersion = null; item.ph.sentAt = null; item.ph.note = action.note.trim()
      item.ph.followupAt = undefined
      text = `Nueva PH v${item.ph.version}. Requiere nueva revisión y firma.`
      break
    case 'ph-send':
      if (!professional || item.ph.state !== 'Aprobada' || item.ph.approvedVersion !== item.ph.version) return fail('Envío manual por profesional requiere aprobación de la versión vigente.')
      item.ph.state = 'Enviada'; item.ph.sentAt = now; text = `PH v${item.ph.version} enviada manualmente (simulación).`
      break
    case 'ph-sign':
      if (!is('Cliente') || item.ph.state !== 'Enviada' || item.ph.approvedVersion !== item.ph.version) return fail('Solo cliente puede firmar la versión aprobada y enviada.')
      item.ph.state = 'Firmada'; item.ph.signedVersion = item.ph.version; text = `Cliente firma PH v${item.ph.version} (firma ficticia). ${item.campaign === '720' ? 'Confirmación al socio y solicitud de alta a Altas (simulación).' : 'Validación DNI como siguiente paso.'}`
      break
    case 'ph-reject':
      if (!is('Cliente') || item.ph.state !== 'Enviada' || !action.note.trim()) return fail('Rechazo requiere PH enviada y motivo del cliente.')
      item.ph.state = 'Rechazada'; item.ph.note = action.note.trim(); text = 'PH rechazada; queda abierta a renegociación. Responsable y socio notificados (simulación).'
      break
    case 'ph-call':
      if (!staff || item.ph.state !== 'Enviada' || !item.ph.sentAt || daysBetween(item.ph.sentAt, now) < 3) return fail('La llamada por firma requiere 3 días desde el envío.')
      if (item.ph.followupAt) return fail('Llamada por esta versión ya registrada.')
      item.ph.followupAt = now
      text = 'Llamada por firma pendiente registrada (simulación).'
      break
    case 'ph-remind':
      if (!staff || item.ph.state !== 'Enviada' || !item.ph.sentAt || daysBetween(item.ph.sentAt, now) < 3 || item.history.some(event => event.text === `Recordatorio de firma PH v${item.ph.version} (simulación).`)) return fail('Recordatorio de firma disponible una vez, a los 3 días de la versión enviada.')
      text = `Recordatorio de firma PH v${item.ph.version} (simulación).`
      break
    case 'withdraw':
      if (!is('Cliente', 'Profesional') || !action.note.trim()) return fail('Retirada definitiva requiere motivo del cliente o profesional.')
      item.contact = 'Retirado'; text = `Retirada definitiva: ${action.note.trim()}.`
      break
    case 'identity':
      if (!staff) return fail('Identidad: solo profesional o paralegal.')
      if (action.field === 'dni' && action.value && !['DNI anverso', 'DNI reverso'].every(kind => currentDocuments(item).some(doc => doc.kind === kind && ['Enviado', 'Válido'].includes(doc.state)))) return fail('Para confirmar DNI vigente, incorpora ambas caras antes de validar.')
      if (action.field === 'dni' && action.value && (!validDate(action.validUntil) || action.validUntil < now)) return fail('DNI vencido o sin vigencia: indica fecha de caducidad vigente.')
      if (action.field === 'dni') item.identity.dniValidUntil = action.validUntil ?? item.identity.dniValidUntil
      item.identity[action.field] = action.value
      text = `${action.field === 'dni' ? 'DNI vigente (ambas caras)' : action.field === 'certificate' ? 'Certificado digital' : 'Autorización'}: ${action.value ? 'validado' : 'pendiente'}.`
      break
    case 'request-identity':
      if (!staff || item.identity.dni) return fail('Solicitud DNI requiere identidad pendiente.')
      text = 'DNI solicitado al cliente (simulación). Pte. DNI; alta bloqueada.'
      break
    case 'prior-confirm':
      if (!professional || !item.ph.prior || !action.note.trim()) return fail('Confirmación de antecedentes históricos requiere PH previa y justificación del profesional.')
      item.ph.priorConfirmed = true; text = `Antecedentes históricos confirmados manualmente: ${action.note.trim()}. Sin nueva PH ni alta NAV.`
      break
    case 'pbc-start':
      if (!is('Profesional', 'Paralegal', 'Altas') || (!activePh && !item.ph.prior) || !item.identity.dni || item.pbc === 'No apto') return fail('PBC requiere PH firmada o previa y DNI vigente. No apto exige nueva decisión de PBC o socio.')
      item.pbc = 'En revisión'; text = 'Filtros PBC simulados; decisión humana pendiente.'
      break
    case 'pbc-decide':
      if (!is('Socio', 'PBC') || !action.note.trim() || !['En revisión', 'Incidencia', 'No apto', 'Antecedente no confirmado'].includes(item.pbc)) return fail('Solo PBC o socio decide en revisión/incidencia, con justificación.')
      if (action.state === 'Apto' && !item.identity.dni) return fail('Antes de decidir apto, confirma DNI vigente.')
      item.pbc = action.state; item.pbcNote = action.note.trim(); text = `Decisión humana PBC: ${action.state}. ${action.note.trim()}`
      break
    case 'nav-register':
      if (!is('Altas') || item.pbc !== 'Apto' || (!activePh && !item.ph.prior) || !action.reference.trim()) return fail('Altas registra referencia NAV manual tras PH firmada/previa y PBC apto.')
      item.nav = action.reference.trim(); text = `Alta NAV registrada manualmente: ${item.nav}. Aviso al paralegal (simulado). Sin conexión externa.`
      break
    case 'portal-send':
      if (!staff || item.portalSent || (!item.ph.prior && (!activePh || !validationReady))) return fail('Acceso requiere firma, DNI, PBC apto y NAV; PH previa 720 permite acceso directo.')
      item.portalSent = true; item.docsRequestedAt = now; text = 'Enlace individual de documentación enviado (simulación).'
      break
    case 'add-document': {
      if (!is('Cliente', 'Paralegal', 'Profesional')) return fail('Solo cliente, profesional o paralegal puede incorporar archivos.')
      if (role === 'Cliente' && !item.portalSent && (item.campaign !== '720' || !['DNI anverso', 'DNI reverso'].includes(action.kind))) return fail('Todavía no hay acceso documental; 720 permite aportar ambas caras del DNI para la PH.')
      if (!documentKinds.includes(action.kind) || !action.name.trim() || !/\.(pdf|png|jpe?g|docx?|xlsx?)$/i.test(action.name) || action.size <= 0 || action.size > 10_000_000) return fail('Archivo vacío o inválido. Usa un tipo del catálogo y PDF, PNG, JPEG, DOC/DOCX o XLS/XLSX, máximo 10 MB.')
      const version = Math.max(0, ...item.documents.filter(doc => doc.kind === action.kind).map(doc => doc.version)) + 1
      item.documents.push({ id: `${item.id}-D${item.documents.length + 1}`, kind: action.kind, name: action.name, version, state: 'Enviado', note: '', size: action.size })
      item.delivered = false; item.docsComplete = false
      if (item.tax.state !== 'Pendiente' && item.tax.state !== 'Presentado') { item.tax.state = 'Cambios solicitados'; item.tax.acceptedVersion = null }
      if (item.tax.state !== 'Presentado') { item.extraction.state = 'Pendiente'; item.extraction.criteriaVersion = undefined }
      item.docsRequestedAt = now; item.docsReminderKey = undefined
      text = `${action.kind} v${version} incorporado; solo metadatos locales, pendiente de entrega y revisión.`
      break
    }
    case 'deliver-documents':
      if (!is('Cliente') || !item.portalSent || !currentDocuments(item).length || item.delivered) return fail('Entrega requiere acceso al portal y documentos nuevos.')
      item.delivered = true; text = `Cliente entrega documentación; ${item.owner ? `${item.owner} notificado con enlace al expediente (simulación)` : 'falta responsable; notificación no entregada'}. No validada automáticamente.`
      break
    case 'review-document': {
      const doc = currentDocuments(item).find(doc => doc.id === action.id)
      if (!professional || !item.delivered || !doc || (!action.valid && !action.note.trim())) return fail('Solo profesional revisa última versión entregada; sustitución requiere motivo.')
      doc.state = action.valid ? 'Válido' : 'Sustituir'; doc.note = action.note.trim(); item.docsComplete = false
      text = `${doc.kind} v${doc.version}: ${doc.state}. ${doc.note}`
      break
    }
    case 'complete-documents':
      if (!professional || !item.delivered || missingKinds(item).length || currentDocuments(item).some(doc => doc.state !== 'Válido')) return fail('Solo profesional confirma completitud tras validar todos los archivos vigentes y resolver faltantes.')
      item.docsComplete = true; text = 'Profesional confirma documentación completa.'
      break
    case 'docs-remind': {
      const due = item.docsRequestedAt ?? item.contactedAt
      const key = `${due}:${item.documents.length}`
      if (!staff || !item.portalSent || item.docsComplete || !Number.isInteger(action.afterDays) || action.afterDays < 1 || daysBetween(due, now) < action.afterDays || item.docsReminderKey === key) return fail('Recordatorio documental todavía no vence, ya emitido o documentación completa.')
      item.docsReminderKey = key; text = `Recordatorio documental (simulación). Faltantes actuales: ${missingKinds(item).join(', ') || 'revisión manual pendiente'}.`
      break
    }
    case 'tax-draft':
      if (!professional || item.campaign !== 'Renta' || !item.docsComplete || !['Pendiente', 'Cambios solicitados', 'Borrador', 'Aceptado'].includes(item.tax.state)) return fail(`Preparar Renta requiere documentación completa y estado editable. Faltantes: ${missingKinds(item).join(', ') || 'confirmación manual del profesional'}.`)
      item.tax.version++; item.tax.state = 'Borrador'; item.tax.acceptedVersion = null
      item.tax.drafts ??= []
      item.tax.drafts.push({ version: item.tax.version, date: now, note: item.tax.note })
      text = `Borrador de Renta v${item.tax.version} preparado (simulación).`
      break
    case 'tax-send':
      if (!professional || item.tax.state !== 'Borrador') return fail('Solo profesional envía borrador preparado.')
      item.tax.state = 'En revisión cliente'; text = `Borrador v${item.tax.version} enviado al cliente (simulación).`
      break
    case 'tax-respond':
      if (!is('Cliente') || item.campaign !== 'Renta' || item.tax.state !== 'En revisión cliente' || (!action.accept && !action.note.trim())) return fail('Respuesta requiere borrador vigente enviado; cambios requieren motivo.')
      item.tax.state = action.accept ? 'Aceptado' : 'Cambios solicitados'; item.tax.acceptedVersion = action.accept ? item.tax.version : null; item.tax.note = action.note.trim()
      text = action.accept ? `Cliente acepta borrador v${item.tax.version}.` : `Cliente solicita cambios: ${item.tax.note}`
      break
    case 'extract':
      if (!professional || item.campaign !== '720' || !item.docsComplete || item.tax.state === 'Presentado' || item.extraction.state === 'Extraído') return fail('Extractor manual 720 requiere documentación completa y ejecución anterior revisada o fallida, sin presentación.')
      item.extraction.version = (item.extraction.version ?? 0) + 1; item.extraction.criteriaVersion = undefined
      item.extraction.runs ??= []
      item.extraction.runs.push({ version: item.extraction.version, date: now, inputs: currentDocuments(item).map(doc => `${doc.kind} v${doc.version}`), failed: action.fail })
      item.extraction.state = action.fail ? 'Incidencia IT' : 'Extraído'; item.extraction.rows = action.fail ? [] : demoAssets(); item.extraction.note = action.fail ? 'Formato ficticio no reconocido. Derivado a IT; reintenta manualmente.' : ''
      text = action.fail ? 'Extractor simulado falla. Incidencia IT registrada; negocio no avanza.' : `Extracción simulada v${item.extraction.version} preparada; requiere revisión humana del Excel.`
      break
    case 'extraction-review':
      if (!professional || item.extraction.state !== 'Extraído' || !action.rows.length || action.rows.some(row => !row.category.trim() || !row.country.trim() || !row.entity.trim() || !Number.isFinite(row.value) || row.value < 0)) return fail('Revisión requiere extracción correcta y filas completas con valores no negativos.')
      item.extraction.rows = action.rows.map(row => ({ ...row })); item.extraction.state = 'Revisado'; text = 'Excel ficticio corregido y validado por profesional.'
      break
    case 'it-report':
      if (!professional || item.campaign !== '720' || !action.note.trim() || !['Extraído', 'Revisado', 'Incidencia IT'].includes(item.extraction.state)) return fail('Desviación IT requiere resultado o fallo 720 y descripción.')
      item.extraction.state = 'Incidencia IT'; item.extraction.note = action.note.trim(); text = `Incidencia IT: ${action.note.trim()}. Criteria bloqueado; no es incidencia PBC.`
      break
    case 'it-resolve':
      if (!is('IT') || item.extraction.state !== 'Incidencia IT' || !action.note.trim()) return fail('Solo IT registra ajuste con nota en incidencia pendiente.')
      item.extraction.state = 'Pendiente'; item.extraction.note = action.note.trim(); text = `IT registra ajuste: ${action.note.trim()}. Reintento manual y nueva revisión requeridos.`
      break
    case 'criteria':
      if (!professional || item.extraction.state !== 'Revisado' || !action.reference.trim() || !validDate(action.date) || action.date > now) return fail('Registra carga MANUAL en Criteria solo tras revisar Excel, con fecha no futura y referencia.')
      item.extraction.state = 'Cargado en Criteria'; item.extraction.note = action.reference.trim(); item.extraction.criteriaVersion = item.extraction.version ?? 1; item.extraction.criteriaDate = action.date
      text = `Carga manual en Criteria de v${item.extraction.criteriaVersion} registrada: ${action.reference.trim()}, ${action.date}. No se ha conectado a Criteria.`
      break
    case 'present':
      if ((item.presenter === 'Cliente' && item.campaign === 'Renta' && !is('Cliente')) || ((item.presenter === 'RCD' || item.campaign === '720') && !professional)) return fail('Solo el presentador configurado puede registrar presentación.')
      if (!item.docsComplete || !validationReady || (!activePh && !item.ph.prior)) return fail('Presentación requiere documentos completos, PH firmada/previa y validaciones confirmadas (DNI, PBC, NAV).')
      if ((item.presenter === 'RCD' || item.campaign === '720') && (!item.identity.certificate || !item.identity.authorization)) return fail('Presentación por RCD requiere certificado y autorización validados.')
      if (item.campaign === 'Renta' && (item.tax.state !== 'Aceptado' || item.tax.acceptedVersion !== item.tax.version)) return fail('La versión vigente del borrador debe estar aceptada.')
      if (item.campaign === '720' && (item.extraction.state !== 'Cargado en Criteria' || item.extraction.criteriaVersion !== (item.extraction.version ?? 1) || item.tax.state === 'Presentado')) return fail('720 requiere registro de carga manual de la versión vigente en Criteria y no estar presentado.')
      if (!action.receipt.trim()) return fail('Indica referencia de justificante ficticio.')
      if (!validDate(action.date) || action.date > now) return fail('Indica fecha de presentación no futura del reloj de demostración.')
      item.tax.state = 'Presentado'; item.tax.receipt = action.receipt.trim(); item.tax.presentationDate = action.date; text = `Presentación registrada por ${item.campaign === '720' ? 'RCD' : item.presenter} (simulación): ${action.receipt.trim()}, ${action.date}.`
      break
    case 'receipt-send':
      if (!professional || item.tax.state !== 'Presentado' || !item.tax.receipt || (item.presenter === 'Cliente' && item.campaign === 'Renta')) return fail('RCD solo envía justificante de declaraciones presentadas por RCD.')
      item.tax.receiptSent = true; text = 'Justificante enviado al cliente (simulación).'
      break
    case 'invoice':
      if (!is('Profesional', 'Altas', 'Administrativo') || item.tax.state !== 'Presentado' || !action.number.trim() || item.invoice.number) return fail('Factura requiere presentación y número, sin factura previa. Solo profesional, Altas o administrativo.')
      item.invoice = { number: action.number.trim(), amount: item.fee, sent: false }; text = `Factura / minuta ${item.invoice.number} emitida (ficticia). Cobro no confirmado.`
      break
    case 'invoice-send':
      if (!is('Profesional', 'Altas', 'Administrativo') || !item.invoice.number || item.invoice.sent) return fail('Solo profesional, Altas o administrativo envía factura emitida no enviada.')
      item.invoice.sent = true; text = 'Factura / minuta enviada (simulación). No implica cobro.'
      break
    case 'close':
      if (!professional || item.tax.state !== 'Presentado' || !item.invoice.sent || ((item.presenter === 'RCD' || item.campaign === '720') && !item.tax.receiptSent)) return fail('Cierre requiere presentación, justificante según presentador y factura enviada.')
      item.tax.state = 'Cerrado'; text = 'Expediente cerrado. Sin confirmación de cobro.'
      break
  }
  item.history.unshift({ date: now, role, text, before, after: snapshot() })
  return { ok: true, message: text }
}
