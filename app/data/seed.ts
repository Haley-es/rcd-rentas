import type { CaseFile, Campaign, DocumentItem } from '../types/domain'

const makeCase = (index: number, name: string, campaign: Campaign, scenario: string): CaseFile => ({
  id: `DEMO-${campaign === 'Renta' ? 'R' : '720'}${String(campaign === 'Renta' ? index + 1 : index - 8).padStart(2, '0')}`,
  name, email: `cliente${index + 1}@example.test`, campaign, scenario,
  segment: index % 3 === 0 ? 'Nuevo cliente' : 'Cliente recurrente',
  owner: ['Lucía Torres', 'Carlos Vidal', 'Marta Soler'][index % 3]!,
  opened: true, contact: 'Aceptado', contactedAt: '2026-06-02', reminderAt: null,
  rentaType: 'Individual', presenter: 'RCD', fee: campaign === 'Renta' ? 250 : 450,
  ph: { state: 'Firmada', version: 1, approvedVersion: 1, signedVersion: 1, sentAt: '2026-06-03', note: '', prior: false },
  identity: { dni: false, certificate: false, authorization: false, dniValidUntil: '2030-12-31' },
  pbc: 'Pendiente', pbcNote: '', nav: '', portalSent: false,
  documents: [], delivered: false, docsComplete: false,
  tax: { state: 'Pendiente', version: 0, acceptedVersion: null, note: '', receipt: '', receiptSent: false },
  extraction: { state: 'Pendiente', rows: [], note: '' },
  invoice: { number: '', amount: 0, sent: false },
  history: [{ date: '2026-06-02', role: 'Profesional', text: 'Expediente ficticio creado para demostración.' }],
})

const doc = (id: string, kind: string, state: DocumentItem['state'] = 'Enviado'): DocumentItem => ({
  id, kind, name: `${kind.toLowerCase().replaceAll(' ', '-')}-demo.pdf`, version: 1, state, note: '', size: 128000,
})

const ready = (item: CaseFile) => {
  item.identity = { dni: true, certificate: true, authorization: true, dniValidUntil: '2030-12-31' }
  item.pbc = 'Apto'
  item.nav = `NAV-DEMO-${item.id.slice(-3)}`
  item.portalSent = true; item.docsRequestedAt = '2026-06-03'
  item.documents = [doc(`${item.id}-1`, 'DNI anverso', 'Válido'), doc(`${item.id}-2`, 'DNI reverso', 'Válido'), doc(`${item.id}-3`, item.campaign === 'Renta' ? 'Datos fiscales' : 'Bienes en el extranjero', 'Válido')]
  item.delivered = true
  item.docsComplete = true
}

