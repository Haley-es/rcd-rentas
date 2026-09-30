<script setup lang="ts">
const props = defineProps<{ caseId: string }>()
const { files, downloadFile, generateDemoArtifacts, pending } = useMockApp()
const entries = computed(() => files.value.filter(file => file.caseId === props.caseId))
const feedback = ref<import('../types/domain').ActionResult | null>(null)
async function generate() { feedback.value = await generateDemoArtifacts(props.caseId) }
async function download(file: import('../../shared/types/prototype-files').PrototypeFileDescriptor) { feedback.value = await downloadFile(file) }
</script>

<template>
  <section class="panel" aria-label="Archivos locales y versiones">
    <h2>Archivos locales y versiones</h2>
    <p>Subidos: bytes reales privados. Precargados: solo metadatos. Artefactos: TXT/CSV ficticios, sin integraciones.</p>
    <Button label="Preparar muestras TXT/CSV actuales" severity="secondary" :disabled="pending" @click="generate" />
    <Message v-if="feedback" :severity="feedback.ok ? 'success' : 'error'" role="status">{{ feedback.message }}</Message>
    <ul>
      <li v-for="file in entries" :key="file.fileId ?? file.documentId ?? file.anchor">
        <strong>{{ file.originalName }}</strong>
        <span> · {{ file.category }} · {{ file.documentVersion ? `v${file.documentVersion}` : file.anchor }} · {{ file.size }} bytes</span>
        <p v-if="file.source === 'metadata-only'">Muestra precargada: solo metadatos. Original no disponible; histórico sin archivo disponible.</p>
        <p v-else-if="file.source === 'generated-demo'">TXT/CSV ficticio, no PDF, no XLSX ni importable en Criteria.</p>
        <Message v-if="file.availabilityError" severity="error" role="alert">FILE_UNAVAILABLE: archivo conocido no disponible. Revisa disco y backup; no existe una muestra sustitutiva.</Message>
        <Button :label="file.source === 'uploaded' ? 'Descargar original' : 'Descargar TXT/CSV ficticio'" :disabled="!file.fileId || pending" severity="secondary"
          :aria-label="`Descargar ${file.originalName}`" @click="download(file)" />
      </li>
    </ul>
  </section>
</template>

<style scoped>
li { margin: 12px 0; overflow-wrap: anywhere; }
</style>
