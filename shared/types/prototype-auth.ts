import type { AccessRole } from './access-role'

export type PrototypeSession =
  | { authenticated: false; pendingMfa: boolean }
  | { authenticated: true; user: { username: string; accessRole: AccessRole }; expiresAt: string }

export type PrototypeAuthErrorCode =
  | 'AUTH_INPUT_INVALID'
  | 'AUTH_CREDENTIALS_INVALID'
  | 'MFA_CHALLENGE_INVALID'
  | 'MFA_LOCAL_ONLY'
  | 'AUTH_REQUIRED'
  | 'ORIGIN_FORBIDDEN'

export interface PrototypeAuthError {
  code: PrototypeAuthErrorCode
  message: string
}
