import { HttpResponse } from 'msw'
import type {
  ApiErrorBody,
  ApiErrorCode,
  AppliedCoupon,
  Cart,
  CartLine,
  CartLineStatus,
  NetworkId,
  Nft,
  NftSummary,
  Quote,
  QuoteIssue,
  QuoteLine,
  User,
} from '@/contracts'
import { addEth, compareEth, mulEth, percentOfEth, subEth, minEth } from '@/lib/eth'
import { COUPONS } from './fixtures'
import { db, getScenario, nextId, persist, type CartRecord, type OrderRecord } from './db'
import { emitNftUpdated, emitOrderUpdated } from './realtime'
import type { UserRecord } from './fixtures'

// ───────────── Respostas de erro ─────────────

const STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 422,
  INVALID_CREDENTIALS: 401,
  UNAUTHENTICATED: 401,
  SESSION_EXPIRED: 401,
  FORBIDDEN: 403,
  WALLET_REJECTED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  AVAILABILITY_CONFLICT: 409,
  QUOTE_STALE: 409,
  IDEMPOTENCY_CONFLICT: 409,
  COUPON_INVALID: 422,
  COUPON_EXPIRED: 422,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
}

export class MockHttpError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public fieldErrors?: Record<string, string>,
    public details?: unknown,
  ) {
    super(message)
  }
}

export function errorResponse(error: MockHttpError) {
  const body: ApiErrorBody = {
    error: { code: error.code, message: error.message, fieldErrors: error.fieldErrors, details: error.details },
  }
  return HttpResponse.json(body, { status: STATUS[error.code] })
}

export const fail = (code: ApiErrorCode, message: string, fieldErrors?: Record<string, string>, details?: unknown) => {
  throw new MockHttpError(code, message, fieldErrors, details)
}

// ───────────── Sessão ─────────────

export function publicUser(u: UserRecord): User {
  return { id: u.id, name: u.name, username: u.username, email: u.email, bio: u.bio, avatarUrl: u.avatarUrl }
}

