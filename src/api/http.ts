import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import type { ApiErrorBody, ApiErrorCode } from '@/contracts'
import { env } from '@/lib/env'
import { readJson, STORAGE_KEYS, writeJson } from '@/lib/storage'
import { sessionStore } from '@/features/auth/session-store'

export type ClientErrorCode = ApiErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'CANCELED' | 'UNKNOWN'

/** Erro normalizado: toda falha de transporte chega à UI neste formato. */
export class ApiError extends Error {
  readonly status: number | null
  readonly code: ClientErrorCode
  readonly fieldErrors: Record<string, string>
  readonly details: unknown

  constructor(params: {
    status: number | null
    code: ClientErrorCode
    message: string
    fieldErrors?: Record<string, string>
    details?: unknown
  }) {
    super(params.message)
    this.name = 'ApiError'
    this.status = params.status
    this.code = params.code
    this.fieldErrors = params.fieldErrors ?? {}
    this.details = params.details
  }

  get isNetwork() {
    return this.code === 'NETWORK_ERROR'
  }
  get isTimeout() {
    return this.code === 'TIMEOUT'
  }
  get isAuth() {
    return this.status === 401
  }
  /** Falhas transitórias que podem ser repetidas com segurança em leituras. */
  get isRetryable() {
    return this.isNetwork || this.isTimeout || (this.status !== null && this.status >= 500)
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function getGuestCartId(): string {
  let id = readJson<string>(STORAGE_KEYS.guestCartId)
  if (!id) {
    id = `guest-${crypto.randomUUID()}`
    writeJson(STORAGE_KEYS.guestCartId, id)
  }
  return id
}

export const http = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.httpTimeoutMs,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
})

http.interceptors.request.use((config) => {
  const token = sessionStore.token()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  else config.headers.set('X-Cart-Id', getGuestCartId())
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const normalized = normalizeError(error)
    // 401 para o token vigente = sessão inválida/expirada.
    if (normalized.isAuth && error instanceof AxiosError) {
      const sent = String(error.config?.headers?.get('Authorization') ?? '').replace('Bearer ', '')
      if (sent && normalized.code !== 'INVALID_CREDENTIALS') sessionStore.expire(sent)
    }
    return Promise.reject(normalized)
  },
)

function normalizeError(error: unknown): ApiError {
  if (axios.isCancel(error)) {
    return new ApiError({ status: null, code: 'CANCELED', message: 'Requisição cancelada.' })
  }
  if (error instanceof AxiosError) {
    if (error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT) {
      return new ApiError({ status: null, code: 'TIMEOUT', message: 'O servidor demorou a responder.' })
    }
    if (!error.response) {
      return new ApiError({ status: null, code: 'NETWORK_ERROR', message: 'Sem conexão com o servidor.' })
    }
    const body = error.response.data as Partial<ApiErrorBody> | undefined
    return new ApiError({
      status: error.response.status,
      code: body?.error?.code ?? (error.response.status >= 500 ? 'INTERNAL_ERROR' : 'UNKNOWN'),
      message: body?.error?.message ?? 'Ocorreu um erro inesperado.',
      fieldErrors: body?.error?.fieldErrors,
      details: body?.error?.details,
    })
  }
  return new ApiError({ status: null, code: 'UNKNOWN', message: 'Ocorreu um erro inesperado.' })
}

/** Helpers tipados: retornam somente o corpo. */
export async function get<T>(url: string, config?: AxiosRequestConfig) {
  return (await http.get<T>(url, config)).data
}
export async function post<T>(url: string, body?: unknown, config?: AxiosRequestConfig) {
  return (await http.post<T>(url, body, config)).data
}
export async function put<T>(url: string, body?: unknown, config?: AxiosRequestConfig) {
  return (await http.put<T>(url, body, config)).data
}
export async function patch<T>(url: string, body?: unknown, config?: AxiosRequestConfig) {
  return (await http.patch<T>(url, body, config)).data
}
export async function del<T>(url: string, config?: AxiosRequestConfig) {
  return (await http.delete<T>(url, config)).data
}
