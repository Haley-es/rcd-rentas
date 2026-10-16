// Mantiene las webs estáticas autocontenidas a partir de la identidad común.
import { cp } from 'node:fs/promises'

for (const target of ['../landing/brand/', '../presentacion/brand/']) {
  await cp(new URL('../public/brand/', import.meta.url), new URL(target, import.meta.url), { recursive: true })
}
