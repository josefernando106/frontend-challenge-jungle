import { delay, http, HttpResponse, type DefaultBodyType, type HttpResponseResolver, type PathParams } from 'msw'
import type {
  AddCartItemRequest,
  ApplyCouponRequest,
  CatalogFacets,
  CatalogSort,
  CategoryId,
  ChangePasswordRequest,
  ConnectWalletRequest,
  CreateOrderRequest,
  CreateQuoteRequest,
  LoginRequest,
  MergeCartRequest,
  NetworkId,
  Paginated,
  NftSummary,
  RegisterRequest,
  UpdateAvatarRequest,
  UpdateCartItemRequest,
  UpdateProfileRequest,
  UpsertWalletRequest,
  Wallet,
  WalletConnection,
} from '@/contracts'
import { CATALOG_PAGE_SIZE, CATEGORIES, NETWORKS, WALLET_PROVIDERS } from '@/contracts'
import { addEth, compareEth, isEthAmount, maxEth, minEth, percentOfEth } from '@/lib/eth'
import { env } from '@/lib/env'
import { consumeTransientFailure, db, getScenario, nextId, nextLatency, persist } from './db'
import {
  MockHttpError,
  assertQuantity,
  blockingIssues,
  buildQuote,
  cartKeyFor,
  cartView,
  createSession,
  errorResponse,
  fail,
  findNft,
  getCart,
  hashPassword,
  mergeCarts,
  newOrderFields,
  optionalUser,
  publicOrder,
  publicUser,
  quotesDiffer,
  requireUser,
  resolveCoupon,
  sessionOf,
  settleDueOrders,
  toSummary,
  touchNft,
} from './domain'
import type { OrderRecord } from './db'

const api = (path: string) => `${env.apiBaseUrl}${path}`

type Group = 'catalog' | 'default'
interface RouteOptions {
  /** Afetada pelo cenário server-error. */
  read?: boolean
  /** Afetada pelo cenário transient-error. */
  transient?: boolean
}

/**
 * Envelope comum: liquida pedidos vencidos, aplica cenário (offline, latência, falhas)
 * e converte MockHttpError na resposta de erro do contrato.
 */
function route<P extends PathParams = PathParams, B extends DefaultBodyType = DefaultBodyType>(
  group: Group,
  resolver: HttpResponseResolver<P, B>,
  options: RouteOptions = {},
): HttpResponseResolver<P, B> {
  return async (info) => {
    settleDueOrders()
    const scenario = getScenario()
    if (scenario.offline) return HttpResponse.error()
    await delay(nextLatency(group))
    if (options.read && scenario.serverError) {
      return HttpResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Erro interno simulado.' } },
        { status: 500 },
      )
    }
    if (options.transient && scenario.transientFailures && consumeTransientFailure()) {
      return HttpResponse.json(
        { error: { code: 'SERVICE_UNAVAILABLE', message: 'Serviço temporariamente indisponível.' } },
        { status: 503, headers: { 'Retry-After': '1' } },
      )
    }
    try {
      return await resolver(info)
    } catch (error) {
      if (error instanceof MockHttpError) return errorResponse(error)
      console.error('[mock] erro inesperado', error)
      return HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Erro inesperado.' } }, { status: 500 })
    }
  }
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    return fail('VALIDATION_ERROR', 'Corpo da requisição inválido.') as never
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PASSWORD_RULES = (p: string) =>
  p.length < 8 ? 'Mínimo de 8 caracteres.' : !/[A-Za-z]/.test(p) || !/\d/.test(p) ? 'Use letras e números.' : null

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

// ───────────────────────────── Auth ─────────────────────────────

