/**
 * 基于 fetch 的轻量 HTTP 客户端。
 * 支持 JSON / FormData / 文本 / Blob 等，并对请求参数与响应做泛型约束。
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'

/** 响应解析方式；默认 json。stream 返回原始 Response（不消费 body） */
export type HttpResponseType = 'json' | 'text' | 'blob' | 'arrayBuffer' | 'void' | 'stream'

export type HttpQuery = Record<string, string | number | boolean | null | undefined>

export type HttpBody =
  | BodyInit
  | Record<string, unknown>
  | unknown[]
  | null
  | undefined

export class HttpError extends Error {
  readonly status: number
  readonly data: unknown
  readonly response: Response

  constructor(message: string, status: number, data: unknown, response: Response) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.data = data
    this.response = response
  }
}

export type HttpRequestConfig<TData = unknown, TQuery extends HttpQuery = HttpQuery> = {
  method?: HttpMethod
  /** URL 查询参数 */
  params?: TQuery
  /** 请求体：对象默认 JSON；FormData / Blob / string 等原样发送 */
  data?: TData
  headers?: HeadersInit
  responseType?: HttpResponseType
  signal?: AbortSignal
  /** 超时毫秒；超时会 abort */
  timeout?: number
  baseURL?: string
  /** 透传给 fetch 的其余选项（不含 method/body/headers/signal） */
  credentials?: RequestCredentials
  cache?: RequestCache
  mode?: RequestMode
  redirect?: RequestRedirect
  referrer?: string
  integrity?: string
  keepalive?: boolean
}

export type HttpInstanceConfig = {
  baseURL?: string
  headers?: HeadersInit
  timeout?: number
  credentials?: RequestCredentials
}

function joinURL(base: string | undefined, path: string): string {
  if (!base) return path
  if (/^https?:\/\//i.test(path)) return path
  const b = base.replace(/\/+$/, '')
  const p = path.replace(/^\/+/, '')
  return `${b}/${p}`
}

function appendQuery(url: string, params?: HttpQuery): string {
  if (!params) return url
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    qs.set(key, String(value))
  }
  const s = qs.toString()
  if (!s) return url
  return url.includes('?') ? `${url}&${s}` : `${url}?${s}`
}

function isPlainBodyObject(data: unknown): data is Record<string, unknown> | unknown[] {
  if (data === null || data === undefined) return false
  if (typeof data !== 'object') return false
  if (typeof FormData !== 'undefined' && data instanceof FormData) return false
  if (typeof Blob !== 'undefined' && data instanceof Blob) return false
  if (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) return false
  if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) return false
  if (typeof ReadableStream !== 'undefined' && data instanceof ReadableStream) return false
  if (ArrayBuffer.isView(data)) return false
  return true
}

function buildBodyAndHeaders(
  data: unknown,
  headersInit?: HeadersInit,
): { body?: BodyInit; headers: Headers } {
  const headers = new Headers(headersInit)

  if (data === undefined || data === null) {
    return { headers }
  }

  if (typeof data === 'string') {
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'text/plain;charset=UTF-8')
    return { body: data, headers }
  }

  if (isPlainBodyObject(data)) {
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    return { body: JSON.stringify(data), headers }
  }

  // FormData 等：交给浏览器设置 multipart boundary，勿强设 Content-Type
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    headers.delete('Content-Type')
  }

  return { body: data as BodyInit, headers }
}

async function parseResponse<T>(
  res: Response,
  responseType: HttpResponseType,
): Promise<T> {
  if (responseType === 'stream') {
    return res as T
  }

  if (responseType === 'void' || res.status === 204) {
    return undefined as T
  }

  if (responseType === 'text') {
    return (await res.text()) as T
  }
  if (responseType === 'blob') {
    return (await res.blob()) as T
  }
  if (responseType === 'arrayBuffer') {
    return (await res.arrayBuffer()) as T
  }

  // json（含空 body）
  const text = await res.text()
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new HttpError('Invalid JSON response', res.status, text, res)
  }
}

async function readErrorPayload(res: Response): Promise<unknown> {
  const clone = res.clone()
  try {
    return await clone.json()
  } catch {
    try {
      return await res.text()
    } catch {
      return null
    }
  }
}

function mergeSignals(a?: AbortSignal, b?: AbortSignal): AbortSignal | undefined {
  if (!a) return b
  if (!b) return a
  if (typeof AbortSignal !== 'undefined' && 'any' in AbortSignal && typeof AbortSignal.any === 'function') {
    return AbortSignal.any([a, b])
  }
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  if (a.aborted || b.aborted) {
    controller.abort()
    return controller.signal
  }
  a.addEventListener('abort', onAbort)
  b.addEventListener('abort', onAbort)
  return controller.signal
}

