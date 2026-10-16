<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import ProgressBar from 'primevue/progressbar'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import type { CaseFile, DocumentItem, WorkflowAction, ActionResult } from '../types/domain'
import type { PrototypePortalCase, PrototypePortalCapabilities } from '../../shared/types/prototype'
import { dateLabel, initials, money, statusSeverity } from '../utils/format'

const props = defineProps<{
  expediente: PrototypePortalCase
  capabilities: PrototypePortalCapabilities
  perform: (action: WorkflowAction) => Promise<ActionResult>
  upload: (file: File, kind: string) => Promise<ActionResult>
  pending: boolean
}>()

type Intent = 'respond' | 'decline' | 'ph-sign' | 'ph-reject' | 'withdraw'
  | 'add-document' | 'deliver-documents' | 'tax-accept' | 'tax-change' | 'present'
type Requirement = { kind: string; required: boolean; hint: string }
type FormErrors = { consent?: string; identityNumber?: string; expiry?: string; identity?: string; contact?: string }

const maxSize = 10_000_000
const allowedMimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]
const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx']
const fileAccept = [...allowedMimeTypes, ...allowedExtensions].join(',')
const rentaTypes: CaseFile['rentaType'][] = ['Individual', 'Conjunta']
const presenters = [{ label: 'RCD prepara y presenta', value: 'RCD' }, { label: 'RCD prepara; yo presento', value: 'Cliente' }]
const rentaType = ref<CaseFile['rentaType']>(props.expediente.rentaType)
const presenter = ref<CaseFile['presenter']>(props.expediente.presenter)
const consent = ref(false)
const identityNumber = ref('')
const expiry = ref('')
const referenceDate = ref(props.expediente.contactedAt)
const formErrors = ref<FormErrors>({})
const selectedKind = ref<string | null>(null)
const selectedFile = ref<File | null>(null)
const { files, downloadFile } = useMockApp()
const fileInput = ref<HTMLInputElement | null>(null)
const uploadError = ref('')
const localMessage = ref('')
const localError = ref('')
const feedback = ref<HTMLElement | null>(null)
const dialogVisible = ref(false)
const intent = ref<Intent | null>(null)
const note = ref('')
const receiptReference = ref('')
const presentationDate = ref('')
const dialogError = ref('')
const confirmedSimulation = ref(false)
const actionContext = ref('')
const downloadError = ref('')

const caseFile = computed(() => props.expediente)
const prior720 = computed(() => caseFile.value.campaign === '720' && caseFile.value.ph.prior)
const declined = computed(() => ['No interesado', 'Retirado'].includes(caseFile.value.contact))
const closed = computed(() => caseFile.value.tax.state === 'Cerrado')
const readOnly = computed(() => declined.value || closed.value)
const presented = computed(() => ['Presentado', 'Cerrado'].includes(caseFile.value.tax.state))
const capturePending = computed(() => !caseFile.value.opened && !prior720.value && !declined.value)
const signedCurrent = computed(() => caseFile.value.ph.state === 'Firmada'
  && caseFile.value.ph.signedVersion === caseFile.value.ph.version)
const needsEarlyIdentity = computed(() => caseFile.value.campaign === '720' && !prior720.value
  && (capturePending.value || !caseFile.value.identity.dni && !signedCurrent.value)
  && !readOnly.value && !presented.value)
const canUpload = computed(() => props.capabilities.canUpload)
const canSign = computed(() => props.capabilities.canSign)
const canWithdraw = computed(() => props.capabilities.canWithdraw)
const phVisible = computed(() => props.capabilities.phVisible)
const draftVisible = computed(() => props.capabilities.draftVisible)
const canRespondToDraft = computed(() => props.capabilities.canRespondToDraft)
const agreedCurrent = computed(() => caseFile.value.tax.acceptedVersion === caseFile.value.tax.version
  && caseFile.value.tax.version > 0)
const canPresent = computed(() => props.capabilities.canPresent)
const canDeliver = computed(() => props.capabilities.canDeliver)
const illustrativeFee = computed(() => rentaType.value === 'Individual' ? 150 : 250)
const editableNote = computed(() => ['ph-reject', 'withdraw', 'tax-change'].includes(intent.value ?? ''))
const versionContext = computed(() => JSON.stringify([
  caseFile.value.id, caseFile.value.contact, caseFile.value.opened,
  caseFile.value.ph, caseFile.value.tax, caseFile.value.presenter,
  caseFile.value.identity, props.capabilities,
  caseFile.value.portalSent, caseFile.value.delivered, caseFile.value.docsComplete,
  caseFile.value.documents,
]))
const idPrefix = computed(() => `client-${caseFile.value.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`)
const fieldId = (name: string) => `${idPrefix.value}-${name}`

const documentGroups = computed(() => {
  const groups = new Map<string, DocumentItem[]>()
  for (const document of caseFile.value.documents) {
    const versions = groups.get(document.kind) ?? []
    versions.push(document)
    groups.set(document.kind, versions)
  }
  return [...groups.entries()].map(([kind, versions]) => ({
    kind,
    versions: [...versions].sort((a, b) => b.version - a.version),
    current: [...versions].sort((a, b) => b.version - a.version)[0]!,
  }))
})
const currentDocument = (kind: string) => documentGroups.value.find(group => group.kind === kind)?.current
const dniFacesPresent = computed(() => ['DNI anverso', 'DNI reverso'].every(kind => {
  const document = currentDocument(kind)
  return document && !['Pendiente', 'Sustituir'].includes(document.state)
}))
const requirements = computed<Requirement[]>(() => {
  const items: Requirement[] = []
  if (!caseFile.value.identity.dni || (caseFile.value.portalSent && !dniFacesPresent.value)) {
    items.push(
      { kind: 'DNI anverso', required: true, hint: 'Muestra de la cara delantera. No uses tu DNI real.' },
      { kind: 'DNI reverso', required: true, hint: 'Muestra de la cara trasera. Ambas caras cuando falta el DNI.' },
    )
  }
  items.push(caseFile.value.campaign === 'Renta'
    ? { kind: 'Datos fiscales', required: true, hint: 'Catálogo ilustrativo; el profesional define los requisitos finales.' }
    : { kind: 'Bienes en el extranjero', required: true, hint: 'Información ficticia de cuentas, valores o inmuebles para el Modelo 720.' })
  if (caseFile.value.campaign === 'Renta' && caseFile.value.presenter === 'RCD') {
    if (!caseFile.value.identity.certificate) items.push({ kind: 'Certificado digital', required: true, hint: 'Solo una muestra, nunca certificados ni claves reales.' })
    if (!caseFile.value.identity.authorization) items.push({ kind: 'Autorización', required: true, hint: 'Aportar una muestra no equivale a autorizar el uso del certificado.' })
  }
  items.push({ kind: 'Información bancaria', required: false, hint: 'Muestra opcional de apoyo.' })
  return items
})
const uploadKinds = computed(() => [...new Set([
  ...(needsEarlyIdentity.value && !caseFile.value.portalSent
    ? ['DNI anverso', 'DNI reverso'] : requirements.value.map(item => item.kind)),
  ...(caseFile.value.portalSent ? ['Documentación adicional', ...documentGroups.value.map(group => group.kind)] : []),
])])
const missingRequirements = computed(() => requirements.value.filter(item => {
  const document = currentDocument(item.kind)
  return item.required && (!document || document.state === 'Pendiente' || document.state === 'Sustituir')
}))
const waitingReview = computed(() => requirements.value.filter(item => item.required
  && currentDocument(item.kind) && currentDocument(item.kind)?.state !== 'Válido'))
