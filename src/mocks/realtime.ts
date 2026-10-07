import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { Nft, NftUpdatedEvent, Order, OrderUpdatedEvent, RealtimeEvent } from '@/contracts'
import { db, getScenario, runtime } from './db'
import { env } from '@/lib/env'

/**
 * "Servidor" Socket.IO simulado. O MSW intercepta o WebSocket aberto pelo socket.io-client
 * (transport websocket) e o binding codifica/decodifica o protocolo Engine.IO/Socket.IO.
 * Limitações: sem namespaces/rooms/acks; o handshake é sintetizado pelo binding.
 */

interface ClientEntry {
  io: ReturnType<typeof toSocketIo>
  close: () => void
  userId: string | null
}

const clients = new Set<ClientEntry>()
const history: RealtimeEvent[] = []
const PING_INTERVAL = 20_000

// O MSW remove o prefixo "/socket.io/" da URL do cliente antes do match: o link usa só a origem.
const socketLink = ws.link(env.socketUrl)

function userIdFromToken(token: unknown): string | null {
  if (typeof token !== 'string') return null
  const session = db.sessions.find((s) => s.token === token)
  if (!session || session.expiresAt <= Date.now()) return null
  return session.userId
}

export const realtimeHandler = socketLink.addEventListener('connection', (connection) => {
  if (getScenario().offline || runtime.socketBlocked) {
    connection.client.close(1011, 'unavailable')
    return
  }

  const entry: ClientEntry = {
    io: toSocketIo(connection),
    close: () => connection.client.close(),
    userId: null,
  }
  clients.add(entry)

  // Pacote CONNECT do Socket.IO ("40{...auth}") carrega o token da sessão.
  connection.client.addEventListener('message', (event) => {
    if (typeof event.data === 'string' && event.data.startsWith('40')) {
      try {
        const auth = event.data.length > 2 ? JSON.parse(event.data.slice(2)) : {}
        entry.userId = userIdFromToken(auth?.token)
      } catch {
        entry.userId = null
      }
    }
  })

  // Heartbeat Engine.IO (ping "2"); o cliente responde "3".
  const ping = setInterval(() => connection.client.send('2'), PING_INTERVAL)
  connection.client.addEventListener('close', () => {
    clearInterval(ping)
    clients.delete(entry)
  })
})

function record(event: RealtimeEvent) {
  history.push(event)
  if (history.length > 50) history.shift()
}

function deliver(event: RealtimeEvent) {
  for (const client of clients) {
    if (event.type === 'order.updated' && client.userId !== event.userId) continue
    client.io.client.emit(event.type, event)
  }
}

let eventSeq = 0
const eventId = () => `evt-${Date.now().toString(36)}-${(++eventSeq).toString(36)}`

export function emitNftUpdated(nft: Nft) {
  const event: NftUpdatedEvent = {
    eventId: eventId(),
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: new Date().toISOString(),
    data: {
      nftId: nft.id,
      name: nft.name,
      editions: nft.editions.map(({ id, label, priceEth, available }) => ({ id, label, priceEth, available })),
      fromPriceEth: nft.fromPriceEth,
      available: nft.available,
    },
  }
  record(event)
  deliver(event)
  return event
}

export function emitOrderUpdated(order: Order) {
  const event: OrderUpdatedEvent = {
    eventId: eventId(),
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt: new Date().toISOString(),
    userId: order.userId,
    data: { order: stripInternal(order) },
  }
  record(event)
  deliver(event)
  return event
}

function stripInternal(order: Order): Order {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { settlesAt, reserved, ...publicOrder } = order as Order & { settlesAt?: number; reserved?: unknown }
  return publicOrder
}

/** Reenvia o último evento (mesmo eventId) — testa deduplicação. */
export function replayLastEvent(type?: RealtimeEvent['type']) {
  const event = [...history].reverse().find((e) => !type || e.type === type)
  if (event) deliver(event)
  return event ?? null
}

/** Reenvia um evento antigo com versão inferior — testa que o cliente não regride estado. */
export function replayStaleEvent(type?: RealtimeEvent['type']) {
  const events = history.filter((e) => !type || e.type === type)
  if (events.length < 2) return null
  const stale = events[events.length - 2]
  const replay = { ...stale, eventId: eventId() } as RealtimeEvent
  deliver(replay)
  return replay
}

/** Derruba todas as conexões; com `block`, recusa novas até `unblockSockets()`. */
export function disconnectSockets(block = false) {
  runtime.socketBlocked = block
  for (const client of [...clients]) client.close()
}

export function unblockSockets() {
  runtime.socketBlocked = false
}

export function connectedClients() {
  return [...clients].map((c) => ({ userId: c.userId }))
}

export { stripInternal }
