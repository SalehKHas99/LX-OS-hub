import { describe, it, expect } from 'vitest'
import { shouldRetryQuery } from './queryRetry'

describe('shouldRetryQuery', () => {
  it('returns false for 4xx client errors', () => {
    expect(shouldRetryQuery(0, { response: { status: 400 } })).toBe(false)
    expect(shouldRetryQuery(0, { response: { status: 401 } })).toBe(false)
    expect(shouldRetryQuery(0, { response: { status: 404 } })).toBe(false)
    expect(shouldRetryQuery(1, { response: { status: 403 } })).toBe(false)
  })

  it('returns false when failureCount >= 1 for non-4xx', () => {
    expect(shouldRetryQuery(1, { response: { status: 500 } })).toBe(false)
    expect(shouldRetryQuery(1, {})).toBe(false)
  })

  it('returns true for first failure when error is 5xx or network (no status)', () => {
    expect(shouldRetryQuery(0, { response: { status: 500 } })).toBe(true)
    expect(shouldRetryQuery(0, { response: { status: 502 } })).toBe(true)
    expect(shouldRetryQuery(0, {})).toBe(true)
    expect(shouldRetryQuery(0, null)).toBe(true)
  })

  it('handles undefined or missing response safely', () => {
    expect(shouldRetryQuery(0, undefined)).toBe(true)
    expect(shouldRetryQuery(0, {})).toBe(true)
  })
})
