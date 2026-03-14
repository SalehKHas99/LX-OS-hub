/**
 * Auth token storage helpers. Extracted for reuse and testing.
 */
export const TOKEN_KEYS = { access: 'access_token', refresh: 'refresh_token' } as const

/**
 * Returns localStorage when remember is true, sessionStorage otherwise.
 */
export function getStorage(remember: boolean): Storage {
  return remember ? localStorage : sessionStorage
}

/**
 * True if there is an access token in either storage (user may be logged in).
 */
export function hasStoredToken(): boolean {
  return !!(localStorage.getItem(TOKEN_KEYS.access) ?? sessionStorage.getItem(TOKEN_KEYS.access))
}
