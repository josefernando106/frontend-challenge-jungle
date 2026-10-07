import type { BuyerInfo, NetworkId, Nft, Order, Quote, Wallet } from '@/contracts'
import { SEED_FAVORITES, SEED_USERS, SEED_WALLETS, buildSeedNfts, type UserRecord } from './fixtures'
import { createRng, findScenario, type ScenarioConfig } from './scenarios'

/**
 * Banco em memória da simulação, persistido em localStorage para sobreviver a refresh.
 * Fonte única de verdade para REST e eventos Socket.IO.
 */

// v2: artes dos NFTs trocadas (dados persistidos com as URLs antigas voltam ao seed).
const DB_KEY = 'nftmkt:mock-db:v2'
const SCENARIO_KEY = 'nftmkt:mock-scenario'

export interface SessionRecord {
  token: string
  userId: string
  expiresAt: number
}

export interface CartLineRecord {
  id: string
  nftId: string
  editionId: string
  quantity: number
  acknowledgedPriceEth: string
}

export interface CartRecord {
  id: string
  lines: CartLineRecord[]
  couponCode: string | null
  network: NetworkId
  updatedAt: string
}

export interface QuoteRecord {
  quote: Quote
  userId: string
  cartKey: string
}

export interface OrderRecord extends Order {
  settlesAt: number
  /** Estoque reservado na criação: liberado se o pedido for recusado. */
  reserved: { nftId: string; editionId: string; quantity: number }[]
}

export interface IdempotencyRecord {
  userId: string
  bodyHash: string
  orderId: string
  respondedOnce: boolean
}

export interface DbState {
  schemaVersion: 2
  users: UserRecord[]
  sessions: SessionRecord[]
  nfts: Nft[]
  favorites: Record<string, string[]>
  /** Chave: `user:<id>` ou `guest:<cartId>`. */
  carts: Record<string, CartRecord>
  quotes: Record<string, QuoteRecord>
  orders: OrderRecord[]
  idempotency: Record<string, IdempotencyRecord>
  wallets: Record<string, Wallet[]>
  buyerDrafts: Record<string, BuyerInfo>
  /** Gatilhos de cenário já disparados (ex.: preço alterado por cotação). */
  triggered: string[]
  seq: number
}

function seed(): DbState {
  return {
    schemaVersion: 2,
    users: structuredClone(SEED_USERS),
    sessions: [],
    nfts: buildSeedNfts(),
    favorites: structuredClone(SEED_FAVORITES),
    carts: {},
    quotes: {},
    orders: [],
    idempotency: {},
    wallets: structuredClone(SEED_WALLETS),
    buyerDrafts: {},
    triggered: [],
    seq: 1000,
  }
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function load(): DbState {
  const raw = safeStorage()?.getItem(DB_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DbState
      if (parsed.schemaVersion === 2) return parsed
    } catch {
      /* estado corrompido: volta ao seed */
    }
  }
  return seed()
}

export let db: DbState = load()

export function persist() {
  // Cotações antigas não precisam sobreviver indefinidamente.
  const quoteIds = Object.keys(db.quotes)
  if (quoteIds.length > 60) {
    for (const id of quoteIds.slice(0, quoteIds.length - 60)) delete db.quotes[id]
  }
  try {
    safeStorage()?.setItem(DB_KEY, JSON.stringify(db))
  } catch {
    /* quota excedida: mantém apenas em memória */
  }
}

export function resetDb() {
  db = seed()
  persist()
}

export function nextId(prefix: string) {
  db.seq += 1
  return `${prefix}-${db.seq.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
}

// ───────────── Cenário ativo ─────────────

let scenario: ScenarioConfig = findScenario(safeStorage()?.getItem(SCENARIO_KEY))
let rng = createRng(42)
let catalogRequestCount = 0
let transientFailuresLeft = scenario.transientFailures ?? 0

export function getScenario() {
  return scenario
}

export function setScenario(id: string) {
  scenario = findScenario(id)
  safeStorage()?.setItem(SCENARIO_KEY, scenario.id)
  // Gatilhos de cenário voltam a disparar após trocar de cenário.
  db.triggered = []
  persist()
  rng = createRng(42)
  catalogRequestCount = 0
  transientFailuresLeft = scenario.transientFailures ?? 0
  return scenario
}

export function nextLatency(group: 'catalog' | 'default'): number {
  if (group === 'catalog' && scenario.outOfOrder) {
    catalogRequestCount += 1
    return catalogRequestCount % 2 === 1 ? 1500 : 150
  }
  const { min, max } = scenario.latency
  return Math.round(min + (max - min) * rng())
}

export function consumeTransientFailure(): boolean {
  if (transientFailuresLeft > 0) {
    transientFailuresLeft -= 1
    return true
  }
  return false
}

/** Flags controladas em tempo de execução (painel/testes), independentes do cenário. */
export const runtime = {
  socketBlocked: false,
}
