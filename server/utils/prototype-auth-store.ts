export const PROTOTYPE_CHALLENGE_TTL_MS = 5 * 60 * 1000
export const PROTOTYPE_SESSION_TTL_MS = 8 * 60 * 60 * 1000

export interface PrototypeAuthRecord {
  username: string
  sessionId: string
  expiresAt: number
}

interface Challenge {
  username: string
  expiresAt: number
}

export function createPrototypeAuthStore(options: {
  now?: () => number
  challengeTtlMs?: number
  sessionTtlMs?: number
} = {}) {
  const now = options.now ?? Date.now
  const challengeTtlMs = options.challengeTtlMs ?? PROTOTYPE_CHALLENGE_TTL_MS
  const sessionTtlMs = options.sessionTtlMs ?? PROTOTYPE_SESSION_TTL_MS
  const challenges = new Map<string, Challenge>()
  const sessions = new Map<string, PrototypeAuthRecord>()
  const identifier = () => [...crypto.getRandomValues(new Uint8Array(32))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('')

  function prune() {
    const time = now()
    for (const [id, record] of challenges) if (record.expiresAt <= time) challenges.delete(id)
    for (const [id, record] of sessions) if (record.expiresAt <= time) sessions.delete(id)
  }
  function challenge(id: string | undefined) {
    prune()
    return id ? challenges.get(id) : undefined
  }
  function session(id: string | undefined) {
    prune()
    return id ? sessions.get(id) : undefined
  }
  function revoke(sessionId: string | undefined, challengeId: string | undefined) {
    if (sessionId) sessions.delete(sessionId)
    if (challengeId) challenges.delete(challengeId)
  }
  function begin(username: string) {
    prune()
    const id = identifier()
    const record = { username, expiresAt: now() + challengeTtlMs }
    challenges.set(id, record)
    return { id, ...record }
  }
  function consume(id: string | undefined) {
    const pending = challenge(id)
    if (!pending || !id) return undefined
    challenges.delete(id)
    const record = {
      username: pending.username,
      sessionId: identifier(),
      expiresAt: now() + sessionTtlMs,
    }
    sessions.set(record.sessionId, record)
    return record
  }
  return { challenge, session, revoke, begin, consume }
}
