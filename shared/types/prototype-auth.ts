export type PrototypeSession =
  | { authenticated: false; pendingMfa: boolean }
  | { authenticated: true; user: { username: string }; expiresAt: string }

export type PrototypeAuthErrorCode =
  | 'AUTH_INPUT_INVALID'
  | 'MFA_CHALLENGE_INVALID'
  | 'AUTH_REQUIRED'
  | 'ORIGIN_FORBIDDEN'

export interface PrototypeAuthError {
  code: PrototypeAuthErrorCode
  message: string
}
