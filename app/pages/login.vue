<script setup lang="ts">
import { prototypeReturnTo } from '../../shared/utils/prototype-return-to'
definePageMeta({ layout: 'access' })
const route = useRoute()
const { login, pending, error } = usePrototypeAuth()
const username = ref('')
const password = ref('')
async function submit() {
  const accepted = await login(username.value, password.value)
  password.value = ''
  if (accepted) await navigateTo({ path: '/mfa', query: { returnTo: prototypeReturnTo(route.query.returnTo) } })
}
</script>

<template>
  <h1>Iniciar sesión</h1>
  <p>Primer paso simulado. Usuario y contraseña: cualquier valor no vacío es válido.</p>
  <form class="access-form" novalidate @submit.prevent="submit">
    <label for="username">Usuario</label>
    <InputText id="username" v-model="username" autocomplete="off" />
    <label for="password">Contraseña</label>
    <InputText id="password" v-model="password" type="password" autocomplete="off" />
    <Message v-if="error" severity="error" role="alert" :closable="false">{{ error }}</Message>
    <Button type="submit" label="Continuar a MFA" :loading="pending" :disabled="pending" />
  </form>
</template>

<style scoped>
.access-form { display: grid; gap: 12px; }
.access-form :deep(input) { width: 100%; min-width: 0; }
</style>
