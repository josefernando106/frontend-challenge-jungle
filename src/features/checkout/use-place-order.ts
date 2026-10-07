import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { CreateOrderRequest, Order } from '@/contracts'
import { api } from '@/api/endpoints'
import { isApiError, type ApiError } from '@/api/http'
import { qk } from '@/api/query-keys'
import { readJson, removeKey, STORAGE_KEYS, writeJson } from '@/lib/storage'

/**
 * Envio idempotente do pedido.
 * - A chave de idempotência é gerada por cotação e persistida (sessionStorage) ANTES do envio.
 * - Timeout/queda de rede/5xx: reenvia automaticamente uma vez com a MESMA chave; depois, o
 *   usuário pode tentar de novo (ainda com a mesma chave). O servidor devolve o mesmo pedido.
 * - Refresh no meio do envio: a tentativa salva é retomada ao reabrir o checkout.
 * - Cliques repetidos: ignorados enquanto há envio em andamento.
 */

export interface PendingAttempt {
  key: string
  quoteId: string
  body: CreateOrderRequest
  createdAt: number
}

type Status = 'idle' | 'submitting' | 'retrying' | 'failed'

export function usePlaceOrder(userId: string, onSuccess: (order: Order) => void) {
  const queryClient = useQueryClient()
  const storageKey = STORAGE_KEYS.checkoutAttempt(userId)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<ApiError | null>(null)
  const inFlight = useRef(false)
  const onSuccessRef = useRef(onSuccess)
  useEffect(() => {
    onSuccessRef.current = onSuccess
  })

  const send = useCallback(
    async (attempt: PendingAttempt, autoRetries: number): Promise<void> => {
      for (let retriesLeft = autoRetries; ; retriesLeft--) {
        try {
          const order = await api.checkout.createOrder(attempt.body, attempt.key)
          removeKey(storageKey, 'session')
          queryClient.setQueryData(qk.user.order(userId, order.id), order)
          void queryClient.invalidateQueries({ queryKey: ['user', userId, 'orders', 'list'] })
          setStatus('idle')
          onSuccessRef.current(order)
          return
        } catch (e) {
          const err = isApiError(e) ? e : null
          const transient = !err || err.isRetryable
          if (transient && retriesLeft > 0) {
            setStatus('retrying')
            await new Promise((r) => setTimeout(r, 1200))
            continue
          }
          // Erros definitivos (4xx): o pedido não foi criado; a tentativa é descartada.
          if (!transient) removeKey(storageKey, 'session')
          setError(err)
          setStatus('failed')
          throw e
        }
      }
    },
    [queryClient, storageKey, userId],
  )

  const submit = useCallback(
    async (body: CreateOrderRequest) => {
      if (inFlight.current) return
      inFlight.current = true
      setError(null)
      setStatus('submitting')
      const saved = readJson<PendingAttempt>(storageKey, 'session')
      const attempt: PendingAttempt =
        saved && saved.quoteId === body.quoteId
          ? saved
          : { key: crypto.randomUUID(), quoteId: body.quoteId, body, createdAt: Date.now() }
      writeJson(storageKey, attempt, 'session')
      try {
        await send(attempt, 1)
      } finally {
        inFlight.current = false
      }
    },
    [send, storageKey],
  )

  /** Retoma uma tentativa interrompida (refresh/queda) com a mesma chave. */
  const resume = useCallback(async () => {
    const saved = readJson<PendingAttempt>(storageKey, 'session')
    if (!saved || inFlight.current) return false
    inFlight.current = true
    setStatus('submitting')
    try {
      await send(saved, 1)
    } catch {
      /* estado de erro já exposto */
    } finally {
      inFlight.current = false
    }
    return true
  }, [send, storageKey])

  const pendingAttempt = readJson<PendingAttempt>(storageKey, 'session')

  return { submit, resume, status, error, pendingAttempt, reset: () => setError(null) }
}
