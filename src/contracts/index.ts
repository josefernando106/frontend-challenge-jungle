/**
 * Contratos REST e de eventos compartilhados entre cliente (Axios/Query/UI) e camada MSW.
 * Valores em ETH trafegam SEMPRE como strings decimais (ex.: "0.125"); quantidades são inteiros.
 * Documentação detalhada em docs/API.md.
 */

export type EthAmount = string
export type IsoDate = string

// ───────────────────────────── Erros ─────────────────────────────

export type ApiErrorCode =
  | 'VALIDATION_ERROR' // 422
  | 'INVALID_CREDENTIALS' // 401
  | 'UNAUTHENTICATED' // 401 – sem sessão
  | 'SESSION_EXPIRED' // 401 – sessão existia, expirou
  | 'FORBIDDEN' // 403
  | 'WALLET_REJECTED' // 403 – usuário recusou conexão na carteira
  | 'NOT_FOUND' // 404
  | 'CONFLICT' // 409 genérico (cadastro duplicado etc.)
  | 'AVAILABILITY_CONFLICT' // 409 – estoque insuficiente
  | 'QUOTE_STALE' // 409 – cotação divergente da atual
  | 'IDEMPOTENCY_CONFLICT' // 409 – chave reutilizada com outro conteúdo
  | 'COUPON_INVALID' // 422
  | 'COUPON_EXPIRED' // 422
  | 'SERVICE_UNAVAILABLE' // 503 – falha transitória
  | 'INTERNAL_ERROR' // 500

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    /** Erros por campo (chave = nome do campo no payload). */
    fieldErrors?: Record<string, string>
    details?: unknown
  }
}

// ───────────────────────────── Sessão / conta ─────────────────────────────

export interface User {
  id: string
  name: string
  username: string
  email: string
  bio: string
  avatarUrl: string
}

export interface Session {
  token: string
  user: User
  expiresAt: IsoDate
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  name: string
  email: string
  password: string
}

export interface SessionResponse {
  user: User
  expiresAt: IsoDate
}

// ───────────────────────────── Catálogo ─────────────────────────────

export type CategoryId = 'art' | 'collectibles' | 'music' | 'photography' | 'gaming' | 'utility'

export interface Category {
  id: CategoryId
  label: string
}

export interface Collection {
  id: string
  name: string
}

export interface Creator {
  id: string
  name: string
  avatarUrl: string
}

export interface NftEdition {
  id: string
  label: string
  priceEth: EthAmount
  /** Unidades disponíveis para venda nesta edição. 0 = esgotada. */
  available: number
  /** Total emitido. */
  supply: number
  /** Limite por pedido. */
  maxPerOrder: number
}

export interface NftImage {
  url: string
  alt: string
}

export interface NftSummary {
  id: string
  name: string
  creator: Creator
  collection: Collection
  category: CategoryId
  coverImage: NftImage
  /** Menor preço entre as edições disponíveis (ou da primeira edição, se esgotado). */
  fromPriceEth: EthAmount
  available: number
  likes: number
  featured: boolean
  createdAt: IsoDate
  version: number
}

export interface Nft extends Omit<NftSummary, 'coverImage'> {
  description: string
  images: NftImage[]
  editions: NftEdition[]
  tags: string[]
  blockchain: string
}

export type CatalogSort = 'recent' | 'price_asc' | 'price_desc' | 'popular' | 'name'
export type AvailabilityFilter = 'all' | 'available' | 'soldout'

export interface CatalogQuery {
  q?: string
  categories?: CategoryId[]
  collection?: string
  minPrice?: string
  maxPrice?: string
  status?: AvailabilityFilter
  /** Apenas NFTs listados nos últimos N dias (relativo à listagem mais recente do catálogo). */
  listedWithinDays?: number
  sort?: CatalogSort
  page?: number
  pageSize?: number
}

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface CatalogFacets {
  categories: (Category & { count: number })[]
  collections: (Collection & { count: number })[]
  priceRange: { min: EthAmount; max: EthAmount }
}

// ───────────────────────────── Favoritos ─────────────────────────────

export interface FavoritesResponse {
  nftIds: string[]
}

// ───────────────────────────── Carrinho / cotação ─────────────────────────────

export type NetworkId = 'ethereum' | 'polygon' | 'arbitrum'

export interface Network {
  id: NetworkId
  label: string
}

export type CartLineStatus = 'ok' | 'insufficient' | 'unavailable' | 'price_changed'

export interface CartLine {
  id: string
  nftId: string
  editionId: string
  nftName: string
  editionLabel: string
  image: NftImage
  unitPriceEth: EthAmount
  /** Preço visto quando o item foi adicionado/confirmado pelo usuário. */
  acknowledgedPriceEth: EthAmount
  quantity: number
  available: number
  maxPerOrder: number
  lineTotalEth: EthAmount
  status: CartLineStatus
}

export type CouponStatus = 'valid' | 'invalid' | 'expired'

export interface AppliedCoupon {
  code: string
  percentOff: number
  description: string
}

export interface PriceSummary {
  subtotalEth: EthAmount
  discountEth: EthAmount
  networkFeeEth: EthAmount
  totalEth: EthAmount
}

export interface Cart {
  id: string
  lines: CartLine[]
  itemCount: number
  coupon: AppliedCoupon | null
  network: NetworkId
  summary: PriceSummary
  updatedAt: IsoDate
}