export type HttpClient = {
  request: <TResponse = unknown, TData = unknown, TQuery extends HttpQuery = HttpQuery>(
    url: string,
    config?: HttpRequestConfig<TData, TQuery>,
  ) => Promise<TResponse>
  get: <TResponse = unknown, TQuery extends HttpQuery = HttpQuery>(
    url: string,
    config?: Omit<HttpRequestConfig<never, TQuery>, 'method' | 'data'>,
  ) => Promise<TResponse>
  post: <TResponse = unknown, TData = unknown, TQuery extends HttpQuery = HttpQuery>(
    url: string,
    data?: TData,
    config?: Omit<HttpRequestConfig<TData, TQuery>, 'method' | 'data'>,
  ) => Promise<TResponse>
  put: <TResponse = unknown, TData = unknown, TQuery extends HttpQuery = HttpQuery>(
    url: string,
    data?: TData,
    config?: Omit<HttpRequestConfig<TData, TQuery>, 'method' | 'data'>,
  ) => Promise<TResponse>
  patch: <TResponse = unknown, TData = unknown, TQuery extends HttpQuery = HttpQuery>(
    url: string,
    data?: TData,
    config?: Omit<HttpRequestConfig<TData, TQuery>, 'method' | 'data'>,
  ) => Promise<TResponse>
  delete: <TResponse = unknown, TData = unknown, TQuery extends HttpQuery = HttpQuery>(
    url: string,
    config?: Omit<HttpRequestConfig<TData, TQuery>, 'method'>,
  ) => Promise<TResponse>
}

export function createHttp(defaults: HttpInstanceConfig = {}): HttpClient {
  const request = async <TResponse = unknown, TData = unknown, TQuery extends HttpQuery = HttpQuery>(
    url: string,
    config: HttpRequestConfig<TData, TQuery> = {},
  ): Promise<TResponse> => {
    const method = (config.method ?? 'GET').toUpperCase() as HttpMethod
    const responseType = config.responseType ?? 'json'
    const timeout = config.timeout ?? defaults.timeout

    const mergedHeaders = new Headers(defaults.headers)
    if (config.headers) {
      new Headers(config.headers).forEach((value, key) => {
        mergedHeaders.set(key, value)
      })
    }

    const { body, headers } = buildBodyAndHeaders(
      method === 'GET' || method === 'HEAD' ? undefined : config.data,
      mergedHeaders,
    )

    const fullURL = appendQuery(joinURL(config.baseURL ?? defaults.baseURL, url), config.params)

    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let timeoutController: AbortController | undefined
    if (timeout && timeout > 0) {
      timeoutController = new AbortController()
      timeoutId = setTimeout(() => timeoutController!.abort(), timeout)
    }

    const signal = mergeSignals(config.signal, timeoutController?.signal)

    try {
      const res = await fetch(fullURL, {
        method,
        headers,
        body,
        signal,
        credentials: config.credentials ?? defaults.credentials,
        cache: config.cache,
        mode: config.mode,
        redirect: config.redirect,
        referrer: config.referrer,
        integrity: config.integrity,
        keepalive: config.keepalive,
      })

      if (responseType === 'stream') {
        if (!res.ok) {
          const errData = await readErrorPayload(res)
          let message = `HTTP ${res.status}`
          if (errData && typeof errData === 'object') {
            const payload = errData as { error?: unknown; message?: unknown }
            const raw = payload.error ?? payload.message
            if (typeof raw === 'string' && raw.trim()) message = raw
          } else if (typeof errData === 'string' && errData.trim()) {
            message = errData
          }
          throw new HttpError(message, res.status, errData, res)
        }
        return res as TResponse
      }

      const data = await parseResponse<TResponse>(res, responseType)

      if (!res.ok) {
        const errData = data as { error?: unknown; message?: unknown } | null
        let message = `HTTP ${res.status}`
        if (errData && typeof errData === 'object') {
          const raw = errData.error ?? errData.message
          if (typeof raw === 'string' && raw.trim()) message = raw
        }
        throw new HttpError(message, res.status, data, res)
      }

      return data
    } catch (err) {
      if (err instanceof HttpError) throw err
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(timeoutController?.signal.aborted ? `Request timeout after ${timeout}ms` : 'Request aborted')
      }
      throw err
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
  }

  return {
    request,
    get: (url, config) => request(url, { ...config, method: 'GET' }),
    post: (url, data, config) => request(url, { ...config, method: 'POST', data }),
    put: (url, data, config) => request(url, { ...config, method: 'PUT', data }),
    patch: (url, data, config) => request(url, { ...config, method: 'PATCH', data }),
    delete: (url, config) => request(url, { ...config, method: 'DELETE' }),
  }
}

/** 全局默认实例（同源相对路径） */
export const http = createHttp()
