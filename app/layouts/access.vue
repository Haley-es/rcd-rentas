<template>
  <main class="access-layout">
    <section class="access-card" aria-label="Acceso al prototipo local">
      <img class="rcd-logo" src="/brand/rcd-logo.png" alt="RCD" width="190" height="190" />
      <p class="eyebrow">RCD · PROTOTIPO LOCAL</p>
      <p class="access-warning">No producción. La identidad de los empleados es simulada. Administrador IT requiere su credencial local. No introduzcas contraseñas ni códigos corporativos.</p>
      <p>MFA simulado: cualquier valor no vacío es válido en localhost, 127.0.0.1 o ::1. Fuera del entorno local está deshabilitado.</p>
      <slot />
    </section>
  </main>
</template>

<style scoped>
.access-layout { min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; }
.access-card { width: 100%; max-width: 460px; min-width: 0; padding: 28px; background: #fff; border: 1px solid var(--line); border-radius: 12px; overflow-wrap: anywhere; }
.access-warning { padding: 14px; background: #fff7e7; border-radius: 8px; line-height: 1.5; }
.access-card > .rcd-logo { margin-bottom: 16px; }
</style>
