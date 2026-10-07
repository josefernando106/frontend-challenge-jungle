import type { AvailabilityFilter, CatalogQuery, CatalogSort, CategoryId } from '@/contracts'
import { CATALOG_PAGE_SIZE, CATEGORIES, NEW_RELEASES_DAYS } from '@/contracts'
import { isEthAmount } from '@/lib/eth'

/**
 * Serialização "plana" dos search params (sem JSON): ?q=lua&cat=art,music&sort=price_asc&page=2.
 * URLs legíveis, compartilháveis e estáveis entre refresh/histórico.
 */
export function parseSearch(searchStr: string): Record<string, string> {
  const params = new URLSearchParams(searchStr.startsWith('?') ? searchStr.slice(1) : searchStr)
  const result: Record<string, string> = {}
  params.forEach((value, key) => {
    result[key] = value
  })
  return result
}

export function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, Array.isArray(value) ? value.join(',') : String(value))
  }
  const str = params.toString()
  return str ? `?${str}` : ''
}

// ───────────── Início (catálogo) ─────────────

export interface HomeSearch {
  q?: string
  cat?: string
  col?: string
  min?: string
  max?: string
  status?: AvailabilityFilter
  /** Aba do catálogo: 'new' = novos lançamentos ("Em alta" é a ordenação por popularidade). */
  tab?: 'new'
  sort?: CatalogSort
  page?: number
}

const SORTS: CatalogSort[] = ['recent', 'price_asc', 'price_desc', 'popular', 'name']
const STATUSES: AvailabilityFilter[] = ['all', 'available', 'soldout']

const str = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '')

export function validateHomeSearch(raw: Record<string, unknown>): HomeSearch {
  const q = str(raw.q).slice(0, 80)
  const cats = str(raw.cat)
    .split(',')
    .filter((c): c is CategoryId => CATEGORIES.some((k) => k.id === c))
  const min = str(raw.min)
  const max = str(raw.max)
  const status = str(raw.status) as AvailabilityFilter
  const sort = str(raw.sort) as CatalogSort
  const page = Number.parseInt(str(raw.page), 10)
  return {
    q: q || undefined,
    cat: cats.length ? [...new Set(cats)].join(',') : undefined,
    col: str(raw.col) || undefined,
    min: min && isEthAmount(min) ? min : undefined,
    max: max && isEthAmount(max) ? max : undefined,
    status: STATUSES.includes(status) && status !== 'all' ? status : undefined,
    tab: raw.tab === 'new' ? 'new' : undefined,
    sort: SORTS.includes(sort) && sort !== 'recent' ? sort : undefined,
    page: Number.isFinite(page) && page > 1 ? page : undefined,
  }
}

export function toCatalogQuery(search: HomeSearch): CatalogQuery {
  return {
    q: search.q,
    categories: search.cat ? (search.cat.split(',') as CategoryId[]) : undefined,
    collection: search.col,
    minPrice: search.min,
    maxPrice: search.max,
    status: search.status ?? 'all',
    listedWithinDays: search.tab === 'new' ? NEW_RELEASES_DAYS : undefined,
    sort: search.sort ?? 'recent',
    page: search.page ?? 1,
    pageSize: CATALOG_PAGE_SIZE,
  }
}

// ───────────── Outras rotas ─────────────

/** Aceita apenas caminhos internos para evitar open redirect. */
export function safeRedirect(value: unknown): string | undefined {
  const s = str(value)
  return s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/entrar') && !s.startsWith('/cadastro') ? s : undefined
}

export interface AuthSearch {
  redirect?: string
  reason?: 'expired'
}

export function validateAuthSearch(raw: Record<string, unknown>): AuthSearch {
  return {
    redirect: safeRedirect(raw.redirect),
    reason: raw.reason === 'expired' ? 'expired' : undefined,
  }
}

export interface NftSearch {
  edition?: string
}

export function validateNftSearch(raw: Record<string, unknown>): NftSearch {
  const edition = str(raw.edition)
  return { edition: edition || undefined }
}
