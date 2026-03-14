import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getStorage, hasStoredToken, TOKEN_KEYS } from './authStorage'

describe('authStorage', () => {
  const mockStorage = (): Storage =>
    ({
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    }) as unknown as Storage

  let local: Storage
  let session: Storage

  beforeEach(() => {
    local = mockStorage()
    session = mockStorage()
    vi.stubGlobal('localStorage', local)
    vi.stubGlobal('sessionStorage', session)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('TOKEN_KEYS', () => {
    it('has access and refresh keys', () => {
      expect(TOKEN_KEYS.access).toBe('access_token')
      expect(TOKEN_KEYS.refresh).toBe('refresh_token')
    })
  })

  describe('getStorage', () => {
    it('returns localStorage when remember is true', () => {
      expect(getStorage(true)).toBe(localStorage)
    })

    it('returns sessionStorage when remember is false', () => {
      expect(getStorage(false)).toBe(sessionStorage)
    })
  })

  describe('hasStoredToken', () => {
    it('returns false when neither storage has access_token', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null)
      vi.mocked(sessionStorage.getItem).mockReturnValue(null)
      expect(hasStoredToken()).toBe(false)
    })

    it('returns true when localStorage has access_token', () => {
      vi.mocked(localStorage.getItem).mockImplementation((k: string) =>
        k === TOKEN_KEYS.access ? 'tok' : null
      )
      vi.mocked(sessionStorage.getItem).mockReturnValue(null)
      expect(hasStoredToken()).toBe(true)
    })

    it('returns true when sessionStorage has access_token', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null)
      vi.mocked(sessionStorage.getItem).mockImplementation((k: string) =>
        k === TOKEN_KEYS.access ? 'tok' : null
      )
      expect(hasStoredToken()).toBe(true)
    })
  })
})