const documentStatus = computed(() => {
  if (caseFile.value.docsComplete) return 'Validada por el profesional'
  if (caseFile.value.delivered) return 'Entregada para revisión'
  if (caseFile.value.documents.length) return 'Cambios sin entregar'
  return 'Pendiente de aportación'
})
const steps = computed(() => [
  { label: 'Tu respuesta', complete: caseFile.value.opened || prior720.value },
  { label: 'Propuesta de honorarios', complete: signedCurrent.value || prior720.value },
  { label: 'Revisión documental', complete: caseFile.value.docsComplete },
  { label: caseFile.value.campaign === 'Renta' ? 'Borrador y presentación' : 'Preparación del Modelo 720', complete: presented.value },
  { label: 'Cierre del expediente', complete: closed.value },
])
const progress = computed(() => Math.round(steps.value.filter(step => step.complete).length / steps.value.length * 100))
const nextStep = computed(() => {
  if (declined.value) return 'Seguimiento de esta campaña detenido'
  if (closed.value) return 'Expediente cerrado; puedes consultar las muestras'
  if (capturePending.value) return 'Completa tu respuesta a la invitación'
  if (needsEarlyIdentity.value) return 'Añade las dos caras del DNI ficticio antes de preparar la PH'
  if (!signedCurrent.value && !prior720.value) return canSign.value ? 'Revisa y firma la propuesta en simulación' : 'El equipo está preparando tu propuesta'
  if (!caseFile.value.portalSent) return 'El equipo debe habilitar la aportación documental'
  if (!caseFile.value.docsComplete) return caseFile.value.delivered ? 'Tu documentación espera revisión humana' : 'Añade tus muestras y entrégalas al profesional'
  if (canRespondToDraft.value) return 'Revisa la versión actual del borrador'
  if (canPresent.value) return 'Puedes registrar tu presentación ficticia'
  if (presented.value) return 'Consulta el justificante y la factura cuando estén disponibles'
  return 'El equipo prepara el siguiente paso'
})
const receiptAvailable = computed(() => props.capabilities.receiptAvailable)
const invoiceAvailable = computed(() => props.capabilities.invoiceAvailable)
const dialogTitle = computed(() => {
  const titles: Record<Intent, string> = {
    respond: 'Confirmar respuesta de demostración',
    decline: 'Declinar esta campaña',
    'ph-sign': `Simular firma de la PH · v${caseFile.value.ph.version}`,
    'ph-reject': 'Solicitar renegociación de honorarios',
    withdraw: 'Confirmar retirada definitiva del servicio',
    'add-document': currentDocument(selectedKind.value ?? '') ? 'Añadir una versión de demostración' : 'Añadir archivo local real',
    'deliver-documents': 'Entregar documentación para revisión',
    'tax-accept': `Aceptar borrador ficticio · v${caseFile.value.tax.version}`,
    'tax-change': 'Solicitar revisión del borrador',
    present: 'Registrar presentación por el cliente · simulación',
  }
  return intent.value ? titles[intent.value] : 'Confirmación de simulación'
})
const dialogDescription = computed(() => {
  const descriptions: Record<Intent, string> = {
    respond: 'Se registrará tu respuesta en el escenario. La PH no se firma ni se envía automáticamente.',
    decline: 'Se detendrá el seguimiento de esta campaña. No se borrará el historial ni se afectarán otras campañas.',
    'ph-sign': 'Solo cambia el estado de la versión enviada. No es una firma electrónica ni un contrato válido.',
    'ph-reject': 'El equipo podrá revisar la propuesta, aprobar otra versión y reenviarla. El expediente sigue abierto.',
    withdraw: 'Esta retirada es definitiva dentro del mockup: detiene el seguimiento del servicio. No equivale a pedir cambios de honorarios.',
    'add-document': 'Se transmiten y guardan bytes reales en disco privado local y metadatos en SQL. Usa solo muestras autorizadas. Una nueva versión conserva historial y exige revisión; no equivale a entrega.',
    'deliver-documents': 'Se registrará una entrega explícita para el responsable. Una entrega parcial es posible; no significa documentación completa ni validada.',
    'tax-accept': 'El acuerdo se vincula únicamente a esta versión. No presenta ninguna declaración ni acepta versiones futuras.',
    'tax-change': 'Tu comentario vuelve al profesional para una nueva versión. No se presenta ninguna declaración.',
    present: 'Se registrará una confirmación ficticia de presentación por ti. No hay conexión con Hacienda ni envío de declaración.',
  }
  return intent.value ? descriptions[intent.value] : ''
})

watch(() => props.expediente.id, () => {
  rentaType.value = props.expediente.rentaType
  presenter.value = props.expediente.presenter
  consent.value = false
  identityNumber.value = ''
  expiry.value = ''
  referenceDate.value = props.expediente.contactedAt
  formErrors.value = {}
  selectedKind.value = null
  selectedFile.value = null
  if (fileInput.value) fileInput.value.value = ''
  uploadError.value = ''
  localMessage.value = ''
  localError.value = ''
  downloadError.value = ''
  dialogVisible.value = false
  intent.value = null
})
watch(dialogVisible, visible => {
  if (!visible) {
    intent.value = null
    note.value = ''
    confirmedSimulation.value = false
    dialogError.value = ''
  }
})

function formatDate(value: string | null) {
  return value && Number.isFinite(Date.parse(value)) ? dateLabel(value) : 'No registrada'
}

function formatSize(size: number) {
  if (size < 1000) return `${size} B`
  if (size < 1_000_000) return `${(size / 1000).toFixed(1)} kB`
  return `${(size / 1_000_000).toFixed(2)} MB`
}

function validDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === value
}

function validateCapture() {
  const errors: FormErrors = {}
  if (!caseFile.value.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(caseFile.value.email)) {
    errors.contact = 'Faltan nombre o correo válidos en los datos del escenario. El equipo debe corregirlos.'
  }
  if (!consent.value) errors.consent = 'Acepta el envío simulado de la propuesta de honorarios para continuar.'
  if (caseFile.value.campaign === '720') {
    if (!identityNumber.value.trim()) errors.identityNumber = 'Indica un identificador ficticio, nunca un DNI real.'
    if (!dniFacesPresent.value) errors.identity = 'Añade DNI anverso y DNI reverso, sin solicitudes de sustitución pendientes.'
    if (!validDate(expiry.value) || !validDate(referenceDate.value)) errors.expiry = 'Indica fechas válidas de vigencia y comprobación.'
    else if (expiry.value <= referenceDate.value) errors.expiry = 'La vigencia del DNI de muestra debe ser posterior a la fecha de comprobación ficticia.'
  }
  formErrors.value = errors
  return Object.keys(errors).length === 0
}

function chooseFile(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.[0]
  selectedFile.value = file ?? null
  input.value = ''
  uploadError.value = ''
  if (selectedFile.value) validateUpload()
}

function validateUpload() {
  let error = ''
  const file = selectedFile.value
  if (!canUpload.value) error = 'La aportación documental no está habilitada en este estado.'
  else if (!selectedKind.value || !uploadKinds.value.includes(selectedKind.value)) error = 'Selecciona un tipo documental.'
  else if (!file) error = 'Selecciona un archivo de demostración.'
  else if (!allowedMimeTypes.includes(file.type)) error = 'MIME no admitido. Usa una muestra PDF, JPEG, PNG, DOC, DOCX, XLS o XLSX con su tipo MIME correspondiente.'
  else if (!allowedExtensions.some(extension => file.name.toLowerCase().endsWith(extension))) error = 'Extensión no admitida. Usa .pdf, .jpg, .jpeg, .png, .doc, .docx, .xls o .xlsx.'
  else if (file.size === 0) error = 'El archivo está vacío. Selecciona una muestra no vacía.'
  else if (file.size > maxSize) error = 'La muestra supera 10 MB (10.000.000 bytes). No se ha añadido.'
  uploadError.value = error
  return !error
}

function intentAllowed(value: Intent) {
  switch (value) {
    case 'respond':
    case 'decline': return capturePending.value
    case 'ph-sign':
    case 'ph-reject': return canSign.value
    case 'withdraw': return canWithdraw.value
    case 'add-document': return canUpload.value
    case 'deliver-documents': return canDeliver.value
    case 'tax-accept':
    case 'tax-change': return canRespondToDraft.value
    case 'present': return canPresent.value
  }
}

async function showFeedback(error: string) {
  localError.value = error
  await nextTick()
  feedback.value?.focus()
}

async function openConfirmation(value: Intent) {
  localError.value = ''
  localMessage.value = ''
  if (!intentAllowed(value)) {
    await showFeedback('Esta acción no está disponible en el estado actual. Revisa los requisitos del expediente.')
    return
  }
  if (value === 'respond' && !validateCapture()) {
    await showFeedback('No se ha enviado la respuesta. Corrige los campos indicados en el formulario.')
    return
  }
  if (value === 'add-document' && !validateUpload()) return
  intent.value = value
  note.value = ''
  receiptReference.value = `CLIENTE-DEMO-${caseFile.value.id}`
  presentationDate.value = caseFile.value.tax.presentationDate || caseFile.value.contactedAt
  confirmedSimulation.value = false
  dialogError.value = ''
  actionContext.value = versionContext.value
  dialogVisible.value = true
}

async function confirmAction() {
  if (props.pending) return
  const value = intent.value
  if (!value) return
  if (actionContext.value !== versionContext.value || !intentAllowed(value)) {
    dialogError.value = 'El expediente ha cambiado. Cancela y revisa la versión y el estado actuales antes de confirmar.'
    return
  }
  if (!confirmedSimulation.value) {
    dialogError.value = 'Confirma que entiendes que esta acción es una simulación sin efectos reales.'
    return
  }
  if (editableNote.value && !note.value.trim()) {
    dialogError.value = value === 'withdraw' ? 'Indica el motivo de tu retirada definitiva.' : 'Escribe el motivo de la solicitud de cambios.'
    return
  }
  let action: WorkflowAction
  switch (value) {
    case 'respond':
      if (!validateCapture()) {
        dialogError.value = 'El formulario ya no cumple los requisitos. Cancela y corrige los campos indicados.'
        return
      }
      action = caseFile.value.campaign === 'Renta'
        ? { type: 'respond', accept: true, rentaType: rentaType.value, presenter: presenter.value, fee: illustrativeFee.value, consent: true }
        : { type: 'respond', accept: true, consent: true, dniValidUntil: expiry.value }
      break
    case 'decline': action = { type: 'respond', accept: false }; break
    case 'ph-sign': action = { type: 'ph-sign' }; break
    case 'ph-reject': action = { type: 'ph-reject', note: note.value.trim() }; break
    case 'withdraw': action = { type: 'withdraw', note: note.value.trim() }; break
    case 'add-document':
      if (!validateUpload() || !selectedFile.value || !selectedKind.value) {
        dialogError.value = uploadError.value || 'Selecciona un tipo y una muestra válidos.'
        return
      }
      action = { type: 'add-document', kind: selectedKind.value, name: selectedFile.value.name, size: selectedFile.value.size }
      break
    case 'deliver-documents': action = { type: 'deliver-documents' }; break
    case 'tax-accept': action = { type: 'tax-respond', accept: true, note: '' }; break
    case 'tax-change': action = { type: 'tax-respond', accept: false, note: note.value.trim() }; break
    case 'present':
      if (!validDate(presentationDate.value)) {
        dialogError.value = 'Indica una fecha de presentación ficticia válida.'
        return
      }
      if (!receiptReference.value.trim()) {
        dialogError.value = 'Indica una referencia ficticia para registrar la simulación, no un justificante oficial.'
        return
      }
      action = { type: 'present', receipt: receiptReference.value.trim(), date: presentationDate.value }
      break
  }
  const result = value === 'add-document' && selectedFile.value && selectedKind.value ?
    await props.upload(selectedFile.value, selectedKind.value) : await props.perform(action)
  if (!result.ok) { dialogError.value = result.message; return }
  dialogVisible.value = false
  localMessage.value = result.message
  if (value === 'add-document') selectedFile.value = null
}