export async function hashPassword(salt: string, password: string) {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function createSession(userId: string) {
  const token = `tok_${crypto.randomUUID().replace(/-/g, '')}`
  const expiresAt = Date.now() + getScenario().sessionTtlMs
  db.sessions = db.sessions.filter((s) => s.expiresAt > Date.now())
  db.sessions.push({ token, userId, expiresAt })
  persist()
  return { token, expiresAt }
}

function bearer(request: Request) {
  const header = request.headers.get('authorization')
  return header?.startsWith('Bearer ') ? header.slice(7) : null
}

/** Usuário autenticado, `null` se não houver token; lança 401 se o token for inválido/expirado. */
export function optionalUser(request: Request): UserRecord | null {
  const token = bearer(request)
  if (!token) return null
  const session = db.sessions.find((s) => s.token === token)
  if (!session) fail('UNAUTHENTICATED', 'Sessão inválida. Entre novamente.')
  if (session!.expiresAt <= Date.now()) {
    db.sessions = db.sessions.filter((s) => s.token !== token)
    persist()
    fail('SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.')
  }
  const user = db.users.find((u) => u.id === session!.userId)
  if (!user) fail('UNAUTHENTICATED', 'Sessão inválida.')
  return user!
}

export function requireUser(request: Request): UserRecord {
  const user = optionalUser(request)
  if (!user) fail('UNAUTHENTICATED', 'Autenticação necessária.')
  return user!
}

export function sessionOf(request: Request) {
  const token = bearer(request)
  return db.sessions.find((s) => s.token === token) ?? null
}

// ───────────── Catálogo ─────────────

export function findNft(id: string) {
  return db.nfts.find((n) => n.id === id) ?? null
}

export function toSummary(nft: Nft): NftSummary {
  return {
    id: nft.id,
    name: nft.name,
    creator: nft.creator,
    collection: nft.collection,
    category: nft.category,
    coverImage: nft.images[0],
    fromPriceEth: nft.fromPriceEth,
    available: nft.available,
    likes: nft.likes,
    featured: nft.featured,
    createdAt: nft.createdAt,
    version: nft.version,
  }
}

/** Recalcula agregados, incrementa a versão, persiste e emite `nft.updated`. */
export function touchNft(nft: Nft) {
  nft.available = nft.editions.reduce((s, e) => s + e.available, 0)
  const open = nft.editions.filter((e) => e.available > 0).map((e) => e.priceEth)
  nft.fromPriceEth = minEth(open.length ? open : nft.editions.map((e) => e.priceEth))
  nft.version += 1
  persist()
  emitNftUpdated(nft)
}

// ───────────── Carrinho ─────────────

export function cartKeyFor(request: Request, user: UserRecord | null) {
  if (user) return `user:${user.id}`
  const guestId = request.headers.get('x-cart-id')
  if (!guestId || !/^[\w-]{8,64}$/.test(guestId)) fail('VALIDATION_ERROR', 'Cabeçalho X-Cart-Id ausente ou inválido.')
  return `guest:${guestId}`
}

export function getCart(key: string): CartRecord {
  if (!db.carts[key]) {
    db.carts[key] = { id: key, lines: [], couponCode: null, network: 'ethereum', updatedAt: new Date().toISOString() }
  }
  return db.carts[key]
}

const NETWORK_FEES: Record<NetworkId, { base: string; perLine: string }> = {
  ethereum: { base: '0.0021', perLine: '0.0003' },
  polygon: { base: '0.00012', perLine: '0.00002' },
  arbitrum: { base: '0.0004', perLine: '0.00005' },
}

export function networkFee(network: NetworkId, lineCount: number) {
  if (lineCount === 0) return '0'
  const fee = NETWORK_FEES[network]
  return addEth(fee.base, mulEth(fee.perLine, lineCount - 1))
}

export function resolveCoupon(code: string | null): { coupon: AppliedCoupon | null; issue: 'invalid' | 'expired' | null } {
  if (!code) return { coupon: null, issue: null }
  const record = COUPONS.find((c) => c.code === code.toUpperCase())
  if (!record) return { coupon: null, issue: 'invalid' }
  if (new Date(record.expiresAt).getTime() <= Date.now()) return { coupon: null, issue: 'expired' }
  return { coupon: { code: record.code, percentOff: record.percentOff, description: record.description }, issue: null }
}

function lineState(line: CartRecord['lines'][number]) {
  const nft = findNft(line.nftId)
  const edition = nft?.editions.find((e) => e.id === line.editionId)
  return { nft, edition }
}

export function cartView(cart: CartRecord): Cart {
  const lines: CartLine[] = []
  for (const line of cart.lines) {
    const { nft, edition } = lineState(line)
    if (!nft || !edition) continue
    let status: CartLineStatus = 'ok'
    if (edition.available === 0) status = 'unavailable'
    else if (line.quantity > edition.available) status = 'insufficient'
    else if (compareEth(edition.priceEth, line.acknowledgedPriceEth) !== 0) status = 'price_changed'
    lines.push({
      id: line.id,
      nftId: nft.id,
      editionId: edition.id,
      nftName: nft.name,
      editionLabel: edition.label,
      image: nft.images[0],
      unitPriceEth: edition.priceEth,
      acknowledgedPriceEth: line.acknowledgedPriceEth,
      quantity: line.quantity,
      available: edition.available,
      maxPerOrder: edition.maxPerOrder,
      lineTotalEth: mulEth(edition.priceEth, line.quantity),
      status,
    })
  }
  const billable = lines.filter((l) => l.status !== 'unavailable')
  const subtotal = addEth('0', ...billable.map((l) => l.lineTotalEth))
  const { coupon } = resolveCoupon(cart.couponCode)
  const discount = coupon ? percentOfEth(subtotal, coupon.percentOff) : '0'
  const fee = networkFee(cart.network, billable.length)
  return {
    id: cart.id,
    lines,
    itemCount: lines.reduce((s, l) => s + l.quantity, 0),
    coupon,
    network: cart.network,
    summary: {
      subtotalEth: subtotal,
      discountEth: discount,
      networkFeeEth: fee,
      totalEth: addEth(subEth(subtotal, discount), fee),
    },
    updatedAt: cart.updatedAt,
  }
}

export function assertQuantity(nftId: string, editionId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    fail('VALIDATION_ERROR', 'Quantidade deve ser um inteiro maior que zero.', { quantity: 'Quantidade inválida.' })
  }
  const nft = findNft(nftId)
  if (!nft) fail('NOT_FOUND', 'NFT não encontrado.')
  const edition = nft!.editions.find((e) => e.id === editionId)
  if (!edition) fail('NOT_FOUND', 'Edição não encontrada.')
  if (edition!.available === 0) {
    fail('AVAILABILITY_CONFLICT', `A ${edition!.label} de "${nft!.name}" está esgotada.`, undefined, { available: 0 })
  }
  const limit = Math.min(edition!.available, edition!.maxPerOrder)
  if (quantity > limit) {
    fail(
      'AVAILABILITY_CONFLICT',
      `Máximo de ${limit} unidade(s) para a ${edition!.label}.`,
      { quantity: `Máximo de ${limit}.` },
      { available: edition!.available, maxPerOrder: edition!.maxPerOrder },
    )
  }
  return { nft: nft!, edition: edition! }
}

/** Junta o carrinho do visitante ao do usuário respeitando limites de disponibilidade. */
export function mergeCarts(guestKey: string, userKey: string) {
  const guest = db.carts[guestKey]
  const target = getCart(userKey)
  if (!guest) return target
  for (const line of guest.lines) {
    const { edition } = lineState(line)
    if (!edition) continue
    const existing = target.lines.find((l) => l.editionId === line.editionId)
    const limit = Math.max(0, Math.min(edition.available, edition.maxPerOrder))
    if (existing) existing.quantity = Math.max(1, Math.min(existing.quantity + line.quantity, limit || existing.quantity))
    else target.lines.push({ ...line, id: nextId('line'), quantity: Math.max(1, Math.min(line.quantity, limit || line.quantity)) })
  }
  if (!target.couponCode && guest.couponCode) target.couponCode = guest.couponCode
  target.updatedAt = new Date().toISOString()
  delete db.carts[guestKey]
  return target
}

