import { spawn, type ChildProcess } from 'node:child_process'
import { resolve } from 'node:path'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { test as base, expect } from '@playwright/test'
import { deployPrototypeTestDatabase, prototypeTestDatabaseURL } from '../../../scripts/prototype-e2e.mjs'

export interface PrototypeTestServer {
  pid: number
  restart(failedDatabase?: boolean): Promise<void>
}
export const prototypeOrigin = 'http://127.0.0.1:3011'
export const prototypeUploadRoot = resolve('node_modules', '.cache', 'prototype-files-e2e')

export async function startPrototypeTestServer(): Promise<PrototypeTestServer & { stop(): Promise<void> }> {
  await deployPrototypeTestDatabase()
  let child: ChildProcess | undefined
  let logs = ''
  async function stop() {
    const previous = child
    if (!previous) return
    child = undefined
    if (previous.exitCode === null && previous.pid) {
      const closed = new Promise<void>(resolve => previous.once('exit', () => resolve()))
      if (process.platform === 'win32') {
        const killer = spawn('powershell', ['-NoProfile', '-Command', `Stop-Process -Id ${previous.pid} -ErrorAction Stop`], { stdio: 'ignore' })
        await new Promise<void>((resolve, reject) => {
          killer.once('error', reject)
          killer.once('exit', code => code === 0 ? resolve() : reject(new Error('Owned server stop failed.')))
        })
      } else previous.kill('SIGTERM')
      await closed
    }
    const lock = resolve('node_modules', '.cache', 'prototype-persistence-e2e', 'nuxt.lock')
    if (existsSync(lock) && JSON.parse(readFileSync(lock, 'utf8')).pid === previous.pid) unlinkSync(lock)
  }
  async function start(failedDatabase = false) {
    logs = ''
    const database = failedDatabase ?
      'sqlserver://127.0.0.1:1;database=RCDRentaE2E;user=invalid;password=invalid;connectTimeout=2' :
      prototypeTestDatabaseURL()
    child = spawn(process.execPath, [
      resolve('node_modules', 'nuxt', 'bin', 'nuxt.mjs'), 'dev',
      resolve('tests', 'e2e', 'fixtures', 'persistence'),
      '--host', '127.0.0.1', '--port', '3011', '--no-fork',
    ], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: database, PROTOTYPE_UPLOAD_DIR: prototypeUploadRoot }, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout?.on('data', chunk => { logs = `${logs}${chunk}`.slice(-4000) })
    child.stderr?.on('data', chunk => { logs = `${logs}${chunk}`.slice(-4000) })
    const deadline = Date.now() + 120_000
    while (Date.now() < deadline && child.exitCode === null) {
      try {
        if ((await fetch(`${prototypeOrigin}/api/auth/session`)).ok) {
          console.log(`PRD09 server PID ${child.pid}, HTTP responsive`)
          return
        }
      } catch (cause) {
        if (!(cause instanceof TypeError)) throw cause
      }
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    await stop()
    throw new Error(`Isolated Nuxt startup failed: ${logs}`)
  }
  await start()
  return {
    get pid() { return child?.pid ?? 0 },
    async restart(failedDatabase) { await stop(); await start(failedDatabase) },
    stop,
  }
}
export const test = base.extend<object, { prototypeServer: PrototypeTestServer }>({
  prototypeServer: [async ({}, use) => {
    const server = await startPrototypeTestServer()
    try { await use(server) }
    finally { await server.stop() }
  }, { scope: 'worker', auto: true }],
})
export { expect }