const authHandlers = [
  http.post(
    api('/auth/register'),
    route('default', async ({ request }) => {
      const body = await readJson<RegisterRequest>(request)
      const fieldErrors: Record<string, string> = {}
      const name = body.name?.trim() ?? ''
      const email = body.email?.trim().toLowerCase() ?? ''
      if (name.length < 2) fieldErrors.name = 'Informe seu nome (mín. 2 caracteres).'
      if (!EMAIL.test(email)) fieldErrors.email = 'E-mail inválido.'
      const pwdError = PASSWORD_RULES(body.password ?? '')
      if (pwdError) fieldErrors.password = pwdError
      if (Object.keys(fieldErrors).length) fail('VALIDATION_ERROR', 'Verifique os campos.', fieldErrors)
      if (db.users.some((u) => u.email === email)) {
        fail('CONFLICT', 'Este e-mail já está cadastrado.', { email: 'E-mail já cadastrado. Faça login.' })
      }
      const salt = crypto.randomUUID()
      const baseUsername = normalize(name).replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') || 'colecionador'
      let username = baseUsername
      for (let i = 2; db.users.some((u) => u.username === username); i++) username = `${baseUsername}${i}`
      const user = {
        id: nextId('usr'),
        name,
        email,
        username,
        bio: '',
        avatarUrl: '/assets/avatars/user-04.svg',
        salt,
        passwordHash: await hashPassword(salt, body.password),
      }
      db.users.push(user)
      const { token, expiresAt } = createSession(user.id)
      return HttpResponse.json({ token, user: publicUser(user), expiresAt: new Date(expiresAt).toISOString() }, { status: 201 })
    }),
  ),

  http.post(
    api('/auth/login'),
    route('default', async ({ request }) => {
      const body = await readJson<LoginRequest>(request)
      const fieldErrors: Record<string, string> = {}
      if (!EMAIL.test(body.email?.trim() ?? '')) fieldErrors.email = 'E-mail inválido.'
      if (!body.password) fieldErrors.password = 'Informe a senha.'
      if (Object.keys(fieldErrors).length) fail('VALIDATION_ERROR', 'Verifique os campos.', fieldErrors)
      const user = db.users.find((u) => u.email === body.email.trim().toLowerCase())
      if (!user || (await hashPassword(user.salt, body.password)) !== user.passwordHash) {
        fail('INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')
      }
      const { token, expiresAt } = createSession(user!.id)
      return HttpResponse.json({ token, user: publicUser(user!), expiresAt: new Date(expiresAt).toISOString() })
    }),
  ),

  http.get(
    api('/auth/session'),
    route('default', ({ request }) => {
      const user = requireUser(request)
      const session = sessionOf(request)!
      return HttpResponse.json({ user: publicUser(user), expiresAt: new Date(session.expiresAt).toISOString() })
    }),
  ),

  http.post(
    api('/auth/logout'),
    route('default', ({ request }) => {
      const session = sessionOf(request)
      if (session) {
        db.sessions = db.sessions.filter((s) => s.token !== session.token)
        persist()
      }
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]

// ───────────────────────────── Catálogo ─────────────────────────────

const SORTS: CatalogSort[] = ['recent', 'price_asc', 'price_desc', 'popular', 'name']

const catalogHandlers = [
  http.get(
    api('/nfts'),
    route(
      'catalog',
      ({ request }) => {
        const url = new URL(request.url)
        const params = url.searchParams
        const q = normalize(params.get('q')?.trim() ?? '')
        const categories = params.getAll('category') as CategoryId[]
        const collection = params.get('collection')
        const minPrice = params.get('minPrice')
        const maxPrice = params.get('maxPrice')
        const status = params.get('status') ?? 'all'
        const listedWithinDays = params.get('listedWithinDays')
        const sort = (params.get('sort') ?? 'recent') as CatalogSort
        const page = Math.max(1, Number(params.get('page') ?? 1) || 1)
        const pageSize = Math.min(48, Math.max(1, Number(params.get('pageSize') ?? CATALOG_PAGE_SIZE) || CATALOG_PAGE_SIZE))

        const fieldErrors: Record<string, string> = {}
        if (minPrice && !isEthAmount(minPrice)) fieldErrors.minPrice = 'Preço mínimo inválido.'
        if (maxPrice && !isEthAmount(maxPrice)) fieldErrors.maxPrice = 'Preço máximo inválido.'
        if (listedWithinDays && !(Number(listedWithinDays) > 0)) fieldErrors.listedWithinDays = 'Período inválido.'
        if (!SORTS.includes(sort)) fieldErrors.sort = 'Ordenação inválida.'
        if (categories.some((c) => !CATEGORIES.some((k) => k.id === c))) fieldErrors.category = 'Categoria inválida.'
        if (Object.keys(fieldErrors).length) fail('VALIDATION_ERROR', 'Parâmetros de busca inválidos.', fieldErrors)

        let items = getScenario().emptyCatalog ? [] : [...db.nfts]
        if (q) {
          items = items.filter((n) =>
            [n.name, n.creator.name, n.collection.name].some((field) => normalize(field).includes(q)),
          )
        }
        if (categories.length) items = items.filter((n) => categories.includes(n.category))
        if (collection) items = items.filter((n) => n.collection.id === collection)
        if (minPrice) items = items.filter((n) => compareEth(n.fromPriceEth, minPrice) >= 0)
        if (maxPrice) items = items.filter((n) => compareEth(n.fromPriceEth, maxPrice) <= 0)
        if (status === 'available') items = items.filter((n) => n.available > 0)
        if (status === 'soldout') items = items.filter((n) => n.available === 0)
        if (listedWithinDays) {
          // Relativo à listagem mais recente (determinístico, independe do relógio do navegador).
          const latest = Math.max(...db.nfts.map((n) => Date.parse(n.createdAt)))
          const since = latest - Number(listedWithinDays) * 864e5
          items = items.filter((n) => Date.parse(n.createdAt) >= since)
        }

        const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)
        items.sort((a, b) => {
          switch (sort) {
            case 'price_asc':
              return compareEth(a.fromPriceEth, b.fromPriceEth) || byId(a, b)
            case 'price_desc':
              return compareEth(b.fromPriceEth, a.fromPriceEth) || byId(a, b)
            case 'popular':
              return b.likes - a.likes || byId(a, b)
            case 'name':
              return a.name.localeCompare(b.name, 'pt-BR') || byId(a, b)
            default:
              return b.createdAt.localeCompare(a.createdAt) || byId(a, b)
          }
        })

        const total = items.length
        const totalPages = Math.max(1, Math.ceil(total / pageSize))
        const body: Paginated<NftSummary> = {
          items: items.slice((page - 1) * pageSize, page * pageSize).map(toSummary),
          page,
          pageSize,
          total,
          totalPages,
        }
        return HttpResponse.json(body)
      },
      { read: true, transient: true },
    ),
  ),

  http.get(
    api('/nfts/highlights'),
    route(
      'catalog',
      () => {
        const items = getScenario().emptyCatalog ? [] : db.nfts.filter((n) => n.featured).map(toSummary)
        return HttpResponse.json(items)
      },
      { read: true },
    ),
  ),

  http.get(
    api('/catalog/facets'),
    route(
      'default',
      () => {
        const nfts = getScenario().emptyCatalog ? [] : db.nfts
        const prices = nfts.map((n) => n.fromPriceEth)
        const body: CatalogFacets = {
          categories: CATEGORIES.map((c) => ({ ...c, count: nfts.filter((n) => n.category === c.id).length })),
          collections: [...new Map(db.nfts.map((n) => [n.collection.id, n.collection])).values()].map((c) => ({
            ...c,
            count: nfts.filter((n) => n.collection.id === c.id).length,
          })),
          priceRange: { min: prices.length ? minEth(prices) : '0', max: prices.length ? maxEth(prices) : '0' },
        }
        return HttpResponse.json(body)
      },
      { read: true },
    ),
  ),

  http.get(
    api('/nfts/:id'),
    route(
      'catalog',
      ({ params }) => {
        const nft = findNft(String(params.id))
        if (!nft) fail('NOT_FOUND', 'NFT não encontrado.')
        return HttpResponse.json(nft)
      },
      { read: true, transient: true },
    ),
  ),
]

// ───────────────────────────── Favoritos ─────────────────────────────

const favoriteHandlers = [
  http.get(
    api('/favorites'),
    route('default', ({ request }) => {
      const user = requireUser(request)
      return HttpResponse.json({ nftIds: db.favorites[user.id] ?? [] })
    }),
  ),
  http.put(
    api('/favorites/:nftId'),
    route('default', ({ request, params }) => {
      const user = requireUser(request)
      if (getScenario().favoritesFail) fail('INTERNAL_ERROR', 'Não foi possível salvar o favorito.')
      const nftId = String(params.nftId)
      if (!findNft(nftId)) fail('NOT_FOUND', 'NFT não encontrado.')
      const list = db.favorites[user.id] ?? []
      if (!list.includes(nftId)) list.push(nftId)
      db.favorites[user.id] = list
      persist()
      return HttpResponse.json({ nftIds: list })
    }),
  ),
  http.delete(
    api('/favorites/:nftId'),
    route('default', ({ request, params }) => {
      const user = requireUser(request)
      if (getScenario().favoritesFail) fail('INTERNAL_ERROR', 'Não foi possível remover o favorito.')
      const list = (db.favorites[user.id] ?? []).filter((id) => id !== params.nftId)
      db.favorites[user.id] = list
      persist()
      return HttpResponse.json({ nftIds: list })
    }),
  ),
]

// ───────────────────────────── Carrinho ─────────────────────────────

function currentCart(request: Request) {
  const user = optionalUser(request)
  return getCart(cartKeyFor(request, user))
}

function touchCart(cart: ReturnType<typeof getCart>) {
  cart.updatedAt = new Date().toISOString()
  persist()
  return HttpResponse.json(cartView(cart))
}

const cartHandlers = [
  http.get(
    api('/cart'),
    route('default', ({ request }) => HttpResponse.json(cartView(currentCart(request))), { read: true }),
  ),

  http.post(
    api('/cart/items'),
    route('default', async ({ request }) => {
      const cart = currentCart(request)
      const body = await readJson<AddCartItemRequest>(request)
      const existing = cart.lines.find((l) => l.editionId === body.editionId)
      const quantity = (existing?.quantity ?? 0) + Number(body.quantity)
      const { edition } = assertQuantity(body.nftId, body.editionId, quantity)
      if (existing) {
        existing.quantity = quantity
        existing.acknowledgedPriceEth = edition.priceEth
      } else {
        cart.lines.push({
          id: nextId('line'),
          nftId: body.nftId,
          editionId: body.editionId,
          quantity,
          acknowledgedPriceEth: edition.priceEth,
        })
      }
      return touchCart(cart)
    }),
  ),

  http.patch(
    api('/cart/items/:lineId'),
    route('default', async ({ request, params }) => {
      const cart = currentCart(request)
      const line = cart.lines.find((l) => l.id === params.lineId)
      if (!line) fail('NOT_FOUND', 'Item não está no carrinho.')
      const body = await readJson<UpdateCartItemRequest>(request)
      assertQuantity(line!.nftId, line!.editionId, Number(body.quantity))
      line!.quantity = Number(body.quantity)
      return touchCart(cart)
    }),
  ),

  http.delete(
    api('/cart/items/:lineId'),
    route('default', ({ request, params }) => {
      const cart = currentCart(request)
      if (!cart.lines.some((l) => l.id === params.lineId)) fail('NOT_FOUND', 'Item não está no carrinho.')
      cart.lines = cart.lines.filter((l) => l.id !== params.lineId)
      if (!cart.lines.length) cart.couponCode = null
      return touchCart(cart)
    }),
  ),

  http.post(
    api('/cart/acknowledge'),
    route('default', ({ request }) => {
      const cart = currentCart(request)
      for (const line of cart.lines) {
        const edition = findNft(line.nftId)?.editions.find((e) => e.id === line.editionId)
        if (edition) line.acknowledgedPriceEth = edition.priceEth
      }
      return touchCart(cart)
    }),
  ),

  http.put(
    api('/cart/coupon'),
    route('default', async ({ request }) => {
      const cart = currentCart(request)
      const { code } = await readJson<ApplyCouponRequest>(request)
      const trimmed = code?.trim().toUpperCase() ?? ''
      if (!trimmed) fail('VALIDATION_ERROR', 'Informe um cupom.', { code: 'Informe um cupom.' })
      const { issue } = resolveCoupon(trimmed)
      if (issue === 'invalid') fail('COUPON_INVALID', 'Cupom inválido.', { code: 'Cupom inválido.' })
      if (issue === 'expired') fail('COUPON_EXPIRED', 'Este cupom expirou.', { code: 'Este cupom expirou.' })
      cart.couponCode = trimmed
      return touchCart(cart)
    }),
  ),

  http.delete(
    api('/cart/coupon'),
    route('default', ({ request }) => {
      const cart = currentCart(request)
      cart.couponCode = null
      return touchCart(cart)
    }),
  ),

  http.post(
    api('/cart/merge'),
    route('default', async ({ request }) => {
      const user = requireUser(request)
      const { guestCartId } = await readJson<MergeCartRequest>(request)
      if (!guestCartId) fail('VALIDATION_ERROR', 'guestCartId obrigatório.')
      const cart = mergeCarts(`guest:${guestCartId}`, `user:${user.id}`)
      return touchCart(cart)
    }),
  ),
]

// ───────────────────────────── Cotação e pedidos ─────────────────────────────

const NETWORK_IDS = NETWORKS.map((n) => n.id)

const orderHandlers = [
  http.post(
    api('/quotes'),
    route('default', async ({ request }) => {
      const user = requireUser(request)
      const { network } = await readJson<CreateQuoteRequest>(request)
      if (!NETWORK_IDS.includes(network)) fail('VALIDATION_ERROR', 'Rede inválida.', { network: 'Rede inválida.' })
      const cart = getCart(`user:${user.id}`)
      const quote = buildQuote(cart, network)
      db.quotes[quote.id] = { quote, userId: user.id, cartKey: cart.id }
      persist()
      return HttpResponse.json(quote, { status: 201 })
    }),
  ),

  http.post(
    api('/orders'),
    route('default', async ({ request }) => {
      const user = requireUser(request)
      const key = request.headers.get('idempotency-key')
      if (!key || key.length < 8) fail('VALIDATION_ERROR', 'Cabeçalho Idempotency-Key obrigatório.')
      const body = await readJson<CreateOrderRequest>(request)
      const bodyHash = stableStringify(body)

      const previous = db.idempotency[key!]
      if (previous) {
        if (previous.userId !== user.id || previous.bodyHash !== bodyHash) {
          fail('IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.')
        }
        const order = db.orders.find((o) => o.id === previous.orderId)!
        return HttpResponse.json(publicOrder(order), { status: 200, headers: { 'Idempotent-Replayed': 'true' } })
      }

      const buyer = body.buyer ?? ({} as CreateOrderRequest['buyer'])
      const fieldErrors: Record<string, string> = {}
      if ((buyer.fullName ?? '').trim().length < 3) fieldErrors['buyer.fullName'] = 'Informe o nome completo.'
      if (!EMAIL.test(buyer.email ?? '')) fieldErrors['buyer.email'] = 'E-mail inválido.'
      if (!/^\+?[\d\s()-]{10,20}$/.test(buyer.phone ?? '')) fieldErrors['buyer.phone'] = 'Telefone inválido.'
      if (!(buyer.country ?? '').trim()) fieldErrors['buyer.country'] = 'Informe o país.'
      if (!NETWORK_IDS.includes(body.network)) fieldErrors.network = 'Rede inválida.'
      if (Object.keys(fieldErrors).length) fail('VALIDATION_ERROR', 'Verifique os dados do pedido.', fieldErrors)

      const wallet = (db.wallets[user.id] ?? []).find((w) => w.id === body.walletId)
      if (!wallet) fail('VALIDATION_ERROR', 'Carteira não encontrada.', { walletId: 'Selecione uma carteira cadastrada.' })
      if (!wallet!.networks.includes(body.network)) {
        fail('VALIDATION_ERROR', 'A carteira não suporta a rede escolhida.', { network: 'Rede não suportada pela carteira.' })
      }

      const cart = getCart(`user:${user.id}`)
      const stored = db.quotes[body.quoteId]
      const scenario = getScenario()

      // Gatilhos de cenário (uma vez por usuário): mudam o catálogo e emitem nft.updated durante a confirmação.
      const firstLine = stored?.quote.lines[0]
      if (firstLine && scenario.priceChangeOnCheckout && !db.triggered.includes(`price:${user.id}`)) {
        db.triggered.push(`price:${user.id}`)
        const nft = findNft(firstLine.nftId)!
        const edition = nft.editions.find((e) => e.id === firstLine.editionId)!
        edition.priceEth = addEth(edition.priceEth, percentOfEth(edition.priceEth, 15))
        touchNft(nft)
      }
      if (firstLine && scenario.soldOutOnCheckout && !db.triggered.includes(`soldout:${user.id}`)) {
        db.triggered.push(`soldout:${user.id}`)
        const nft = findNft(firstLine.nftId)!
        nft.editions.find((e) => e.id === firstLine.editionId)!.available = 0
        touchNft(nft)
      }

      // Revalidação: preço, disponibilidade, cupom e taxas.
      const fresh = buildQuote(cart, body.network)
      const expired = !stored || Date.parse(stored.quote.expiresAt) <= Date.now()
      if (!stored || stored.userId !== user.id || expired || quotesDiffer(stored.quote, fresh)) {
        db.quotes[fresh.id] = { quote: fresh, userId: user.id, cartKey: cart.id }
        persist()
        fail('QUOTE_STALE', 'Os valores mudaram desde a sua revisão. Confira e confirme novamente.', undefined, {
          quote: fresh,
          previousQuoteId: body.quoteId,
        })
      }
      if (fresh.lines.length === 0) fail('VALIDATION_ERROR', 'Seu carrinho está vazio.')
      if (blockingIssues(fresh).length) {
        fail('AVAILABILITY_CONFLICT', 'Alguns itens não estão mais disponíveis.', undefined, { quote: fresh })
      }

      // Reserva de estoque.
      const reserved = fresh.lines.map((l) => ({ nftId: l.nftId, editionId: l.editionId, quantity: l.quantity }))
      for (const r of reserved) {
        const nft = findNft(r.nftId)!
        nft.editions.find((e) => e.id === r.editionId)!.available -= r.quantity
        touchNft(nft)
      }
      for (const line of cart.lines) {
        const q = fresh.lines.find((l) => l.lineId === line.id)
        if (q) line.acknowledgedPriceEth = q.unitPriceEth
      }

      const now = Date.now()
      const order: OrderRecord = {
        id: `ord-${now.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`.toUpperCase(),
        userId: user.id,
        status: 'pending',
        declineReason: null,
        lines: fresh.lines.map(({ lineId: _lineId, ...l }) => {
          void _lineId
          return l
        }),
        coupon: fresh.coupon,
        network: body.network,
        wallet: { id: wallet!.id, label: wallet!.label, address: wallet!.address },
        buyer,
        subtotalEth: fresh.subtotalEth,
        discountEth: fresh.discountEth,
        networkFeeEth: fresh.networkFeeEth,
        totalEth: fresh.totalEth,
        ...newOrderFields(),
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
        version: 1,
        settlesAt: now + scenario.settleDelayMs,
        reserved,
      }
      db.orders.push(order)
      db.idempotency[key!] = { userId: user.id, bodyHash, orderId: order.id, respondedOnce: false }
      db.buyerDrafts[user.id] = buyer
      persist()

      if (scenario.orderTimeout && !db.triggered.includes(`timeout:${key}`)) {
        db.triggered.push(`timeout:${key}`)
        persist()
        // O pedido já existe; a resposta "se perde" além do timeout do cliente.
        await delay(60_000)
      }
      db.idempotency[key!].respondedOnce = true
      persist()
      return HttpResponse.json(publicOrder(order), { status: 201 })
    }),
  ),

  http.get(
    api('/orders'),
    route('default', ({ request }) => {
      const user = requireUser(request)
      const status = new URL(request.url).searchParams.get('status')
      const orders = db.orders
        .filter((o) => o.userId === user.id && (!status || o.status === status))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(publicOrder)
      return HttpResponse.json(orders)
    }),
  ),

  http.get(
    api('/orders/:id'),
    route('default', ({ request, params }) => {
      const user = requireUser(request)
      const order = db.orders.find((o) => o.id === params.id)
      // Pedido de outro usuário responde 404 para não revelar existência.
      if (!order || order.userId !== user.id) fail('NOT_FOUND', 'Pedido não encontrado.')
      return HttpResponse.json(publicOrder(order!))
    }),
  ),
]

// ───────────────────────────── Perfil ─────────────────────────────

const USERNAME = /^[a-z0-9._]{3,30}$/

const profileHandlers = [
  http.get(
    api('/profile'),
    route('default', ({ request }) => HttpResponse.json(publicUser(requireUser(request)))),
  ),

  http.patch(
    api('/profile'),
    route('default', async ({ request }) => {
      const user = requireUser(request)
      const body = await readJson<UpdateProfileRequest>(request)
      const name = body.name?.trim() ?? ''
      const username = body.username?.trim() ?? ''
      const email = body.email?.trim().toLowerCase() ?? ''
      const bio = body.bio?.trim() ?? ''
      const fieldErrors: Record<string, string> = {}
      if (name.length < 2 || name.length > 60) fieldErrors.name = 'Nome deve ter entre 2 e 60 caracteres.'
      if (!USERNAME.test(username)) fieldErrors.username = 'Use 3–30 caracteres: letras minúsculas, números, "." ou "_".'
      if (!EMAIL.test(email)) fieldErrors.email = 'E-mail inválido.'
      if (bio.length > 280) fieldErrors.bio = 'Máximo de 280 caracteres.'
      if (Object.keys(fieldErrors).length) fail('VALIDATION_ERROR', 'Verifique os campos.', fieldErrors)
      const conflicts: Record<string, string> = {}
      if (db.users.some((u) => u.id !== user.id && u.email === email)) conflicts.email = 'E-mail já em uso por outra conta.'
      if (db.users.some((u) => u.id !== user.id && u.username === username)) conflicts.username = 'Nome de usuário indisponível.'
      if (Object.keys(conflicts).length) fail('CONFLICT', 'Dados já utilizados por outra conta.', conflicts)
      Object.assign(user, { name, username, email, bio })
      persist()
      return HttpResponse.json(publicUser(user))
    }),
  ),

  http.post(
    api('/profile/avatar'),
    route('default', async ({ request }) => {
      const user = requireUser(request)
      const { dataUrl } = await readJson<UpdateAvatarRequest>(request)
      const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? '')
      if (!match) fail('VALIDATION_ERROR', 'Formato não suportado.', { avatar: 'Use PNG, JPEG ou WEBP.' })
      if ((match![2].length * 3) / 4 > 1024 * 1024) fail('VALIDATION_ERROR', 'Imagem muito grande.', { avatar: 'Máximo de 1 MB.' })
      user.avatarUrl = dataUrl
      persist()
      return HttpResponse.json(publicUser(user))
    }),
  ),

  http.post(
    api('/profile/password'),
    route('default', async ({ request }) => {
      const user = requireUser(request)
      const body = await readJson<ChangePasswordRequest>(request)
      const fieldErrors: Record<string, string> = {}
      if (!body.currentPassword) fieldErrors.currentPassword = 'Informe a senha atual.'
      const rule = PASSWORD_RULES(body.newPassword ?? '')
      if (rule) fieldErrors.newPassword = rule
      else if (body.newPassword === body.currentPassword) fieldErrors.newPassword = 'A nova senha deve ser diferente da atual.'
      if (Object.keys(fieldErrors).length) fail('VALIDATION_ERROR', 'Verifique os campos.', fieldErrors)
      if ((await hashPassword(user.salt, body.currentPassword)) !== user.passwordHash) {
        fail('VALIDATION_ERROR', 'Senha atual incorreta.', { currentPassword: 'Senha atual incorreta.' })
      }
      user.salt = crypto.randomUUID()
      user.passwordHash = await hashPassword(user.salt, body.newPassword)
      // Encerra as demais sessões do usuário.
      const current = sessionOf(request)
      db.sessions = db.sessions.filter((s) => s.userId !== user.id || s.token === current?.token)
      persist()
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]

// ───────────────────────────── Carteiras ─────────────────────────────

const ADDRESS = /^0x[a-fA-F0-9]{40}$/

function validateWallet(body: UpsertWalletRequest) {
  const fieldErrors: Record<string, string> = {}
  const label = body.label?.trim() ?? ''
  if (label.length < 2 || label.length > 40) fieldErrors.label = 'Nome deve ter entre 2 e 40 caracteres.'
  if (!WALLET_PROVIDERS.some((p) => p.id === body.provider)) fieldErrors.provider = 'Selecione o provedor.'
  if (!ADDRESS.test(body.address?.trim() ?? '')) fieldErrors.address = 'Endereço inválido (0x + 40 caracteres hexadecimais).'
  if (body.role !== 'primary' && body.role !== 'secondary') fieldErrors.role = 'Tipo inválido.'
  if (!Array.isArray(body.networks) || !body.networks.length || body.networks.some((n) => !NETWORK_IDS.includes(n))) {
    fieldErrors.networks = 'Selecione ao menos uma rede.'
  }
  if (Object.keys(fieldErrors).length) fail('VALIDATION_ERROR', 'Verifique os campos.', fieldErrors)
  return { ...body, label, address: body.address.trim() }
}

const walletHandlers = [
  http.get(
    api('/wallets'),
    route('default', ({ request }) => HttpResponse.json(db.wallets[requireUser(request).id] ?? [])),
  ),

  http.post(
    api('/wallets'),
    route('default', async ({ request }) => {
      const user = requireUser(request)
      const body = validateWallet(await readJson<UpsertWalletRequest>(request))
      const list = db.wallets[user.id] ?? []
      if (list.some((w) => w.role === body.role)) {
        fail('CONFLICT', 'Já existe uma carteira com este papel.', { role: 'Você já possui uma carteira deste tipo.' })
      }
      if (list.some((w) => w.address.toLowerCase() === body.address.toLowerCase())) {
        fail('CONFLICT', 'Endereço já cadastrado.', { address: 'Este endereço já está cadastrado.' })
      }
      const wallet: Wallet = { ...body, id: nextId('wal'), updatedAt: new Date().toISOString() }
      db.wallets[user.id] = [...list, wallet]
      persist()
      return HttpResponse.json(wallet, { status: 201 })
    }),
  ),

  http.patch(
    api('/wallets/:id'),
    route('default', async ({ request, params }) => {
      const user = requireUser(request)
      const list = db.wallets[user.id] ?? []
      const wallet = list.find((w) => w.id === params.id)
      if (!wallet) fail('NOT_FOUND', 'Carteira não encontrada.')
      const body = validateWallet(await readJson<UpsertWalletRequest>(request))
      if (list.some((w) => w.id !== wallet!.id && w.role === body.role)) {
        fail('CONFLICT', 'Já existe uma carteira com este papel.', { role: 'Você já possui uma carteira deste tipo.' })
      }
      if (list.some((w) => w.id !== wallet!.id && w.address.toLowerCase() === body.address.toLowerCase())) {
        fail('CONFLICT', 'Endereço já cadastrado.', { address: 'Este endereço já está cadastrado.' })
      }
      Object.assign(wallet!, body, { updatedAt: new Date().toISOString() })
      persist()
      return HttpResponse.json(wallet)
    }),
  ),

  http.post(
    api('/wallets/:id/connect'),
    route('default', async ({ request, params }) => {
      const user = requireUser(request)
      const wallet = (db.wallets[user.id] ?? []).find((w) => w.id === params.id)
      if (!wallet) fail('NOT_FOUND', 'Carteira não encontrada.')
      const { network } = await readJson<ConnectWalletRequest>(request)
      if (!wallet!.networks.includes(network as NetworkId)) {
        fail('VALIDATION_ERROR', 'Rede não suportada por esta carteira.', { network: 'Rede não suportada por esta carteira.' })
      }
      await delay(500) // aprovação na extensão (simulada)
      if (getScenario().walletRejected) fail('WALLET_REJECTED', 'A conexão foi recusada na carteira.')
      const connection: WalletConnection = {
        walletId: wallet!.id,
        network,
        address: wallet!.address,
        connectedAt: new Date().toISOString(),
      }
      return HttpResponse.json(connection)
    }),
  ),
]

// Rota desconhecida da API: 404 no contrato (evita cair no fallback do SPA).
const fallbackHandlers = [
  http.all(
    api('/*'),
    route('default', () => fail('NOT_FOUND', 'Recurso não encontrado.')),
  ),
]

export const handlers = [
  ...authHandlers,
  ...catalogHandlers,
  ...favoriteHandlers,
  ...cartHandlers,
  ...orderHandlers,
  ...profileHandlers,
  ...walletHandlers,
  ...fallbackHandlers,
]
