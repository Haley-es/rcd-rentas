import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { deployPrototypeTestDatabase, prototypeTestDatabaseURL } from './prototype-e2e.mjs'

await deployPrototypeTestDatabase()
const child = spawn(process.execPath, [
  resolve('node_modules', 'nuxt', 'bin', 'nuxt.mjs'), 'dev',
  resolve('tests', 'e2e', 'fixtures', 'persistence'), '--host', '127.0.0.1', '--port', '3011', '--no-fork',
], { env: { ...process.env, DATABASE_URL: prototypeTestDatabaseURL(), PROTOTYPE_UPLOAD_DIR: resolve('node_modules', '.cache', 'prototype-files-e2e') }, stdio: 'inherit' })
child.on('error', cause => { console.error(cause.name); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
