import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Loader2, Search, SlidersHorizontal } from 'lucide-react'
import type { CatalogSort } from '@/contracts'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { NativeSelect } from '@/components/NativeSelect'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { NftCard, NftCardSkeleton } from '@/components/NftCard'
import { Pagination } from '@/components/Pagination'
import { EmptyState, ErrorState } from '@/components/states'
import { CATALOG_PAGE_SIZE } from '@/contracts'
import { cn } from '@/lib/utils'
import { artworkSrcSet } from '@/lib/image'
import { useIsMobile } from '@/lib/use-is-mobile'
import { toCatalogQuery, type HomeSearch } from '@/routes/search'
import { useCatalog, useHighlights } from '../hooks'
import { CatalogFilters } from './CatalogFilters'

const SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
  { value: 'recent', label: 'Listados recentemente' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
  { value: 'popular', label: 'Mais populares' },
  { value: 'name', label: 'Nome (A–Z)' },
]

type Tab = 'all' | 'new' | 'trending'

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'Todos os NFTs' },
  { id: 'new', label: 'Novos lançamentos' },
  { id: 'trending', label: 'Em alta' },
]

/** "Em alta" = ordenação por popularidade; "Novos lançamentos" = filtro por data de listagem. */
const activeTab = (search: HomeSearch): Tab =>
  search.sort === 'popular' ? 'trending' : search.tab === 'new' ? 'new' : 'all'

function tabPatch(tab: Tab, search: HomeSearch): Partial<HomeSearch> {
  const keepSort = search.sort === 'popular' ? undefined : search.sort
  if (tab === 'trending') return { sort: 'popular', tab: undefined }
  if (tab === 'new') return { tab: 'new', sort: keepSort }
  return { tab: undefined, sort: keepSort }
}

function SearchBox({
  value,
  onCommit,
  mobile,
}: {
  value: string
  onCommit: (q: string) => void
  /** Variante da barra de topo mobile ("Explorar coleções", ícone à esquerda). */
  mobile?: boolean
}) {
  const [text, setText] = useState(value)
  // URL → campo (histórico/refresh): ajuste durante o render, sem efeito em cascata.
  const [synced, setSynced] = useState(value)
  if (value !== synced) {
    setSynced(value)
    setText(value)
  }
  const committed = useRef(value)
  const commitRef = useRef(onCommit)
  useEffect(() => {
    commitRef.current = onCommit
    committed.current = synced
  })

  // Campo → URL com debounce.
  useEffect(() => {
    if (text.trim() === synced) return
    const t = window.setTimeout(() => {
      // Já confirmado via Enter (ou a URL mudou): não navega de novo.
      if (text.trim() === committed.current) return
      committed.current = text.trim()
      commitRef.current(text.trim())
    }, 350)
    return () => window.clearTimeout(t)
  }, [text, synced])

  return (
    <form
      role="search"
      className="relative flex-1"
      onSubmit={(e) => {
        e.preventDefault()
        committed.current = text.trim()
        onCommit(text.trim())
      }}
    >
      <label htmlFor="catalog-search" className="sr-only">
        Buscar NFTs por nome, artista ou coleção
      </label>
      <Input
        id="catalog-search"
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={mobile ? 'Explorar coleções' : 'Buscar por nome, artista ou coleção'}
        className={cn('h-10 text-xs', mobile ? 'border-transparent bg-surface pl-9' : 'pr-10')}
        autoComplete="off"
      />
      <Search
        className={cn(
          'pointer-events-none absolute top-1/2 size-4 -translate-y-1/2',
          mobile ? 'left-3 text-primary' : 'right-3 text-muted-foreground',
        )}
        aria-hidden="true"
      />
    </form>
  )
}

/** Card "NFT em destaque" abaixo dos filtros (segundo destaque da API). */
function FeaturedOffer() {
  const { data, isPending } = useHighlights()
  const nft = data?.[1] ?? data?.[0]
  if (isPending) return <Skeleton className="aspect-[3/4] w-full rounded-md" />
  if (!nft) return null
  return (
    <article className="relative flex flex-col gap-3 overflow-hidden rounded-md bg-surface p-3 focus-within:ring-2 focus-within:ring-ring">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">NFT em destaque</p>
        <h3 className="text-sm font-medium uppercase">
          <Link
            to="/nft/$nftId"
            params={{ nftId: nft.id }}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            Oferta limitada<span className="sr-only">: {nft.name}</span>
          </Link>
        </h3>
      </div>
      <img
        src={nft.coverImage.url}
        srcSet={artworkSrcSet(nft.coverImage.url)}
        sizes="220px"
        alt={nft.coverImage.alt}
        width={220}
        height={220}
        loading="lazy"
        decoding="async"
        className="aspect-square w-full rounded-sm object-cover"
      />
    </article>
  )
}

const activeCount = (search: HomeSearch) =>
  [search.cat?.split(',').length ?? 0, search.col, search.min || search.max, search.status].filter(Boolean).length

/** Atualiza a URL do catálogo; qualquer mudança de filtro/busca/ordenação volta para a página 1. */
function useCatalogUpdate() {
  const navigate = useNavigate({ from: '/' })
  return (patch: Partial<HomeSearch>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch, page: undefined }), resetScroll: false })
}

function FiltersSheet({
  search,
  onChange,
  className,
  children,
}: {
  search: HomeSearch
  onChange: (patch: Partial<HomeSearch>) => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          {children}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[88vw] max-w-sm overflow-y-auto bg-background p-6">
        <SheetHeader className="p-0 pb-4">
          <SheetTitle className="text-lg">Filtros</SheetTitle>
          <SheetDescription>Os resultados são atualizados automaticamente.</SheetDescription>
        </SheetHeader>
        <CatalogFilters search={search} onChange={onChange} idPrefix="mobile" />
      </SheetContent>
    </Sheet>
  )
}

