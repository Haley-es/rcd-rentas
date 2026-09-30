import { createSeed } from '../data/seed'
import type { CaseFile, Role, WorkflowAction } from '../types/domain'
import { runAction } from '../utils/workflow'

export function useMockApp() {
  const cases = useState<CaseFile[]>('cases', createSeed)
  const role = useState<Role>('role', () => 'Profesional')
  const today = useState<string>('demo-date', () => '2026-06-12')
  const teams = useState<boolean>('teams-demo', () => true)
  const signatureEmail = useState<boolean>('signature-email', () => false)
  const documentReminderDays = useState<number>('doc-reminder-days', () => 3)
  function act(id: string, action: WorkflowAction, actor = role.value) {
    const item = cases.value.find(entry => entry.id === id)
    if (!item) return { ok: false, message: 'Expediente no encontrado.' }
    return runAction(item, action, actor, today.value)
  }
  function advanceDays(days: number) {
    const date = new Date(`${today.value}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + days)
    today.value = date.toISOString().slice(0, 10)
  }
  function reset() {
    cases.value = createSeed()
    today.value = '2026-06-12'
    role.value = 'Profesional'
    teams.value = true; signatureEmail.value = false; documentReminderDays.value = 3
  }
  return { cases, role, today, teams, signatureEmail, documentReminderDays, act, advanceDays, reset }
}
