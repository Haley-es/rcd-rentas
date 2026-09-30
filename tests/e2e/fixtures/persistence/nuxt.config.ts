import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
export default defineNuxtConfig({
  extends: [root], rootDir: root,
  srcDir: fileURLToPath(new URL('../../../../app/', import.meta.url)),
  serverDir: fileURLToPath(new URL('../../../../server/', import.meta.url)),
  buildDir: fileURLToPath(new URL('../../../../node_modules/.cache/prototype-persistence-e2e/', import.meta.url)),
})
