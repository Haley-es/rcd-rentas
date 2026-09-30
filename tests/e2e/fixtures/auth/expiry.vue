<script setup lang="ts">
const { cases } = useMockApp()
const { request } = usePrototypeAuth()
const result = ref('')
async function query(slow: boolean) {
  try {
    await request<{ finished?: boolean }>('/api/prototype/' + (slow ? 'slow' : 'state'))
    result.value = 'Consulta confirmada'
  } catch {
    result.value = 'Consulta cancelada o rechazada; error de acceso visible en login.'
  }
}
</script>

<template>
  <h1>Comprobar sesión de prueba</h1>
  <p>{{ cases[0]?.name }}</p>
  <Button label="Iniciar consulta pendiente" @click="query(true)" />
  <Button label="Consultar API protegida" @click="query(false)" />
  <p>{{ result }}</p>
</template>