export interface AddCartItemRequest {
  nftId: string
  editionId: string
  quantity: number
}

export interface UpdateCartItemRequest {
  quantity: number
}

export interface ApplyCouponRequest {
  code: string
}

export interface MergeCartRequest {
  guestCartId: string
}

export type QuoteIssue =
  | { type: 'price_changed'; lineId: string; nftName: string; previousPriceEth: EthAmount; currentPriceEth: EthAmount }
  | { type: 'unavailable'; lineId: string; nftName: string }
  | { type: 'insufficient'; lineId: string; nftName: string; available: number; requested: number }
  | { type: 'coupon_invalid'; code: string; reason: 'invalid' | 'expired' }

export interface QuoteLine {
  lineId: string
  nftId: string
  editionId: string
  nftName: string
  editionLabel: string
  image: NftImage
  unitPriceEth: EthAmount
  quantity: number
  lineTotalEth: EthAmount
}

export interface Quote extends PriceSummary {
  id: string
  network: NetworkId
  lines: QuoteLine[]
  coupon: AppliedCoupon | null
  issues: QuoteIssue[]
  createdAt: IsoDate
  expiresAt: IsoDate
}

export interface CreateQuoteRequest {
  network: NetworkId
}

// ───────────────────────────── Pedidos ─────────────────────────────

export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export interface BuyerInfo {
  fullName: string
  email: string
  phone: string
  country: string
}

export interface CreateOrderRequest {
  quoteId: string
  walletId: string
  network: NetworkId
  buyer: BuyerInfo
}

export interface OrderLine {
  nftId: string
  editionId: string
  nftName: string
  editionLabel: string
  image: NftImage
  unitPriceEth: EthAmount
  quantity: number
  lineTotalEth: EthAmount
}

export interface Order extends PriceSummary {
  id: string
  userId: string
  status: OrderStatus
  /** Motivo da recusa, quando status = declined. */
  declineReason: string | null
  lines: OrderLine[]
  coupon: AppliedCoupon | null
  network: NetworkId
  wallet: { id: string; label: string; address: string }
  buyer: BuyerInfo
  transactionHash: string
  explorerUrl: string
  createdAt: IsoDate
  updatedAt: IsoDate
  version: number
}

// ───────────────────────────── Perfil ─────────────────────────────

export interface UpdateProfileRequest {
  name: string
  username: string
  email: string
  bio: string
}

export interface UpdateAvatarRequest {
  /** data URL (image/png | image/jpeg | image/webp), máx. 1 MB. */
  dataUrl: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

// ───────────────────────────── Carteiras ─────────────────────────────

export type WalletProvider = 'metamask' | 'coinbase' | 'walletconnect'
export type WalletRole = 'primary' | 'secondary'

export interface Wallet {
  id: string
  label: string
  provider: WalletProvider
  address: string
  role: WalletRole
  networks: NetworkId[]
  updatedAt: IsoDate
}

export interface UpsertWalletRequest {
  label: string
  provider: WalletProvider
  address: string
  role: WalletRole
  networks: NetworkId[]
}

export interface ConnectWalletRequest {
  network: NetworkId
}

export interface WalletConnection {
  walletId: string
  network: NetworkId
  address: string
  connectedAt: IsoDate
}

// ───────────────────────────── Eventos (Socket.IO) ─────────────────────────────

export interface RealtimeEnvelope<TType extends string, TResource extends string, TData> {
  /** Identidade estável do evento (deduplicação). */
  eventId: string
  type: TType
  resource: { type: TResource; id: string }
  /** Versão do recurso após a mudança (monotônica por recurso). */
  version: number
  occurredAt: IsoDate
  /** Dono do recurso, quando privado (pedidos). */
  userId?: string
  data: TData
}

export interface NftUpdatedData {
  nftId: string
  name: string
  editions: Pick<NftEdition, 'id' | 'label' | 'priceEth' | 'available'>[]
  fromPriceEth: EthAmount
  available: number
}

export interface OrderUpdatedData {
  order: Order
}

export type NftUpdatedEvent = RealtimeEnvelope<'nft.updated', 'nft', NftUpdatedData>
export type OrderUpdatedEvent = RealtimeEnvelope<'order.updated', 'order', OrderUpdatedData>
export type RealtimeEvent = NftUpdatedEvent | OrderUpdatedEvent

export interface ServerToClientEvents {
  'nft.updated': (event: NftUpdatedEvent) => void
  'order.updated': (event: OrderUpdatedEvent) => void
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ClientToServerEvents {}

// ───────────────────────────── Constantes compartilhadas ─────────────────────────────

export const CATEGORIES: Category[] = [
  { id: 'art', label: 'Arte' },
  { id: 'collectibles', label: 'Colecionáveis' },
  { id: 'music', label: 'Música' },
  { id: 'photography', label: 'Fotografia' },
  { id: 'gaming', label: 'Games' },
  { id: 'utility', label: 'Utilidade' },
]

export const NETWORKS: Network[] = [
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'arbitrum', label: 'Arbitrum One' },
]

export const WALLET_PROVIDERS: { id: WalletProvider; label: string }[] = [
  { id: 'metamask', label: 'MetaMask' },
  { id: 'coinbase', label: 'Coinbase Wallet' },
  { id: 'walletconnect', label: 'WalletConnect' },
]

export const CATALOG_PAGE_SIZE = 12

/** Janela da aba "Novos lançamentos" do catálogo. */
export const NEW_RELEASES_DAYS = 7