async function downloadSample(kind: 'ph' | 'draft' | 'receipt' | 'invoice' | 'document', document?: DocumentItem) {
  downloadError.value = ''
  const available = kind === 'ph' ? phVisible.value
    : kind === 'draft' ? draftVisible.value
      : kind === 'receipt' ? receiptAvailable.value
        : kind === 'invoice' ? invoiceAvailable.value
          : document && caseFile.value.documents.some(item => item.id === document.id)
  if (!available) {
    downloadError.value = 'La muestra no está disponible en el estado actual.'
    return
  }
  const category = kind === 'draft' ? 'tax-draft' : kind
  const file = files.value.findLast(file => file.caseId === caseFile.value.id && file.category === category &&
    (kind !== 'document' || file.documentId === document?.id))
  if (!file?.fileId) { downloadError.value = 'Original no disponible: muestra precargada, solo metadatos, o histórico sin archivo disponible. Prepara explícitamente las muestras TXT/CSV actuales.'; return }
  const result = await downloadFile(file)
  if (!result.ok) downloadError.value = result.message
}
</script>

<template>
  <main class="client-portal" :aria-labelledby="fieldId('title')">
    <PrototypeFileList :case-id="expediente.id" />
    <div class="simulation-banner">
      <i class="pi pi-desktop" aria-hidden="true" />
      <span><strong>Portal de demostración.</strong> Datos ficticios, sin envíos ni servicios reales. Toda acción requiere confirmar la simulación.</span>
      <Tag value="Rol Cliente" severity="secondary" />
    </div>

    <header class="portal-hero">
      <div class="hero-copy">
        <p class="eyebrow">RCD · Tu espacio personal</p>
        <h1 :id="fieldId('title')">Hola, {{ expediente.name }}</h1>
        <p class="hero-description">Todo lo que necesitas para seguir tu {{ expediente.campaign === 'Renta' ? 'Renta' : 'Modelo 720' }}, paso a paso.</p>
        <div class="hero-meta">
          <span><i class="pi pi-folder" aria-hidden="true" /> {{ expediente.id }}</span>
          <span><i class="pi pi-tag" aria-hidden="true" /> Campaña {{ expediente.campaign }} · escenario ficticio</span>
        </div>
      </div>
      <div class="hero-next">
        <span class="next-label">Tu siguiente paso</span>
        <p>{{ nextStep }}</p>
        <div class="advisor">
          <span class="avatar" aria-hidden="true">{{ expediente.owner ? initials(expediente.owner) : '—' }}</span>
          <div><span>Tu profesional responsable</span><strong>{{ expediente.owner || 'Pendiente de asignación' }}</strong></div>
        </div>
      </div>
    </header>

    <div ref="feedback" class="portal-feedback" tabindex="-1" aria-live="polite" :aria-label="localError || localMessage || 'Avisos del portal'">
      <Message v-if="localError" severity="error" :closable="false" role="alert">{{ localError }}</Message>
      <Message v-if="localMessage" severity="info" :closable="false">{{ localMessage }}</Message>
      <Message v-if="downloadError" severity="error" :closable="false" role="alert">{{ downloadError }}</Message>
    </div>

    <section class="progress-card" :aria-labelledby="fieldId('progress')">
      <div class="section-heading">
        <div><p class="eyebrow">Sin perder el hilo</p><h2 :id="fieldId('progress')">Tu expediente, de un vistazo</h2></div>
        <strong class="progress-number">{{ declined ? 'Seguimiento detenido' : `${progress}% del recorrido simulado` }}</strong>
      </div>
      <ProgressBar v-if="!declined" :value="progress" :show-value="false" aria-label="Progreso del expediente de demostración" />
      <ol class="progress-steps">
        <li v-for="(step, index) in steps" :key="step.label" :class="{ 'step-complete': step.complete }">
          <span class="step-marker" aria-hidden="true"><i v-if="step.complete" class="pi pi-check" /><template v-else>{{ index + 1 }}</template></span>
          <span>{{ step.label }}<small>{{ step.complete ? (index === 1 && prior720 ? 'PH previa; no nueva firma' : 'Registrado en el escenario') : 'Pendiente' }}</small></span>
        </li>
      </ol>
      <p class="muted small">Progreso orientativo del mockup. No acredita validaciones fiscales ni servicios realizados.</p>
    </section>

    <section v-if="declined" class="portal-card thank-you" :aria-labelledby="fieldId('thanks')">
      <span class="section-icon"><i class="pi pi-heart" aria-hidden="true" /></span>
      <div>
        <h2 :id="fieldId('thanks')">{{ expediente.contact === 'Retirado' ? 'Retirada registrada en el escenario' : 'Gracias por tu respuesta' }}</h2>
        <p>{{ expediente.contact === 'Retirado' ? 'Has indicado que no deseas continuar con este servicio. No es una solicitud de renegociación.' : 'Entendemos que esta campaña no encaja contigo en este momento.' }}</p>
        <p class="muted">Seguimiento de esta campaña detenido. Historial conservado; otras campañas no cambian. Para dudas, el contacto del escenario es {{ expediente.owner || 'el equipo pendiente de asignación' }}; no se envía ningún mensaje real.</p>
      </div>
    </section>

    <section v-if="capturePending" class="portal-card" :aria-labelledby="fieldId('capture')">
      <div class="section-heading">
        <div><p class="eyebrow">01 · Empezamos contigo</p><h2 :id="fieldId('capture')">¿Te acompañamos en esta campaña?</h2></div>
        <Tag :value="expediente.contact" :severity="statusSeverity(expediente.contact)" />
      </div>
      <p class="muted">Responde a la invitación de demostración. Aceptar solicita una propuesta; no contrata un servicio ni firma la PH.</p>
      <form novalidate @submit.prevent="openConfirmation('respond')">
        <div class="form-grid">
          <div class="field"><label :for="fieldId('name')">Nombre del escenario</label><InputText :id="fieldId('name')" :model-value="expediente.name" readonly /></div>
          <div class="field"><label :for="fieldId('email')">Correo del escenario</label><InputText :id="fieldId('email')" :model-value="expediente.email" readonly /></div>
          <template v-if="expediente.campaign === 'Renta'">
            <div class="field"><label :for="fieldId('renta-type')">Tipo de renta ilustrativo</label><Select v-model="rentaType" :input-id="fieldId('renta-type')" aria-label="Tipo de Renta" :options="rentaTypes" /></div>
            <div class="field"><label :for="fieldId('presenter')">¿Quién presenta?</label><Select v-model="presenter" :input-id="fieldId('presenter')" aria-label="Presentador" :options="presenters" option-label="label" option-value="value" /></div>
          </template>
          <template v-else>
            <div class="field">
              <label :for="fieldId('identity-number')">Identificador de DNI ficticio <span>(obligatorio)</span></label>
              <InputText :id="fieldId('identity-number')" v-model="identityNumber" placeholder="DEMO-IDENTIDAD-001" :invalid="Boolean(formErrors.identityNumber)" :aria-describedby="fieldId('identity-number-help')" />
              <small :id="fieldId('identity-number-help')" :class="{ 'field-error': formErrors.identityNumber }">{{ formErrors.identityNumber || 'Solo validación local del formulario. No se almacena ni verifica oficialmente.' }}</small>
            </div>
            <div class="field">
              <label :for="fieldId('expiry')">Vigencia del DNI de muestra <span>(obligatorio)</span></label>
              <InputText :id="fieldId('expiry')" v-model="expiry" type="date" :invalid="Boolean(formErrors.expiry)" :aria-describedby="fieldId('expiry-help')" />
              <small :id="fieldId('expiry-help')" :class="{ 'field-error': formErrors.expiry }">{{ formErrors.expiry || 'Comprobación ficticia; sin OCR ni comprobación de identidad real.' }}</small>
            </div>
            <div class="field">
              <label :for="fieldId('reference-date')">Fecha de comprobación ficticia</label>
              <InputText :id="fieldId('reference-date')" v-model="referenceDate" type="date" :invalid="Boolean(formErrors.expiry)" :aria-describedby="fieldId('expiry-help')" />
              <small>Valor inicial: fecha de contacto del escenario. Ajusta al reloj de demostración; no es una fecha legal.</small>
            </div>
          </template>
        </div>
        <Message v-if="formErrors.contact" severity="error" :closable="false" role="alert">{{ formErrors.contact }}</Message>
        <div v-if="expediente.campaign === 'Renta'" class="fee-preview">
          <div><strong>{{ money(illustrativeFee) }}</strong><span>Honorarios ilustrativos</span></div>
          <p>Individual: 150 € · Conjunta: 250 €. Catálogo de demostración, sin impuestos ni validez comercial. El socio podrá revisar la propuesta. DNI no exigido en este formulario.</p>
        </div>
        <Message v-else :severity="formErrors.identity ? 'error' : 'info'" :closable="false" :role="formErrors.identity ? 'alert' : 'status'">
          {{ formErrors.identity || 'Antes de solicitar una PH nueva, añade las dos caras del DNI ficticio en el bloque documental y comprueba su vigencia.' }}
        </Message>
        <div class="consent-row">
          <Checkbox v-model="consent" :input-id="fieldId('consent')" binary :invalid="Boolean(formErrors.consent)" :aria-describedby="formErrors.consent ? fieldId('consent-help') : undefined" />
          <label :for="fieldId('consent')">Acepto recibir una propuesta de honorarios simulada, sin efectos reales.</label>
        </div>
        <p v-if="formErrors.consent" :id="fieldId('consent-help')" class="field-error" role="alert">{{ formErrors.consent }}</p>
        <Message v-if="!expediente.owner" severity="warn" :closable="false">Responsable pendiente de asignación. No se afirmará que un abogado ha recibido una notificación.</Message>
        <div class="actions"><Button type="submit" label="Revisar mi respuesta" icon="pi pi-arrow-right" /><Button label="No me interesa esta campaña" severity="secondary" outlined @click="openConfirmation('decline')" /></div>
      </form>
    </section>

    <div class="portal-grid">
      <section class="portal-card" :aria-labelledby="fieldId('ph')">
        <div class="section-heading">
          <div><p class="eyebrow">Acuerdo de servicio</p><h2 :id="fieldId('ph')">Propuesta de honorarios</h2></div>
          <Tag :value="prior720 ? 'PH previa' : expediente.ph.state" :severity="prior720 ? 'info' : statusSeverity(expediente.ph.state)" />
        </div>
        <template v-if="prior720">
          <Message severity="info" :closable="false">Este escenario 720 parte de una PH previa. No se genera otra propuesta ni se solicita una nueva firma.</Message>
          <p class="muted">Antecedente importado del escenario. Su vigencia y alcance no se pueden comprobar aquí; no se inventan aprobación, firma ni validaciones de alta.</p>
          <p v-if="!expediente.ph.priorConfirmed" class="notice">Antecedentes por revisar por el equipo. La PH previa no demuestra por sí sola que las demás comprobaciones estén realizadas.</p>
        </template>
        <template v-else-if="phVisible">
          <div class="proposal-preview">
            <div><span class="document-label">Muestra de propuesta · v{{ expediente.ph.version }}</span><i class="pi pi-file-edit" aria-hidden="true" /></div>
            <h3>{{ expediente.campaign === 'Renta' ? 'Preparación de la Renta' : 'Preparación del Modelo 720' }}</h3>
            <p>Alcance ilustrativo: preparación y revisión de documentación; {{ expediente.campaign === 'Renta' && expediente.presenter === 'Cliente' ? 'presentación a cargo del cliente.' : 'presentación prevista por RCD en el escenario.' }}</p>
            <strong class="proposal-fee">{{ money(expediente.fee) }}</strong>
            <span class="muted small">Importe del escenario. Sin impuestos ni validez comercial.</span>
          </div>
          <dl class="detail-list">
            <div><dt>Versión vigente</dt><dd>v{{ expediente.ph.version }}</dd></div>
            <div><dt>Aprobación registrada</dt><dd>{{ expediente.ph.approvedVersion === null ? 'No registrada' : `v${expediente.ph.approvedVersion}` }}</dd></div>
            <div><dt>Firma registrada</dt><dd>{{ expediente.ph.signedVersion === null ? 'No registrada' : `v${expediente.ph.signedVersion}` }}</dd></div>
            <div><dt>Envío registrado</dt><dd>{{ formatDate(expediente.ph.sentAt) }}</dd></div>
          </dl>
          <p v-if="expediente.ph.signedVersion !== null && !signedCurrent" class="notice">La firma registrada no valida automáticamente la versión actual.</p>
          <p v-if="expediente.campaign === 'Renta' && expediente.presenter === 'RCD'" class="muted small">La autorización de uso del certificado es independiente de esta PH. Una cláusula o una firma de demostración no la hace disponible.</p>
          <Message v-if="expediente.ph.state === 'Rechazada'" severity="warn" :closable="false">Renegociación pendiente. El equipo debe revisar, validar y reenviar una propuesta. El expediente no se archiva por pedir cambios.</Message>
          <Message v-if="expediente.ph.state === 'Enviada' && !canSign && !readOnly" severity="warn" :closable="false">Firma bloqueada: falta aprobación de la versión actual o registro de su envío.</Message>
          <div class="actions">
            <Button label="Descargar muestra TXT" icon="pi pi-download" severity="secondary" outlined @click="downloadSample('ph')" />
            <Button v-if="canSign" label="Simular firma" icon="pi pi-pencil" @click="openConfirmation('ph-sign')" />
            <Button v-if="canSign" label="Solicitar cambios" severity="secondary" text @click="openConfirmation('ph-reject')" />
          </div>
        </template>
        <template v-else>
          <div class="empty-state"><i class="pi pi-file-edit" aria-hidden="true" /><h3>La propuesta aún no está disponible</h3><p>{{ needsEarlyIdentity ? 'En 720 sin PH previa, el DNI ficticio de dos caras precede a la preparación de la propuesta.' : 'Tras tu aceptación, el equipo revisa la propuesta y la envía manualmente. No hay firma automática.' }}</p></div>
        </template>
        <p class="footnote">Firma y descargas ficticias. No se usa Signaturit ni se genera un PDF contractual.</p>
      </section>

      <section class="portal-card support-card" :aria-labelledby="fieldId('guide')">
        <div class="section-heading"><div><p class="eyebrow">A tu ritmo</p><h2 :id="fieldId('guide')">Qué ocurre ahora</h2></div><i class="pi pi-compass card-heading-icon" aria-hidden="true" /></div>
        <p class="guide-next">{{ nextStep }}</p>
        <ul class="guide-list">
          <li><i class="pi pi-upload" aria-hidden="true" /><div><strong>Aporta muestras</strong><span>Guardamos bytes reales en disco privado local y versiones en SQL.</span></div></li>
          <li><i class="pi pi-send" aria-hidden="true" /><div><strong>Entrega explícitamente</strong><span>Añadir archivos no los entrega al profesional.</span></div></li>
          <li><i class="pi pi-user" aria-hidden="true" /><div><strong>Revisión humana</strong><span>Tu profesional decide si falta información. Entregar no valida.</span></div></li>
        </ul>
        <div v-if="canWithdraw" class="withdraw-block">
          <p>¿Quieres dejar este servicio? Pedir ajustes mantiene abierto el expediente; retirarte detiene su seguimiento.</p>
          <Button label="No deseo continuar" severity="danger" outlined @click="openConfirmation('withdraw')" />
        </div>
      </section>

      <section class="portal-card documents-card full-width" :aria-labelledby="fieldId('documents')">
        <div class="section-heading">
          <div><p class="eyebrow">Tu carpeta de muestras</p><h2 :id="fieldId('documents')">Documentación</h2></div>
          <Tag :value="documentStatus" :severity="expediente.docsComplete ? 'success' : expediente.delivered ? 'info' : 'secondary'" />
        </div>
        <p class="muted">Requisitos ilustrativos, no un checklist fiscal aprobado. La validación del conjunto corresponde al profesional, no al número de archivos.</p>
        <Message v-if="needsEarlyIdentity" severity="info" :closable="false">720 sin PH previa: DNI anverso y reverso antes de preparar la propuesta. Añadir ambas muestras no verifica tu identidad oficialmente.</Message>
        <Message v-if="!canUpload && !readOnly" severity="info" :closable="false">La aportación se habilita cuando el equipo envía el acceso documental{{ expediente.campaign === 'Renta' ? ', después de la PH y las validaciones del escenario' : '' }}.</Message>
        <Message v-if="expediente.docsComplete" severity="success" :closable="false">El escenario registra validación manual del conjunto por el profesional. Sustituir una versión requerirá nueva revisión, no aprobación automática.</Message>
        <div class="document-layout">
          <div class="requirement-list">
            <h3>Qué necesitamos en este escenario</h3>
            <div v-if="expediente.identity.dni" class="identity-known"><i class="pi pi-id-card" aria-hidden="true" /> DNI disponible según los datos recibidos. Las muestras documentales y su revisión se muestran por separado.</div>
            <article v-for="requirement in requirements" :key="requirement.kind" class="requirement-row">
              <span class="requirement-icon"><i :class="currentDocument(requirement.kind)?.state === 'Válido' ? 'pi pi-check' : 'pi pi-file'" aria-hidden="true" /></span>
              <div>
                <h4>{{ requirement.kind }} <span class="requirement-badge">{{ requirement.required ? 'Requerido · supuesto' : 'Opcional' }}</span></h4>
                <p>{{ requirement.hint }}</p>
                <Tag :value="currentDocument(requirement.kind)?.state || 'No aportado'" :severity="statusSeverity(currentDocument(requirement.kind)?.state || 'Pendiente')" />
                <p v-if="currentDocument(requirement.kind)?.state === 'Sustituir'" class="field-error">{{ currentDocument(requirement.kind)?.note || 'El profesional solicita una nueva versión.' }}</p>
              </div>
            </article>
            <div v-if="missingRequirements.length" class="missing-box">
              <strong>Faltantes o sustituciones pendientes</strong>
              <ul><li v-for="item in missingRequirements" :key="item.kind">{{ item.kind }}</li></ul>
              <p>Puedes entregar una tanda parcial cuando el portal esté habilitado. El equipo podrá pedir más información.</p>
            </div>
            <p v-else-if="!expediente.docsComplete" class="notice">Muestras requeridas presentes. {{ waitingReview.length ? `${waitingReview.length} requisito(s) todavía sin aceptar.` : 'Pendiente de validación manual del conjunto.' }} Esto no significa documentación completa.</p>
          </div>

          <form v-if="canUpload" class="upload-panel" novalidate @submit.prevent="openConfirmation('add-document')">
            <span class="upload-symbol"><i class="pi pi-cloud-upload" aria-hidden="true" /></span>
            <h3>Añadir una muestra</h3>
            <p>PDF, JPEG, PNG, DOC/DOCX o XLS/XLSX · máximo <strong>10 MB (10.000.000 bytes)</strong> por archivo. Usa únicamente archivos ficticios.</p>
            <div class="field">
              <label :for="fieldId('document-kind')">Tipo documental <span>(obligatorio)</span></label>
              <Select v-model="selectedKind" :input-id="fieldId('document-kind')" aria-label="Tipo documental" :options="uploadKinds" placeholder="Selecciona un tipo" :aria-describedby="uploadError ? fieldId('upload-error') : undefined" />
            </div>
            <div class="field">
              <label :for="fieldId('file')">Archivo ficticio <span>(obligatorio)</span></label>
              <input :id="fieldId('file')" ref="fileInput" class="native-file" type="file" :accept="fileAccept" :aria-invalid="Boolean(uploadError)" :aria-describedby="uploadError ? `${fieldId('file-help')} ${fieldId('upload-error')}` : fieldId('file-help')" @change="chooseFile" />
              <small :id="fieldId('file-help')">Carga real privada: conserva selección hasta confirmar SQL y disco. Extensión/MIME no son antivirus ni validación legal.</small>
            </div>
            <div v-if="selectedFile" class="file-summary"><i class="pi pi-file" aria-hidden="true" /><div><strong>{{ selectedFile.name }}</strong><span>{{ formatSize(selectedFile.size) }} · {{ selectedFile.type || 'MIME no informado' }}</span></div></div>
            <Message v-if="selectedKind && currentDocument(selectedKind)" severity="warn" :closable="false">
              Ya existe v{{ currentDocument(selectedKind)?.version }} de este tipo. Confirmar añade una nueva versión, incluso si repites el nombre; no borra las anteriores.
            </Message>
            <p v-if="uploadError" :id="fieldId('upload-error')" class="field-error" role="alert">{{ uploadError }}</p>
            <Button type="submit" :label="selectedKind && currentDocument(selectedKind) ? 'Revisar nueva versión' : 'Revisar archivo real'" icon="pi pi-plus" :disabled="pending" :loading="pending" />
          </form>
        </div>

        <div class="document-history">
          <div class="subsection-heading"><h3>Archivos y versiones</h3><span class="muted small">{{ expediente.documents.length }} registro(s) de metadatos</span></div>
          <div v-if="!documentGroups.length" class="empty-files"><i class="pi pi-inbox" aria-hidden="true" /><p>Aún no hay muestras. Añadir una no la entrega ni la valida.</p></div>
          <article v-for="group in documentGroups" :key="group.kind" class="document-group">
            <div class="document-current">
              <i class="pi pi-file document-file-icon" aria-hidden="true" />
              <div class="document-name"><h4>{{ group.kind }}</h4><p>{{ group.current.name }}</p><span class="muted small">Versión actual v{{ group.current.version }} · {{ formatSize(group.current.size) }}</span></div>
              <Tag :value="group.current.state" :severity="statusSeverity(group.current.state)" />
              <Button label="Original real" icon="pi pi-download" severity="secondary" text :disabled="!files.some(file => file.documentId === group.current.id && file.fileId)" :aria-label="`Descargar original de ${group.kind}, versión ${group.current.version}`" @click="downloadSample('document', group.current)" />
            </div>
            <p v-if="group.current.state === 'Sustituir'" class="document-note field-error">Sustitución solicitada: {{ group.current.note || 'Aporta una nueva versión de demostración.' }}</p>
            <p v-else-if="group.current.note" class="document-note muted">{{ group.current.note }}</p>
            <details v-if="group.versions.length > 1" class="version-history">
              <summary>Consultar {{ group.versions.length - 1 }} versión(es) sustituida(s)</summary>
              <ul><li v-for="version in group.versions.slice(1)" :key="version.id"><div><strong>v{{ version.version }} · {{ version.name }}</strong><span>Sustituida · {{ formatSize(version.size) }} · revisión histórica: {{ version.state }}</span><span v-if="version.note">{{ version.note }}</span></div><Button label="Original histórico" severity="secondary" text :disabled="!files.some(file => file.documentId === version.id && file.fileId)" :aria-label="`Descargar original histórico de ${group.kind}, versión ${version.version}`" @click="downloadSample('document', version)" /></li></ul>
            </details>
          </article>
        </div>
        <Message v-if="expediente.tax.state !== 'Pendiente' && canUpload" severity="warn" :closable="false">La preparación fiscal ya ha comenzado. Una nueva versión puede requerir revisar el conjunto y actualizar el borrador; no elimina una presentación histórica.</Message>
        <div class="delivery-panel">
          <div><h3>{{ expediente.delivered ? 'Entrega registrada para revisión' : '¿Lista tu tanda de documentación?' }}</h3><p>{{ expediente.delivered ? 'El equipo revisará lo aportado. Si añades otra versión, deberás entregar de nuevo. Entrega y revisión son pasos distintos.' : 'Haz una entrega explícita. Tener muestras añadidas no avisa por sí solo de que has terminado.' }}</p></div>
          <Button v-if="!readOnly && expediente.portalSent" label="Entregar al profesional · simulación" icon="pi pi-send" :disabled="!canDeliver" @click="openConfirmation('deliver-documents')" />
        </div>
        <p v-if="!readOnly && expediente.portalSent && !expediente.documents.length" class="muted small">No se puede entregar una tanda vacía.</p>
        <p v-if="!expediente.owner && canDeliver" class="notice">Responsable sin asignar. La entrega quedará en el escenario, sin afirmar que se ha notificado a un abogado concreto.</p>
      </section>

      <section class="portal-card" :aria-labelledby="fieldId('tax')">
        <div class="section-heading">
          <div><p class="eyebrow">Preparación fiscal</p><h2 :id="fieldId('tax')">{{ expediente.campaign === 'Renta' ? 'Tu borrador de Renta' : 'Tu Modelo 720' }}</h2></div>
          <Tag :value="expediente.tax.state" :severity="statusSeverity(expediente.tax.state)" />
        </div>
        <template v-if="draftVisible">
          <div class="draft-preview"><span class="document-label">Versión actual · v{{ expediente.tax.version }}</span><h3>Resumen de demostración</h3><p>Resultado precargado, no calculado con tus documentos:</p><strong>A devolver 125 €</strong><span class="small">Sin validez fiscal. No es una declaración.</span></div>
          <dl class="detail-list">
            <div><dt>Presentador del escenario</dt><dd>{{ expediente.presenter === 'Cliente' ? 'Tú, como cliente' : 'RCD' }}</dd></div>
            <div><dt>Acuerdo registrado</dt><dd>{{ expediente.tax.acceptedVersion === null ? 'Ninguno' : `v${expediente.tax.acceptedVersion}` }}</dd></div>
          </dl>
          <Message v-if="expediente.tax.acceptedVersion !== null && !agreedCurrent" severity="warn" :closable="false">El acuerdo anterior no corresponde a la versión actual. Una nueva versión requiere nuevo acuerdo.</Message>
          <Message v-if="expediente.tax.state === 'Cambios solicitados'" severity="warn" :closable="false">Revisión solicitada: el profesional prepara una nueva versión.</Message>
          <div class="actions"><Button label="Descargar borrador TXT ficticio" icon="pi pi-download" severity="secondary" outlined @click="downloadSample('draft')" /><Button v-if="canRespondToDraft" label="Estoy de acuerdo · simulación" icon="pi pi-check" @click="openConfirmation('tax-accept')" /><Button v-if="canRespondToDraft" label="Solicitar revisión" severity="secondary" text @click="openConfirmation('tax-change')" /></div>
          <details v-if="expediente.tax.drafts?.length" class="version-history draft-history">
            <summary>Registros de versiones del borrador</summary>
            <ul><li v-for="draft in expediente.tax.drafts" :key="draft.version"><div><strong>v{{ draft.version }} · {{ formatDate(draft.date) }}</strong><span>{{ draft.version === expediente.tax.version ? 'Versión actual' : 'Versión anterior, no vigente' }} · registro de preparación, no prueba de envío o aceptación</span></div></li></ul>
          </details>
          <div v-if="expediente.presenter === 'Cliente' && !presented" class="presentation-panel">
            <h3>Presentación por ti</h3>
            <p>Aceptar el borrador no significa presentarlo. Esta pantalla solo permite registrar una confirmación ficticia; no tramita nada ante Hacienda.</p>
            <p class="muted small">No existe fecha límite configurada en los datos recibidos. No se inventa un plazo legal. Certificado y autorización de RCD: no aplican a tu presentación.</p>
            <Button v-if="canPresent" label="Simular confirmación de mi presentación" icon="pi pi-check-circle" @click="openConfirmation('present')" />
            <p v-else class="notice">Registro bloqueado hasta tener PH firmada vigente, documentación validada, acuerdo del borrador vigente y requisitos del expediente confirmados por el equipo.</p>
          </div>
          <p v-else-if="!presented" class="notice">Presentación prevista por RCD. Solo el profesional puede registrarla en el escenario; requiere certificado y autorización disponibles.</p>
        </template>
        <div v-else class="empty-state"><i :class="expediente.campaign === 'Renta' ? 'pi pi-file-check' : 'pi pi-globe'" aria-hidden="true" /><h3>{{ expediente.campaign === 'Renta' ? 'El borrador llegará a este espacio' : 'Preparación a cargo del equipo' }}</h3><p>{{ expediente.campaign === 'Renta' ? 'El profesional valida los documentos, prepara el borrador y lo envía para tu revisión. No se muestra un borrador interno como si ya se hubiera enviado.' : 'La documentación del Modelo 720 la revisa el profesional. No hay acciones de aceptación ni presentación de Renta en esta campaña.' }}</p></div>
        <p v-if="draftVisible" class="footnote">Los datos recibidos identifican la versión actual, el acuerdo y, cuando existen, registros de preparación. No contienen copias de borradores anteriores; no se inventan contenidos históricos.</p>
      </section>

      <section class="portal-card" :aria-labelledby="fieldId('receipt-invoice')">
        <div class="section-heading"><div><p class="eyebrow">Al final del recorrido</p><h2 :id="fieldId('receipt-invoice')">Justificante y factura</h2></div><i class="pi pi-receipt card-heading-icon" aria-hidden="true" /></div>
        <article class="final-document">
          <span class="section-icon"><i class="pi pi-file-check" aria-hidden="true" /></span>
          <div><h3>Justificante de demostración</h3>
            <template v-if="expediente.campaign === 'Renta' && expediente.presenter === 'Cliente'">
              <p>{{ presented ? 'Confirmación de presentación por el cliente registrada.' : 'Pendiente de tu confirmación ficticia.' }}</p>
              <p class="muted small">Justificante oficial opcional; no se conserva ningún archivo. Envío de justificante por RCD: no aplica.</p>
            </template>
            <p v-else>{{ receiptAvailable ? 'Envío simulado del justificante registrado en el escenario.' : 'Todavía no hay justificante enviado disponible para el cliente.' }}</p>
            <p v-if="receiptAvailable" class="reference">{{ expediente.tax.receipt }}</p>
            <Button v-if="receiptAvailable" label="Descargar justificante TXT ficticio" icon="pi pi-download" severity="secondary" text @click="downloadSample('receipt')" />
          </div>
        </article>
        <article class="final-document">
          <span class="section-icon"><i class="pi pi-wallet" aria-hidden="true" /></span>
          <div><h3>Factura / minuta ficticia</h3><p>{{ invoiceAvailable ? `Referencia ${expediente.invoice.number} · ${money(expediente.invoice.amount)}` : 'Disponible cuando el equipo registre su envío simulado.' }}</p><p class="muted small">Sin emisión contable ni cobro. El cierre del expediente no significa que esté pagada.</p><Button v-if="invoiceAvailable" label="Descargar factura TXT ficticia" icon="pi pi-download" severity="secondary" text @click="downloadSample('invoice')" /></div>
        </article>
        <Message v-if="closed" severity="success" :closable="false">Cierre operativo registrado en el escenario. Consulta disponible; acciones de edición deshabilitadas. No acredita presentación real ni pago.</Message>
        <p class="footnote">Todas las descargas son TXT generados localmente, nunca PDF reales ni reproducciones de tus archivos.</p>
      </section>
    </div>

    <footer class="portal-footer"><span>RCD · Portal cliente de demostración</span><span>SQL y bytes locales reales. Seed solo metadatos; TXT/CSV ficticios. Sin correo ni integraciones reales.</span></footer>

    <Dialog v-model:visible="dialogVisible" modal :header="dialogTitle" class="portal-dialog" :style="{ width: 'min(36rem, calc(100vw - 2rem))' }" :draggable="false" :dismissable-mask="false">
      <div class="confirmation-content">
        <Message severity="warn" :closable="false"><strong>Simulación sin efectos reales.</strong> {{ dialogDescription }}</Message>
        <dl v-if="intent === 'respond' && expediente.campaign === 'Renta'" class="detail-list"><div><dt>Tipo</dt><dd>{{ rentaType }}</dd></div><div><dt>Presentador</dt><dd>{{ presenter }}</dd></div><div><dt>Tarifa ilustrativa</dt><dd>{{ money(illustrativeFee) }}</dd></div></dl>
        <p v-if="intent === 'respond' && expediente.campaign === '720'" class="muted small">El identificador ficticio se comprueba solo aquí y no se persiste. La vigencia se remite al escenario; no hay validación oficial.</p>
        <div v-if="intent === 'add-document' && selectedFile" class="file-summary"><i class="pi pi-file" aria-hidden="true" /><div><strong>{{ selectedFile.name }}</strong><span>{{ selectedKind }} · {{ formatSize(selectedFile.size) }}</span><span v-if="selectedKind && currentDocument(selectedKind)">Sustituye la versión actual; conserva el historial.</span></div></div>
        <p v-if="intent === 'deliver-documents' && missingRequirements.length" class="notice">Entrega parcial: {{ missingRequirements.map(item => item.kind).join(', ') }} pendiente(s). La revisión podrá solicitar más documentación.</p>
        <div v-if="editableNote" class="field">
          <label :for="fieldId('action-note')">{{ intent === 'withdraw' ? 'Motivo de retirada definitiva' : 'Qué necesitas cambiar' }} <span>(obligatorio)</span></label>
          <Textarea :id="fieldId('action-note')" v-model="note" rows="4" auto-resize :maxlength="1000" :invalid="Boolean(dialogError && !note.trim())" :aria-describedby="fieldId('dialog-error')" />
        </div>
        <div v-if="intent === 'present'" class="field">
          <label :for="fieldId('presentation-date')">Fecha de presentación ficticia <span>(obligatoria)</span></label>
          <InputText :id="fieldId('presentation-date')" v-model="presentationDate" type="date" :aria-describedby="fieldId('presentation-date-help')" />
          <small :id="fieldId('presentation-date-help')">Fecha del escenario, editable. No debe superar su reloj de demostración; no fija un plazo legal ni acredita un trámite real.</small>
        </div>
        <div v-if="intent === 'present'" class="field">
          <label :for="fieldId('receipt-reference')">Referencia ficticia de la confirmación <span>(obligatoria)</span></label>
          <InputText :id="fieldId('receipt-reference')" v-model="receiptReference" :maxlength="120" :aria-describedby="fieldId('receipt-reference-help')" />
          <small :id="fieldId('receipt-reference-help')">No uses referencias reales. Generamos una referencia del escenario, no un justificante oficial ni una prueba de presentación.</small>
        </div>
        <div class="consent-row">
          <Checkbox v-model="confirmedSimulation" :input-id="fieldId('confirm-simulation')" binary :aria-describedby="dialogError ? fieldId('dialog-error') : undefined" />
          <label :for="fieldId('confirm-simulation')">Entiendo que confirmo una simulación, sin firma, envío, contratación ni presentación real.</label>
        </div>
        <p v-if="dialogError" :id="fieldId('dialog-error')" class="field-error" role="alert">{{ dialogError }}</p>
      </div>
      <template #footer><Button label="Cancelar" severity="secondary" outlined :disabled="pending" @click="dialogVisible = false" /><Button :label="intent === 'withdraw' ? 'Confirmar retirada simulada' : 'Confirmar simulación'" :severity="intent === 'withdraw' ? 'danger' : undefined" :disabled="pending" @click="confirmAction" /></template>
    </Dialog>
  </main>
