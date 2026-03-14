/**
 * QueryClient retry logic: do not retry on 4xx (client errors), retry once for others.
 * Used in main.tsx. Extracted for unit testing.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status
  if (typeof status === 'number' && status >= 400 && status < 500) return false
  return failureCount < 1
}
