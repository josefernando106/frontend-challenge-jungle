import type {
  AddCartItemRequest,
  Cart,
  CatalogFacets,
  CatalogQuery,
  ChangePasswordRequest,
  CreateOrderRequest,
  CreateQuoteRequest,
  FavoritesResponse,
  LoginRequest,
  NetworkId,
  Nft,
  NftSummary,
  Order,
  OrderStatus,
  Paginated,
  Quote,
  RegisterRequest,
  Session,
  SessionResponse,
  UpdateProfileRequest,
  UpsertWalletRequest,
  User,
  Wallet,
  WalletConnection,
} from '@/contracts'
import { CATALOG_PAGE_SIZE } from '@/contracts'
import { del, get, patch, post, put } from './http'

type Signal = AbortSignal | undefined

/** Serializa os filtros do catálogo exatamente como enviados à API (categorias repetidas). */
export function catalogSearchParams(query: CatalogQuery) {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  query.categories?.forEach((c) => params.append('category', c))
  if (query.collection) params.set('collection', query.collection)
  if (query.minPrice) params.set('minPrice', query.minPrice)
  if (query.maxPrice) params.set('maxPrice', query.maxPrice)
  if (query.status && query.status !== 'all') params.set('status', query.status)
  if (query.listedWithinDays) params.set('listedWithinDays', String(query.listedWithinDays))
  params.set('sort', query.sort ?? 'recent')
  params.set('page', String(query.page ?? 1))
  params.set('pageSize', String(query.pageSize ?? CATALOG_PAGE_SIZE))
  return params
}

export const api = {
  auth: {
    login: (body: LoginRequest) => post<Session>('/auth/login', body),
    register: (body: RegisterRequest) => post<Session>('/auth/register', body),
    session: (signal?: Signal) => get<SessionResponse>('/auth/session', { signal }),
    logout: (token: string) => post<void>('/auth/logout', undefined, { headers: { Authorization: `Bearer ${token}` } }),
  },
  catalog: {
    list: (query: CatalogQuery, signal?: Signal) =>
      get<Paginated<NftSummary>>('/nfts', { params: catalogSearchParams(query), signal }),
    highlights: (signal?: Signal) => get<NftSummary[]>('/nfts/highlights', { signal }),
    facets: (signal?: Signal) => get<CatalogFacets>('/catalog/facets', { signal }),
    detail: (id: string, signal?: Signal) => get<Nft>(`/nfts/${encodeURIComponent(id)}`, { signal }),
  },
  favorites: {
    list: (signal?: Signal) => get<FavoritesResponse>('/favorites', { signal }),
    add: (nftId: string) => put<FavoritesResponse>(`/favorites/${encodeURIComponent(nftId)}`),
    remove: (nftId: string) => del<FavoritesResponse>(`/favorites/${encodeURIComponent(nftId)}`),
  },
  cart: {
    get: (signal?: Signal) => get<Cart>('/cart', { signal }),
    addItem: (body: AddCartItemRequest) => post<Cart>('/cart/items', body),
    updateItem: (lineId: string, quantity: number) => patch<Cart>(`/cart/items/${lineId}`, { quantity }),
    removeItem: (lineId: string) => del<Cart>(`/cart/items/${lineId}`),
    applyCoupon: (code: string) => put<Cart>('/cart/coupon', { code }),
    removeCoupon: () => del<Cart>('/cart/coupon'),
    acknowledge: () => post<Cart>('/cart/acknowledge'),
    merge: (guestCartId: string) => post<Cart>('/cart/merge', { guestCartId }),
  },
  checkout: {
    quote: (body: CreateQuoteRequest) => post<Quote>('/quotes', body),
    createOrder: (body: CreateOrderRequest, idempotencyKey: string) =>
      post<Order>('/orders', body, { headers: { 'Idempotency-Key': idempotencyKey } }),
  },
  orders: {
    get: (id: string, signal?: Signal) => get<Order>(`/orders/${encodeURIComponent(id)}`, { signal }),
    list: (status?: OrderStatus, signal?: Signal) => get<Order[]>('/orders', { params: { status }, signal }),
  },
  profile: {
    get: (signal?: Signal) => get<User>('/profile', { signal }),
    update: (body: UpdateProfileRequest) => patch<User>('/profile', body),
    updateAvatar: (dataUrl: string) => post<User>('/profile/avatar', { dataUrl }),
    changePassword: (body: ChangePasswordRequest) => post<void>('/profile/password', body),
  },
  wallets: {
    list: (signal?: Signal) => get<Wallet[]>('/wallets', { signal }),
    create: (body: UpsertWalletRequest) => post<Wallet>('/wallets', body),
    update: (id: string, body: UpsertWalletRequest) => patch<Wallet>(`/wallets/${id}`, body),
    connect: (id: string, network: NetworkId) => post<WalletConnection>(`/wallets/${id}/connect`, { network }),
  },
}