// ───────────── Cotação ─────────────

const QUOTE_TTL_MS = 10 * 60 * 1000

export function buildQuote(cart: CartRecord, network: NetworkId): Quote {
  const lines: QuoteLine[] = []
  const issues: QuoteIssue[] = []
  for (const line of cart.lines) {
    const { nft, edition } = lineState(line)
    if (!nft || !edition) continue
    if (edition.available === 0) {
      issues.push({ type: 'unavailable', lineId: line.id, nftName: nft.name })
      continue
    }
    if (line.quantity > edition.available) {
      issues.push({ type: 'insufficient', lineId: line.id, nftName: nft.name, available: edition.available, requested: line.quantity })
    }
    if (compareEth(edition.priceEth, line.acknowledgedPriceEth) !== 0) {
      issues.push({
        type: 'price_changed',
        lineId: line.id,
        nftName: nft.name,
        previousPriceEth: line.acknowledgedPriceEth,
        currentPriceEth: edition.priceEth,
      })
    }
    lines.push({
      lineId: line.id,
      nftId: nft.id,
      editionId: edition.id,
      nftName: nft.name,
      editionLabel: edition.label,
      image: nft.images[0],
      unitPriceEth: edition.priceEth,
      quantity: line.quantity,
      lineTotalEth: mulEth(edition.priceEth, line.quantity),
    })
  }
  const { coupon, issue } = resolveCoupon(cart.couponCode)
  if (issue && cart.couponCode) issues.push({ type: 'coupon_invalid', code: cart.couponCode, reason: issue })
  const subtotal = addEth('0', ...lines.map((l) => l.lineTotalEth))
  const discount = coupon ? percentOfEth(subtotal, coupon.percentOff) : '0'
  const fee = networkFee(network, lines.length)
  const now = Date.now()
  return {
    id: nextId('qt'),
    network,
    lines,
    coupon,
    issues,
    subtotalEth: subtotal,
    discountEth: discount,
    networkFeeEth: fee,
    totalEth: addEth(subEth(subtotal, discount), fee),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + QUOTE_TTL_MS).toISOString(),
  }
}

/** Issues que impedem a criação do pedido (price_changed é informativo e já está refletido nos valores). */
export function blockingIssues(quote: Quote) {
  return quote.issues.filter((i) => i.type !== 'price_changed')
}

export function quotesDiffer(a: Quote, b: Quote) {
  if (a.network !== b.network || a.lines.length !== b.lines.length) return true
  if (a.totalEth !== b.totalEth || a.subtotalEth !== b.subtotalEth) return true
  if (a.discountEth !== b.discountEth || a.networkFeeEth !== b.networkFeeEth) return true
  if (blockingIssues(a).length !== blockingIssues(b).length) return true
  return a.lines.some((l, i) => {
    const o = b.lines[i]
    return l.editionId !== o.editionId || l.quantity !== o.quantity || compareEth(l.unitPriceEth, o.unitPriceEth) !== 0
  })
}

// ───────────── Pedidos ─────────────

function txHash() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return `0x${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

export function newOrderFields() {
  const hash = txHash()
  return { transactionHash: hash, explorerUrl: `https://explorer.nft-market.mock/tx/${hash}` }
}

/** Liquida pedidos pendentes cujo prazo venceu. Executado periodicamente e a cada requisição. */
export function settleDueOrders(now = Date.now()) {
  for (const order of db.orders) {
    if (order.status !== 'pending' || order.settlesAt > now) continue
    const declined = getScenario().paymentDeclined
    order.status = declined ? 'declined' : 'confirmed'
    order.declineReason = declined ? 'Pagamento recusado pela carteira (saldo insuficiente na simulação).' : null
    order.updatedAt = new Date(now).toISOString()
    order.version += 1

    if (declined) {
      for (const r of order.reserved) {
        const nft = findNft(r.nftId)
        const edition = nft?.editions.find((e) => e.id === r.editionId)
        if (nft && edition) {
          edition.available += r.quantity
          touchNft(nft)
        }
      }
    } else {
      // Remove do carrinho apenas os itens/quantidades comprados.
      const cart = db.carts[`user:${order.userId}`]
      if (cart) {
        for (const line of order.lines) {
          const cartLine = cart.lines.find((l) => l.editionId === line.editionId)
          if (!cartLine) continue
          cartLine.quantity -= line.quantity
        }
        cart.lines = cart.lines.filter((l) => l.quantity > 0)
        cart.couponCode = cart.lines.length ? cart.couponCode : null
        cart.updatedAt = new Date(now).toISOString()
      }
    }
    persist()
    emitOrderUpdated(order)
  }
}

export function publicOrder(order: OrderRecord) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { settlesAt, reserved, ...rest } = order
  return rest
}
