import type { AxiosAdapter, AxiosResponse } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './client'

describe('apiClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should refresh once (with no request body — the cookie carries it) and retry the original request when a call 401s', async () => {
    const calls: string[] = []
    let refreshed = false

    const adapter: AxiosAdapter = async (config) => {
      const url = config.url ?? ''
      calls.push(url)

      const respond = (status: number, data: unknown): AxiosResponse => ({
        data,
        status,
        statusText: String(status),
        headers: {},
        config,
      })

      if (url.includes('/auth/refresh')) {
        // Cookie-based now — nothing to send in the body.
        expect(config.data).toBeUndefined()
        refreshed = true
        return respond(200, { accessToken: 'fresh-token', refreshToken: 'fresh-refresh-token' })
      }

      if (url.includes('/protected')) {
        if (refreshed) {
          return respond(200, { ok: true })
        }
        const error = Object.assign(new Error('Unauthorized'), {
          isAxiosError: true,
          config,
          response: respond(401, { errorCode: 'INVALID_CREDENTIALS' }),
        })
        throw error
      }

      throw new Error(`unexpected url in test adapter: ${url}`)
    }

    apiClient.defaults.adapter = adapter

    const response = await apiClient.get('/protected')

    expect(response.data).toEqual({ ok: true })
    // Exactly: the initial 401'd call, one refresh call, one retried call — no loop.
    expect(calls).toEqual(['/protected', '/auth/refresh', '/protected'])
  })

  it('should not loop when refresh itself fails', async () => {
    let protectedCallCount = 0

    const adapter: AxiosAdapter = async (config) => {
      const url = config.url ?? ''

      if (url.includes('/auth/refresh')) {
        const error = Object.assign(new Error('refresh failed'), {
          isAxiosError: true,
          config,
          response: {
            data: { errorCode: 'INVALID_CREDENTIALS' },
            status: 401,
            statusText: '401',
            headers: {},
            config,
          },
        })
        throw error
      }

      protectedCallCount += 1
      const error = Object.assign(new Error('Unauthorized'), {
        isAxiosError: true,
        config,
        response: {
          data: { errorCode: 'INVALID_CREDENTIALS' },
          status: 401,
          statusText: '401',
          headers: {},
          config,
        },
      })
      throw error
    }

    apiClient.defaults.adapter = adapter

    await expect(apiClient.get('/protected')).rejects.toBeTruthy()
    // Only the original attempt — refresh failing must not trigger endless retries.
    expect(protectedCallCount).toBe(1)
  })
})
