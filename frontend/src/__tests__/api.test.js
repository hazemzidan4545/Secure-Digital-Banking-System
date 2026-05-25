const mockRequest = jest.fn()
let capturedInterceptor = null

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    request: mockRequest,
    interceptors: {
      request: {
        use: jest.fn((cb) => {
          capturedInterceptor = cb
        }),
      },
    },
  })),
}))

describe('api helpers', () => {
  beforeEach(() => {
    jest.resetModules()
    mockRequest.mockReset()
    capturedInterceptor = null
    document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  })

  test('getCookie returns cookie value when present', async () => {
    document.cookie = 'csrf_token=test-token'
    const { getCookie } = await import('../api.js')

    expect(getCookie('csrf_token')).toBe('test-token')
    expect(getCookie('missing_cookie')).toBeNull()
  })

  test('request interceptor attaches x-csrf-token for POST requests', async () => {
    document.cookie = 'csrf_token=secure-csrf-token'
    await import('../api.js')

    const request = { method: 'post', headers: {} }
    const result = capturedInterceptor(request)

    expect(result.headers['x-csrf-token']).toBe('secure-csrf-token')
  })

  test('apiFetch returns parsed data and maps backend errors', async () => {
    mockRequest.mockResolvedValueOnce({ data: { ok: true } })
    const { apiFetch } = await import('../api.js')

    const result = await apiFetch('/api/health')
    expect(result).toEqual({ ok: true })

    mockRequest.mockRejectedValueOnce({
      response: {
        data: {
          error: 'Authentication required.',
        },
      },
    })

    await expect(apiFetch('/api/accounts/me')).rejects.toThrow('Authentication required.')
  })
})
