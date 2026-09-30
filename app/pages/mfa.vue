<script setup lang="ts">
import { prototypeReturnTo } from '../../shared/utils/prototype-return-to'
definePageMeta({ layout: 'access' })
const route = useRoute()
const { verifyMfa, pending, error } = usePrototypeAuth()
const code = ref('')
async function submit() {
  const accepted = await verifyMfa(code.value)
  code.value = ''
  if (accepted) await navigateTo(prototypeReturnTo(route.query.returnTo))
}
</script>

<template>
  <h1>Confirmar MFA simulado</h1>
  <p>Desafío válido durante 5 minutos. No se comprueba ningún OTP.</p>
  <form class="access-form" novalidate @submit.prevent="submit">
    <label for="mfa-code">Código MFA simulado</label>
    <InputText id="mfa-code" v-model="code" autocomplete="off" />
    <Message v-if="error" severity="error" role="alert" :closable="false">{{ error }}</Message>
    <Button type="submit" label="Confirmar acceso simulado" :loading="pending" :disabled="pending" />
    <NuxtLink to="/login">Volver a iniciar sesión</NuxtLink>
  </form>
</template>

<style scoped>
.access-form { display: grid; gap: 12px; }
.access-form :deep(input) { width: 100%; min-width: 0; }
</style>
