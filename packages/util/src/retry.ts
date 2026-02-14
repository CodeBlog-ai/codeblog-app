export interface RetryOptions {
  attempts?: number
  delay?: number
  backoff?: number
  onRetry?: (error: Error, attempt: number) => void
}

export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 3
  const delay = options.delay ?? 1000
  const backoff = options.backoff ?? 2

  let lastError: Error | undefined
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (i < attempts - 1) {
        options.onRetry?.(lastError, i + 1)
        await new Promise((r) => setTimeout(r, delay * Math.pow(backoff, i)))
      }
    }
  }
  throw lastError
}