/** Topo da página inicial no mobile: busca ("Explorar coleções") e botão de filtros. */
export function MobileCatalogBar({ search }: { search: HomeSearch }) {
  const update = useCatalogUpdate()
  const count = activeCount(search)
  return (
    <div className="container-page flex gap-2 pt-4">
      <SearchBox mobile value={search.q ?? ''} onCommit={(q) => update({ q: q || undefined })} />
      <FiltersSheet
        search={search}
        onChange={update}
        className="relative size-10 border-0 bg-primary px-0 text-primary-foreground hover:bg-primary-hover"
      >
        <SlidersHorizontal aria-hidden="true" />
        <span className="sr-only">Filtros{count > 0 && ` (${count})`}</span>
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background"
          >
            {count}
          </span>
        )}
      </FiltersSheet>
    </div>
  )
}

export function CatalogSection({ search }: { search: HomeSearch }) {
  const navigate = useNavigate({ from: '/' })
  const isMobile = useIsMobile()
  const query = toCatalogQuery(search)
  const { data, isPending, isError, error, refetch, isFetching, isPlaceholderData, isRefetching } = useCatalog(query)
  const sectionRef = useRef<HTMLElement>(null)

  const update = useCatalogUpdate()

  const goToPage = (page: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: page > 1 ? page : undefined }), resetScroll: false })
    sectionRef.current?.scrollIntoView({ block: 'start' })
  }

  const updating = isFetching && !isPending
  const tab = activeTab(search)
  const clearAll = () =>
    update({ q: undefined, cat: undefined, col: undefined, min: undefined, max: undefined, status: undefined, tab: undefined })

  return (
    <section ref={sectionRef} id="catalogo" aria-labelledby="catalog-title" className="container-page scroll-mt-20 py-4 md:py-12">
      <h2 id="catalog-title" className="sr-only">
        Explorar NFTs
      </h2>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr] lg:gap-6">
        <aside aria-label="Filtros do catálogo" className="hidden flex-col gap-6 lg:flex">
          <div className="rounded-md bg-surface p-4">
            <CatalogFilters search={search} onChange={update} idPrefix="desktop" />
          </div>
          <FeaturedOffer />
        </aside>

        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <nav aria-label="Visualizações do catálogo" className="-mx-1 overflow-x-auto">
              <ul className="flex gap-5 px-1 whitespace-nowrap">
                {TABS.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => update(tabPatch(t.id, search))}
                      aria-pressed={tab === t.id}
                      className={cn(
                        'border-b-2 py-1 text-xs font-medium transition-colors hover:text-primary md:text-sm',
                        tab === t.id ? 'border-primary text-primary' : 'border-transparent',
                      )}
                    >
                      {t.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="flex items-center gap-2 text-xs">
              <label htmlFor="catalog-sort" className="shrink-0">
                Ordenar por:
              </label>
              <NativeSelect
                id="catalog-sort"
                className="h-9 flex-1 md:w-52 md:flex-none"
                selectClassName="border-transparent bg-transparent px-1 pr-8 text-xs hover:bg-surface"
                value={search.sort ?? 'recent'}
                onChange={(e) => update({ sort: e.target.value === 'recent' ? undefined : (e.target.value as CatalogSort) })}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          {!isMobile && (
            <div className="flex gap-3">
              <SearchBox value={search.q ?? ''} onCommit={(q) => update({ q: q || undefined })} />
              <FiltersSheet search={search} onChange={update} className="h-10 lg:hidden">
                <SlidersHorizontal aria-hidden="true" />
                Filtros{activeCount(search) > 0 && <span>({activeCount(search)})</span>}
              </FiltersSheet>
            </div>
          )}

          <div className="flex min-h-5 items-center justify-between gap-3 text-xs text-muted-foreground" aria-live="polite">
            {data && !isError && (
              <p data-testid="catalog-count">
                {data.total} {data.total === 1 ? 'resultado' : 'resultados'}
                {data.totalPages > 1 && ` · página ${data.page} de ${data.totalPages}`}
              </p>
            )}
            {updating && (
              <p className="flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Atualizando…
              </p>
            )}
          </div>

          {isError && !data ? (
            <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} title="Não foi possível carregar o catálogo" />
          ) : isPending ? (
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5" aria-busy="true" aria-label="Carregando NFTs">
              {Array.from({ length: CATALOG_PAGE_SIZE / 2 }, (_, i) => (
                <li key={i}>
                  <NftCardSkeleton />
                </li>
              ))}
            </ul>
          ) : data.items.length === 0 ? (
            <EmptyState
              title="Nenhum NFT encontrado"
              description={data.total === 0 ? 'Tente outros termos ou remova alguns filtros.' : 'Esta página não tem resultados.'}
              action={
                <Button size="sm" variant="outline" onClick={clearAll}>
                  Limpar busca e filtros
                </Button>
              }
            />
          ) : (
            <>
              {isError && (
                <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} title="Falha ao atualizar" />
              )}
              <ul
                className="grid grid-cols-2 gap-x-3 gap-y-8 pb-6 transition-opacity md:grid-cols-3 md:gap-5 md:pb-0 data-[stale=true]:opacity-60 max-md:[&>li:nth-child(even)]:translate-y-6"
                data-stale={isPlaceholderData}
                aria-busy={updating}
                data-testid="catalog-grid"
              >
                {data.items.map((nft) => (
                  <li key={nft.id}>
                    <NftCard nft={nft} />
                  </li>
                ))}
              </ul>
              <Pagination page={data.page} totalPages={data.totalPages} onChange={goToPage} />
            </>
          )}
        </div>
      </div>
    </section>
  )
}