export function createSeed(): CaseFile[] {
  const items = [
    makeCase(0, 'Clara Martínez', 'Renta', 'Invitación sin respuesta'),
    makeCase(1, 'Pablo Navarro', 'Renta', 'Recordatorio y llamada'),
    makeCase(2, 'Elena García', 'Renta', 'Declina la campaña'),
    makeCase(3, 'Andrés Romero', 'Renta', 'PH firmada; DNI vencido'),
    makeCase(4, 'Sofía López', 'Renta', 'Certificado disponible; autorización ausente'),
    makeCase(5, 'Javier Ruiz', 'Renta', 'PBC con incidencia'),
    makeCase(6, 'Isabel Fernández', 'Renta', 'Documentación incompleta'),
    makeCase(7, 'Daniel Pérez', 'Renta', 'Borrador pendiente de aceptación'),
    makeCase(8, 'Laura Sánchez', 'Renta', 'Presentación por el cliente'),
    makeCase(9, 'Miguel Castro', '720', 'Sin PH: formulario y DNI pendientes'),
    makeCase(10, 'Clara Martínez', '720', 'PH previa: acceso directo al portal'),
    makeCase(11, 'Hugo Moreno', '720', 'PH en revisión del socio'),
    makeCase(12, 'Valeria Torres', '720', 'PH rechazada: renegociación'),
    makeCase(13, 'Marcos Gil', '720', 'PH firmada; PBC y alta pendientes'),
    makeCase(14, 'Lucía Vidal', '720', 'Documentación incompleta'),
    makeCase(15, 'Álvaro Molina', '720', 'Extracción con incidencia IT'),
    makeCase(16, 'Carmen Ortega', '720', 'Excel revisado; Criteria manual'),
    makeCase(17, 'Tomás Serrano', '720', 'Presentado; justificante y factura pendientes'),
  ]
  const at = (index: number) => items[index]!
  for (const index of [0, 1, 2]) { at(index).opened = false; at(index).ph.state = 'Borrador'; at(index).ph.approvedVersion = null; at(index).ph.signedVersion = null }
  at(0).contact = 'Sin respuesta'
  at(1).contact = 'Recordatorio'; at(1).reminderAt = '2026-06-09'
  at(2).contact = 'No interesado'
  at(3).identity.dniValidUntil = '2025-12-31'; at(3).documents = [doc('R04-a', 'DNI anverso'), doc('R04-b', 'DNI reverso')]
  ready(at(4)); at(4).identity.authorization = false; at(4).tax = { state: 'Aceptado', version: 1, acceptedVersion: 1, note: '', receipt: '', receiptSent: false }
  at(5).identity.dni = true; at(5).pbc = 'Incidencia'; at(5).pbcNote = 'Coincidencia ficticia; pendiente de valoración humana.'; at(5).documents = [doc('R06-a', 'DNI anverso'), doc('R06-b', 'DNI reverso')]
  ready(at(6)); at(6).docsComplete = false; at(6).documents[2]!.state = 'Sustituir'; at(6).documents[2]!.note = 'Falta la página 2 del documento.'
  ready(at(7)); at(7).tax = { state: 'En revisión cliente', version: 1, acceptedVersion: null, note: '', receipt: '', receiptSent: false, drafts: [{ version: 1, date: '2026-06-10', note: '' }] }
  ready(at(8)); at(8).presenter = 'Cliente'; at(8).identity.certificate = false; at(8).identity.authorization = false; at(8).tax = { state: 'Aceptado', version: 2, acceptedVersion: 2, note: '', receipt: '', receiptSent: false }
  at(9).opened = false; at(9).contact = 'Sin respuesta'; at(9).ph.state = 'Borrador'; at(9).ph.approvedVersion = null; at(9).ph.signedVersion = null
  at(10).ph = { state: 'No necesaria', version: 0, approvedVersion: null, signedVersion: null, sentAt: null, note: 'PH previa aportada. Validaciones históricas no confirmadas.', prior: true }; at(10).portalSent = true; at(10).pbc = 'Antecedente no confirmado'; at(10).docsRequestedAt = '2026-06-03'
  for (const index of [11, 12, 13]) { at(index).identity.dni = true; at(index).documents = [doc(`${index}-a`, 'DNI anverso'), doc(`${index}-b`, 'DNI reverso')] }
  at(11).ph.state = 'En revisión'; at(11).ph.approvedVersion = null; at(11).ph.signedVersion = null
  at(12).ph.state = 'Rechazada'; at(12).ph.signedVersion = null; at(12).ph.note = 'Solicita ajustar los honorarios.'
  ready(at(14)); at(14).docsComplete = false; at(14).documents[2]!.state = 'Enviado'
  ready(at(15)); at(15).extraction.state = 'Incidencia IT'; at(15).extraction.note = 'Formato no reconocido. Incidencia DEMO-IT-007.'; at(15).extraction.version = 1; at(15).extraction.runs = [{ version: 1, date: '2026-06-11', inputs: ['Bienes en el extranjero v1'], failed: true }]
  ready(at(16)); at(16).extraction.state = 'Revisado'; at(16).extraction.rows = demoAssets(); at(16).extraction.version = 1
  ready(at(17)); at(17).extraction.state = 'Cargado en Criteria'; at(17).extraction.rows = demoAssets(); at(17).extraction.version = 1; at(17).extraction.criteriaVersion = 1; at(17).tax.state = 'Presentado'; at(17).tax.receipt = '720-DEMO-009'; at(17).tax.presentationDate = '2026-06-10'
  for (const item of items) if (['Borrador', 'En revisión', 'Cambios solicitados'].includes(item.ph.state)) item.ph.sentAt = null
  return items
}

export function demoAssets() {
  return [
    { id: 'A-01', category: 'Cuenta bancaria', country: 'Francia', entity: 'Banco ficticio Europa', value: 68400, origin: 'Bienes en el extranjero v1', observation: 'Dato ilustrativo' },
    { id: 'A-02', category: 'Valores', country: 'Alemania', entity: 'Cartera de ejemplo', value: 92500, origin: 'Bienes en el extranjero v1', observation: '' },
    { id: 'A-03', category: 'Inmueble', country: 'Portugal', entity: 'Vivienda ficticia', value: 180000, origin: 'Bienes en el extranjero v1', observation: '' },
  ]
}
