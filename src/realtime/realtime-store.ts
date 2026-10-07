import { useSyncExternalStore } from 'react'
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/contracts'

/**
 * Estado observável do tempo real: status da conexão, avisos de alteração de itens do
 * carrinho e um barramento para telas que precisam reagir a eventos (ex.: checkout).
 * Alimentado exclusivamente pelos handlers do socket.io-client.
 */

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting'

export interface CartNotice {
  id: string
  nftId: string
  message: string
  at: number
}

interface State {
  status: ConnectionStatus
  notices: CartNotice[]
}

let state: State = { status: 'idle', notices: [] }
const listeners = new Set<() => void>()

function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

type BusEvent =
  | { type: 'nft.updated'; event: NftUpdatedEvent }
  | { type: 'order.updated'; event: OrderUpdatedEvent }
  | { type: 'reconnected' }
const busListeners = new Set<(e: BusEvent) => void>()

export const realtimeStore = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  setStatus(status: ConnectionStatus) {
    if (state.status !== status) set({ status })
  },
  pushNotice(notice: CartNotice) {
    set({ notices: [...state.notices.filter((n) => n.nftId !== notice.nftId), notice].slice(-5) })
  },
  dismissNotice(id: string) {
    set({ notices: state.notices.filter((n) => n.id !== id) })
  },
  clearNotices() {
    if (state.notices.length) set({ notices: [] })
  },
  emit(event: BusEvent) {
    busListeners.forEach((l) => l(event))
  },
  onEvent(listener: (e: BusEvent) => void) {
    busListeners.add(listener)
    return () => {
      busListeners.delete(listener)
    }
  },
}

export function useRealtimeState() {
  return useSyncExternalStore(realtimeStore.subscribe, realtimeStore.get)
}
