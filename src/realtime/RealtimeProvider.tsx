import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@/contracts'
import { env } from '@/lib/env'
import { useSession } from '@/features/auth/session-store'
import { EventGate } from './event-gate'
import { applyNftUpdated, applyOrderUpdated, reconcileAfterReconnect } from './apply-events'
import { realtimeStore } from './realtime-store'

/**
 * Mantém uma conexão Socket.IO por sessão. Trocar de usuário (ou sair) encerra o socket
 * anterior, descarta seus listeners e cria outro com o novo token — eventos da sessão
 * anterior não alcançam o novo usuário.
 */
export function RealtimeProvider() {
  const queryClient = useQueryClient()
  const session = useSession()
  const token = session.status === 'authenticated' ? session.token : null
  const userId = session.status === 'authenticated' ? session.user.id : null

  useEffect(() => {
    let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null
    let disposed = false
    realtimeStore.setStatus('connecting')

    // Import dinâmico: o engine.io-client captura `globalThis.WebSocket` ao ser avaliado,
    // então só pode carregar depois que a camada de mocks (se ativa) já interceptou o WebSocket.
    // Isso também tira o socket.io-client do caminho crítico de renderização.
    void import('socket.io-client').then(({ io }) => {
      if (disposed) return
      const s: Socket<ServerToClientEvents, ClientToServerEvents> = io(env.socketUrl, {
        transports: ['websocket'],
        auth: token ? { token } : {},
        reconnectionDelay: 400,
        reconnectionDelayMax: 3000,
        timeout: 5000,
      })
      socket = s
      const gate = new EventGate()
      let connectedBefore = false

      s.on('connect', () => {
        realtimeStore.setStatus('connected')
        if (connectedBefore) reconcileAfterReconnect(queryClient, userId)
        connectedBefore = true
      })
      s.on('disconnect', () => realtimeStore.setStatus('reconnecting'))
      s.on('connect_error', () => realtimeStore.setStatus('reconnecting'))

      s.on('nft.updated', (event) => {
        if (gate.accept(event)) applyNftUpdated(queryClient, event)
      })
      s.on('order.updated', (event) => {
        if (event.userId !== userId) return
        if (gate.accept(event)) applyOrderUpdated(queryClient, event, userId)
      })
    })

    return () => {
      disposed = true
      socket?.removeAllListeners()
      socket?.io.removeAllListeners()
      socket?.disconnect()
      realtimeStore.setStatus('idle')
    }
  }, [queryClient, token, userId])

  return null
}
