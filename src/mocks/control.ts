import { SCENARIOS } from './scenarios'
import { db, getScenario, persist, resetDb, setScenario } from './db'
import { findNft, settleDueOrders, touchNft } from './domain'
import { connectedClients, disconnectSockets, replayLastEvent, replayStaleEvent, unblockSockets } from './realtime'
import { isEthAmount } from '@/lib/eth'

/**
 * API de controle da simulação, exposta em `window.__mock`.
 * Usada pelo painel de mocks e pelos testes Playwright. Toda alteração de dados passa pelo
 * banco simulado e é propagada pelos eventos Socket.IO — nunca diretamente para a UI.
 */
export interface MockControl {
  scenarios: () => { id: string; label: string; description: string }[]
  getScenario: () => string
  setScenario: (id: string) => string
  /** Restaura o seed, volta ao cenário padrão e limpa o estado local do app. */
  reset: (options?: { reload?: boolean }) => void
  expireSessions: () => number
  updateNft: (nftId: string, patch: { editionId?: string; priceEth?: string; available?: number }) => number
  replayLastEvent: (type?: 'nft.updated' | 'order.updated') => string | null
  replayStaleEvent: (type?: 'nft.updated' | 'order.updated') => string | null
  disconnectSockets: (options?: { block?: boolean }) => void
  unblockSockets: () => void
  connectedClients: () => { userId: string | null }[]
  settleOrders: () => void
  snapshot: () => unknown
}

const APP_PREFIX = 'nftmkt:'

export function createControl(): MockControl {
  return {
    scenarios: () => SCENARIOS.map(({ id, label, description }) => ({ id, label, description })),
    getScenario: () => getScenario().id,
    setScenario: (id) => setScenario(id).id,
    reset: ({ reload = true } = {}) => {
      resetDb()
      setScenario('default')
      try {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith(APP_PREFIX) && !key.startsWith(`${APP_PREFIX}mock-`)) localStorage.removeItem(key)
        }
        for (const key of Object.keys(sessionStorage)) {
          if (key.startsWith(APP_PREFIX)) sessionStorage.removeItem(key)
        }
      } catch {
        /* storage indisponível */
      }
      if (reload) window.location.assign('/')
    },
    expireSessions: () => {
      const now = Date.now()
      db.sessions.forEach((s) => (s.expiresAt = now - 1))
      persist()
      return db.sessions.length
    },
    updateNft: (nftId, patch) => {
      const nft = findNft(nftId)
      if (!nft) throw new Error(`NFT ${nftId} não existe`)
      const edition = patch.editionId ? nft.editions.find((e) => e.id === patch.editionId) : nft.editions[0]
      if (!edition) throw new Error(`Edição ${patch.editionId} não existe`)
      if (patch.priceEth !== undefined) {
        if (!isEthAmount(patch.priceEth)) throw new Error('priceEth inválido')
        edition.priceEth = patch.priceEth
      }
      if (patch.available !== undefined) edition.available = Math.max(0, Math.floor(patch.available))
      touchNft(nft)
      return nft.version
    },
    replayLastEvent: (type) => replayLastEvent(type)?.eventId ?? null,
    replayStaleEvent: (type) => replayStaleEvent(type)?.eventId ?? null,
    disconnectSockets: ({ block = false } = {}) => disconnectSockets(block),
    unblockSockets,
    connectedClients,
    settleOrders: () => {
      db.orders.forEach((o) => {
        if (o.status === 'pending') o.settlesAt = 0
      })
      settleDueOrders()
    },
    snapshot: () => structuredClone(db),
  }
}

declare global {
  interface Window {
    __mock?: MockControl
  }
}