</template>

<style scoped>
.client-portal {
  --brand: var(--rcd-blue);
  --brand-deep: var(--rcd-deep);
  --accent: var(--rcd-sky);
  --ink: var(--rcd-ink);
  --muted: var(--rcd-muted);
  --line: var(--rcd-line);
  --p-primary-color: var(--rcd-blue);
  --p-primary-hover-color: var(--rcd-blue);
  --p-primary-active-color: var(--rcd-deep);
  --p-primary-contrast-color: #fff;
  --p-highlight-background: var(--rcd-soft);
  --p-highlight-color: var(--rcd-blue);
  color: var(--ink);
  background: var(--rcd-page);
  padding: clamp(1rem, 3vw, 2.5rem);
  border-radius: 1.5rem;
  max-width: 1440px;
  margin: 0 auto;
  line-height: 1.6;
}
.client-portal h1, .client-portal h2, .client-portal h3, .client-portal h4,
.client-portal p, .confirmation-content p { margin: 0; }
.client-portal h1 { font-size: clamp(1.8rem, 4vw, 2.9rem); line-height: 1.2; font-weight: 650; letter-spacing: -.035em; }
.client-portal h2 { font-size: 1.28rem; line-height: 1.35; font-weight: 650; letter-spacing: -.02em; }
.client-portal h3 { font-size: 1.03rem; line-height: 1.5; font-weight: 650; }
.client-portal h4 { font-size: .96rem; font-weight: 650; }
.client-portal :deep(.p-button) { min-height: 2.75rem; font-size: .875rem; white-space: normal; text-align: left; }
.client-portal :deep(.p-button-label) { line-height: 1.4; }
.client-portal :deep(.p-tag) { flex-shrink: 0; font-size: .74rem; white-space: normal; }
.client-portal :deep(.p-message) { margin: .9rem 0; font-size: .9rem; }
.client-portal :deep(.p-message-content) { align-items: flex-start; }
.client-portal :deep(.p-inputtext), .client-portal :deep(.p-select), .client-portal :deep(.p-textarea),
.confirmation-content :deep(.p-inputtext), .confirmation-content :deep(.p-textarea) { width: 100%; min-width: 0; }
.client-portal :deep(.p-progressbar) { height: .5rem; background: var(--rcd-soft); border-radius: 1rem; margin: 1.35rem 0 1.5rem; }
.client-portal :deep(.p-progressbar-value) { background: var(--rcd-chart-3); border-radius: 1rem; }
.simulation-banner { display: flex; align-items: center; gap: .75rem; font-size: .8rem; color: var(--rcd-body); padding: 0 .25rem 1rem; }
.simulation-banner > span { flex: 1; }
.simulation-banner > i { font-size: 1.05rem; }
.portal-hero { display: grid; grid-template-columns: 1.4fr 1fr; gap: 2rem; padding: clamp(1.5rem, 3vw, 2.7rem); color: white; background: linear-gradient(120deg, var(--brand-deep), var(--rcd-blue)); border-radius: 1.25rem; overflow: hidden; }
.eyebrow { font-size: .69rem; text-transform: uppercase; letter-spacing: .13em; font-weight: 700; color: var(--muted); margin-bottom: .45rem !important; }
.hero-copy .eyebrow { color: var(--accent); margin-bottom: 1rem !important; }
.hero-description { color: var(--rcd-on-blue); margin-top: 1rem !important; max-width: 33rem; font-size: .98rem; }
.hero-meta { display: flex; flex-wrap: wrap; gap: .65rem 1.3rem; margin-top: 1.5rem; font-size: .77rem; color: var(--rcd-on-blue); }
.hero-meta span { display: inline-flex; align-items: center; gap: .45rem; }
.hero-next { padding-left: 2rem; border-left: 1px solid #ffffff26; display: flex; flex-direction: column; justify-content: center; }
.next-label { text-transform: uppercase; letter-spacing: .12em; font-size: .66rem; color: var(--accent); font-weight: 700; }
.hero-next > p { font-family: var(--rcd-font-editorial); font-weight: 400; font-size: 1.13rem; line-height: 1.55; margin-top: .55rem !important; }
.advisor { display: flex; align-items: center; gap: .75rem; margin-top: 1.4rem; }
.avatar { width: 2.65rem; height: 2.65rem; border-radius: 50%; display: grid; place-items: center; color: var(--brand); background: var(--accent); font-size: .8rem; font-weight: 700; flex-shrink: 0; }
.advisor div { display: flex; flex-direction: column; }
.advisor div span { font-size: .68rem; color: var(--rcd-on-blue); }
.advisor strong { font-size: .83rem; font-weight: 600; }
.portal-feedback { outline-offset: .3rem; }
.portal-feedback:empty { display: none; }
.progress-card, .portal-card { background: white; border: 1px solid var(--line); padding: clamp(1.2rem, 2.5vw, 1.8rem); border-radius: 1rem; box-shadow: 0 4px 18px #24358804; }
.progress-card { margin: 1.25rem 0; }
.section-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1.1rem; }
.section-heading > div { min-width: 0; }
.progress-number { font-size: .8rem; color: var(--rcd-body); }
.progress-steps { display: grid; grid-template-columns: repeat(5, 1fr); list-style: none; padding: 0; margin: 0 0 1rem; gap: 1rem; }
.progress-steps li { display: flex; gap: .65rem; align-items: flex-start; font-size: .8rem; color: var(--muted); line-height: 1.45; }
.step-marker { width: 1.85rem; height: 1.85rem; background: var(--rcd-soft); color: var(--rcd-muted); border-radius: 50%; display: grid; place-items: center; flex-shrink: 0; font-size: .76rem; font-weight: 650; }
.step-complete .step-marker { background: #e5f0cf; color: #365729; }
.step-complete > span:last-child { color: var(--rcd-success); }
.progress-steps small { display: block; font-size: .65rem; color: var(--muted); margin-top: .25rem; }
.muted { color: var(--muted); }
.small, .footnote { font-size: .77rem; }
.portal-card > .muted { font-size: .87rem; margin-bottom: 1rem; }
.portal-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 1.25rem; margin-top: 1.25rem; align-items: start; }
.portal-grid > *, .document-layout > * { min-width: 0; }
.full-width { grid-column: 1 / -1; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.05rem; }
.field { display: flex; flex-direction: column; gap: .45rem; min-width: 0; }
.field label { font-size: .82rem; font-weight: 600; }
.field label > span { color: var(--rcd-muted); font-weight: 400; }
.field small { font-size: .73rem; color: var(--rcd-muted); line-height: 1.5; }
.field-error { color: #b42332 !important; font-size: .8rem; line-height: 1.5; }
.consent-row { display: flex; align-items: flex-start; gap: .65rem; margin-top: 1.2rem; font-size: .85rem; }
.consent-row :deep(.p-checkbox) { flex-shrink: 0; margin-top: .2rem; }
.consent-row label { cursor: pointer; }
.fee-preview { display: flex; align-items: center; gap: 1.4rem; background: var(--rcd-soft); border-radius: .75rem; padding: 1rem 1.2rem; margin-top: 1.3rem; }
.fee-preview > div { display: flex; flex-direction: column; flex-shrink: 0; }
.fee-preview strong { font-size: 1.5rem; color: var(--brand); }
.fee-preview span { font-size: .72rem; color: var(--rcd-body); }
.fee-preview p { font-size: .77rem; color: var(--rcd-body); }
.actions { display: flex; gap: .65rem; flex-wrap: wrap; margin-top: 1.2rem; align-items: center; }
.proposal-preview { padding: 1.4rem; background: var(--rcd-page); border: 1px solid var(--rcd-line); border-radius: .75rem; display: flex; flex-direction: column; gap: .65rem; }
.proposal-preview > div { display: flex; justify-content: space-between; align-items: center; color: var(--rcd-body); }
.document-label { font-size: .72rem; text-transform: uppercase; letter-spacing: .07em; font-weight: 650; }
.proposal-preview p { font-size: .84rem; color: var(--muted); }
.proposal-fee { font-size: 1.9rem; letter-spacing: -.025em; color: var(--brand); }
.detail-list { margin: 1rem 0; font-size: .82rem; }
.detail-list > div { display: flex; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--rcd-line); padding: .65rem 0; }
.detail-list dt { color: var(--rcd-muted); }
.detail-list dd { margin: 0; text-align: right; font-weight: 600; overflow-wrap: anywhere; }
.footnote { color: var(--muted); border-top: 1px solid var(--line); margin-top: 1.1rem !important; padding-top: .85rem; }
.empty-state { display: flex; flex-direction: column; align-items: flex-start; gap: .75rem; padding: 1.3rem 0; }
.empty-state > i { font-size: 2rem; color: var(--rcd-muted); background: var(--rcd-page); padding: 1rem; border-radius: .9rem; }
.empty-state p { font-size: .85rem; color: var(--muted); }
.notice { background: var(--rcd-page); color: var(--rcd-body); padding: .9rem 1rem; border-left: 3px solid var(--rcd-sky); border-radius: .4rem; font-size: .8rem; margin: .8rem 0 !important; }
.support-card { background: var(--rcd-page); }
.card-heading-icon { color: var(--rcd-muted); font-size: 1.6rem; }
.guide-next { font-size: 1.05rem; font-weight: 550; margin-bottom: 1.35rem !important; }
.guide-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 1.35rem; }
.guide-list li { display: flex; gap: .85rem; }
.guide-list i { color: var(--rcd-body); padding-top: .2rem; }
.guide-list div { display: flex; flex-direction: column; gap: .2rem; }
.guide-list strong { font-size: .85rem; }
.guide-list span { font-size: .78rem; color: var(--muted); }
.withdraw-block { border-top: 1px solid var(--line); padding-top: 1.2rem; margin-top: 1.5rem; }
.withdraw-block p { font-size: .78rem; color: var(--muted); margin-bottom: .8rem !important; }
.document-layout { display: grid; grid-template-columns: 1.15fr 1fr; gap: 2rem; margin-top: 1.2rem; align-items: start; }
.requirement-list > h3 { margin-bottom: .5rem; }
.identity-known { display: flex; gap: .5rem; color: var(--rcd-body); font-size: .8rem; padding: .7rem 0; }
.requirement-row { display: flex; gap: .9rem; padding: 1rem 0; border-bottom: 1px solid var(--line); }
.requirement-icon { background: var(--rcd-soft); color: var(--rcd-body); width: 2.4rem; height: 2.4rem; border-radius: .65rem; display: grid; place-items: center; flex-shrink: 0; }
.requirement-row h4 { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem; }
.requirement-badge { color: var(--rcd-muted); font-size: .62rem; font-weight: 500; border: 1px solid var(--rcd-line); padding: .1rem .4rem; border-radius: .3rem; }
.requirement-row p { font-size: .75rem; color: var(--muted); margin: .35rem 0 .55rem; }
.missing-box { background: #fff9ee; border: 1px solid #f0e2c4; border-radius: .65rem; padding: 1rem; margin-top: 1rem; font-size: .79rem; color: #765321; }
.missing-box ul { padding-left: 1.1rem; margin: .45rem 0; }
.missing-box p { font-size: .73rem; }
.upload-panel { border: 1px dashed var(--rcd-sky); background: var(--rcd-page); border-radius: .9rem; padding: 1.4rem; display: flex; flex-direction: column; gap: 1rem; }
.upload-symbol { display: grid; place-items: center; background: var(--rcd-soft); color: var(--rcd-body); width: 3rem; height: 3rem; border-radius: .8rem; }
.upload-symbol i { font-size: 1.5rem; }
.upload-panel > p { color: var(--muted); font-size: .8rem; }
.native-file { width: 100%; min-width: 0; border: 1px solid var(--rcd-line); padding: .6rem; border-radius: .5rem; background: white; font-size: .78rem; color: var(--rcd-ink); }
.native-file::file-selector-button { background: var(--rcd-soft); color: var(--rcd-ink); border: none; border-radius: .3rem; padding: .45rem .65rem; margin-right: .55rem; cursor: pointer; }
.native-file:focus-visible, .version-history summary:focus-visible { outline: 2px solid var(--rcd-blue); outline-offset: 3px; }
.file-summary { display: flex; align-items: flex-start; gap: .65rem; border: 1px solid var(--rcd-line); background: white; padding: .85rem; border-radius: .6rem; font-size: .8rem; color: var(--rcd-ink); }
.file-summary > i { margin-top: .2rem; }
.file-summary > div { display: flex; flex-direction: column; gap: .15rem; min-width: 0; }
.file-summary strong, .file-summary span { overflow-wrap: anywhere; }
.file-summary span { color: var(--rcd-muted); font-size: .74rem; }
.document-history { margin-top: 1.8rem; }
.subsection-heading { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: .8rem; }
.empty-files { text-align: center; padding: 1.8rem; background: var(--rcd-page); border-radius: .65rem; color: var(--muted); font-size: .85rem; }
.empty-files i { font-size: 1.6rem; margin-bottom: .65rem; }
.document-group { border: 1px solid var(--line); border-radius: .65rem; padding: 1rem; margin-bottom: .7rem; }
.document-current { display: flex; align-items: center; gap: 1rem; }
.document-file-icon { color: var(--rcd-muted); font-size: 1.35rem; }
.document-name { flex: 1; min-width: 0; }
.document-name p { font-size: .82rem; color: var(--muted); overflow-wrap: anywhere; }
.document-note { font-size: .8rem; margin: .65rem 0 0 2.35rem !important; overflow-wrap: anywhere; }
.version-history { margin: .75rem 0 0 2.35rem; font-size: .76rem; color: var(--muted); }
.version-history summary { cursor: pointer; color: var(--rcd-body); padding: .3rem 0; }
.draft-history { margin-left: 0; }
.version-history ul { list-style: none; padding: 0; margin: .5rem 0 0; }
.version-history li { display: flex; justify-content: space-between; align-items: center; gap: 1rem; border-top: 1px solid var(--line); padding: .65rem 0; }
.version-history li div { display: flex; flex-direction: column; overflow-wrap: anywhere; min-width: 0; }
.delivery-panel { background: var(--rcd-soft); display: flex; justify-content: space-between; align-items: center; gap: 1.5rem; border-radius: .8rem; padding: 1.2rem; margin-top: 1.25rem; }
.delivery-panel p { color: var(--rcd-body); font-size: .79rem; margin-top: .3rem; max-width: 38rem; }
.delivery-panel :deep(.p-button) { flex-shrink: 0; max-width: 17rem; }
.draft-preview { padding: 1.25rem; border-radius: .8rem; background: var(--rcd-soft); display: flex; flex-direction: column; gap: .55rem; }
.draft-preview .document-label { color: var(--rcd-body); }
.draft-preview p { font-size: .8rem; color: var(--rcd-body); }
.draft-preview strong { font-size: 1.75rem; color: var(--rcd-ink); font-weight: 600; }
.draft-preview > span:last-child { color: var(--rcd-body); }
.presentation-panel { margin-top: 1.3rem; border-top: 1px solid var(--line); padding-top: 1rem; }
.presentation-panel p { font-size: .83rem; color: var(--muted); margin: .65rem 0 1rem; }
.final-document { display: flex; gap: .9rem; padding: 1rem 0; border-bottom: 1px solid var(--line); }
.section-icon { display: grid; place-items: center; width: 2.6rem; height: 2.6rem; border-radius: .75rem; flex-shrink: 0; background: var(--rcd-soft); color: var(--rcd-body); }
.final-document > div { min-width: 0; }
.final-document p { font-size: .82rem; color: var(--muted); margin-top: .45rem; }
.reference { overflow-wrap: anywhere; font-weight: 600; color: var(--brand) !important; }
.final-document :deep(.p-button) { margin-top: .55rem; }
.thank-you { display: flex; gap: 1rem; margin-top: 1.25rem; }
.thank-you p { margin-top: .6rem; font-size: .88rem; }
.portal-footer { margin-top: 1.5rem; display: flex; justify-content: space-between; gap: 1rem; color: var(--muted); font-size: .7rem; }
.confirmation-content { display: flex; flex-direction: column; gap: 1rem; line-height: 1.6; color: var(--rcd-ink); }
.confirmation-content .consent-row { margin-top: 0; }
.confirmation-content :deep(.p-message) { font-size: .88rem; }
.confirmation-content .notice { margin: 0 !important; }
@media (max-width: 1050px) {
  .progress-steps { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.1rem; }
  .portal-grid { grid-template-columns: 1fr 1fr; }
  .document-layout { gap: 1.25rem; }
  .document-current { flex-wrap: wrap; }
  .document-name { flex-basis: 50%; }
}
@media (max-width: 760px) {
  .client-portal { border-radius: .8rem; padding: 1rem; }
  .portal-hero { grid-template-columns: 1fr; gap: 1.6rem; }
  .hero-next { padding: 1.3rem 0 0; border-left: none; border-top: 1px solid #ffffff26; }
  .portal-grid, .document-layout { grid-template-columns: 1fr; }
  .section-heading { flex-wrap: wrap; }
  .progress-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .delivery-panel { flex-direction: column; align-items: flex-start; gap: 1rem; }
  .delivery-panel :deep(.p-button) { max-width: none; width: 100%; }
  .portal-footer { flex-direction: column; gap: .4rem; }
  .fee-preview { flex-direction: column; align-items: flex-start; gap: .65rem; }
  .simulation-banner { flex-wrap: wrap; }
  .simulation-banner > span { flex-basis: calc(100% - 2rem); }
}
@media (max-width: 440px) {
  .form-grid { grid-template-columns: 1fr; }
  .progress-steps { grid-template-columns: 1fr; gap: .85rem; }
  .actions { flex-direction: column; align-items: stretch; }
  .actions :deep(.p-button) { width: 100%; justify-content: center; }
  .document-current { gap: .65rem; }
  .document-file-icon { display: none; }
  .document-name { flex-basis: 100%; }
  .document-note, .version-history { margin-left: 0 !important; }
  .version-history li { align-items: flex-start; flex-direction: column; gap: .3rem; }
  .subsection-heading { flex-direction: column; align-items: flex-start; gap: .3rem; }
  .hero-meta { flex-direction: column; }
}
@media (prefers-reduced-motion: reduce) {
  .client-portal :deep(*) { transition: none !important; animation: none !important; scroll-behavior: auto !important; }
}
</style>
