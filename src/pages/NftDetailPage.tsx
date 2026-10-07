import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { Heart, Link2, Loader2, Mail, ShoppingCart, ZoomIn } from 'lucide-react'
import { toast } from 'sonner'
import type { Nft, NftEdition } from '@/contracts'
import { CATEGORIES } from '@/contracts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { QuantityStepper } from '@/components/QuantityStepper'
import { NftCard, NftCardSkeleton } from '@/components/NftCard'
import { EmptyState, ErrorState } from '@/components/states'
import { errorMessage } from '@/lib/errors'
import { artworkSrcSet } from '@/lib/image'
import { useIsMobile } from '@/lib/use-is-mobile'
import { useCatalog, useNft } from '@/features/catalog/hooks'
import { useAddToCart, useCart } from '@/features/cart/hooks'
import { useFavorites, useToggleFavorite } from '@/features/favorites/hooks'
import { useSession } from '@/features/auth/session-store'
import { isApiError } from '@/api/http'
import { formatEth, mulEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

const route = getRouteApi('/nft/$nftId')

/** "nft-042" → "#0042" (identificador exibido como ID do token). */
const tokenId = (id: string) => `#${(id.split('-').pop() ?? id).padStart(4, '0')}`

/** "Edição Aberta" → "Aberta"; demais edições mostram a tiragem (ex.: 1/25), como no layout. */
const editionChip = (e: NftEdition) => (/aberta/i.test(e.label) ? 'Aberta' : `1/${e.supply}`)

function Breadcrumb() {
  return (
    <nav aria-label="Trilha de navegação" className="mb-4 text-xs max-md:hidden">
      <ol className="flex items-center gap-1.5">
        <li>
          <Link to="/" className="rounded-sm hover:text-primary">
            Início
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link to="/" hash="catalogo" className="rounded-sm hover:text-primary">
            Mercado
          </Link>
        </li>
      </ol>
    </nav>
  )
}

function Gallery({ nft }: { nft: Nft }) {
  const [index, setIndex] = useState(0)
  const isMobile = useIsMobile()
  const image = nft.images[index] ?? nft.images[0]
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setIndex((i) => (i + 1) % nft.images.length)
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setIndex((i) => (i - 1 + nft.images.length) % nft.images.length)
  }
  if (isMobile) {
    // Frame mobile: cartão com a imagem, favorito no canto e indicadores no lugar das miniaturas.
    return (
      <section aria-label="Galeria de imagens" className="flex flex-col gap-2">
        <div className="relative overflow-hidden rounded-2xl bg-surface p-3">
          <img
            src={image.url}
            srcSet={artworkSrcSet(image.url)}
            sizes="100vw"
            alt={image.alt}
            width={360}
            height={360}
            fetchPriority="high"
            className="aspect-square w-full rounded-xl object-cover"
            data-testid="gallery-main"
          />
          <FavoriteButton nft={nft} variant="icon" className="absolute top-5 right-5" />
        </div>
        <div role="group" aria-label="Imagens" className="flex justify-center gap-1" onKeyDown={onKeyDown}>
          {nft.images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setIndex(i)}
              aria-pressed={i === index}
              aria-label={`Ver imagem ${i + 1} de ${nft.images.length}`}
              className="flex size-6 items-center justify-center rounded-full"
            >
              <span aria-hidden="true" className={cn('size-1.5 rounded-full', i === index ? 'bg-primary' : 'bg-primary/40')} />
            </button>
          ))}
        </div>
      </section>
    )
  }
  return (
    <section aria-label="Galeria de imagens" className="grid gap-3 lg:grid-cols-[64px_1fr] lg:gap-4">
      <div
        role="group"
        aria-label="Miniaturas"
        className="order-2 grid grid-cols-3 gap-3 lg:order-1 lg:flex lg:flex-col"
        onKeyDown={onKeyDown}
      >
        {nft.images.map((img, i) => (
          <button
            key={img.url}
            type="button"
            onClick={() => setIndex(i)}
            aria-pressed={i === index}
            aria-label={`Ver imagem ${i + 1} de ${nft.images.length}`}
            className={cn(
              'aspect-square overflow-hidden rounded-sm border-2 transition-colors lg:size-16',
              i === index ? 'border-primary' : 'border-transparent hover:border-input',
            )}
          >
            <img
              src={img.url.replace(/-960\.webp$/, '-480.webp')}
              alt=""
              width={64}
              height={64}
              loading="lazy"
              className="size-full object-cover"
            />
          </button>
        ))}
      </div>
      <div className="relative order-1 aspect-square overflow-hidden rounded-md bg-card lg:order-2">
        <img
          src={image.url}
          srcSet={artworkSrcSet(image.url)}
          sizes="(min-width: 1024px) 480px, 100vw"
          alt={image.alt}
          width={480}
          height={480}
          fetchPriority="high"
          className="size-full object-cover"
          data-testid="gallery-main"
        />
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary" size="icon-sm" className="absolute top-2 right-2 bg-background/70 hover:bg-background">
              <ZoomIn aria-hidden="true" />
              <span className="sr-only">Ampliar imagem</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[min(90vw,90dvh)] border-border bg-surface p-3 sm:max-w-[min(90vw,90dvh)]">
            <DialogTitle className="sr-only">{nft.name}</DialogTitle>
            <DialogDescription className="sr-only">{image.alt}</DialogDescription>
            <img src={image.url} alt={image.alt} width={960} height={960} className="w-full rounded-sm" />
          </DialogContent>
        </Dialog>
      </div>
    </section>
  )
}

function EditionPicker({
  editions,
  value,
  onChange,
}: {
  editions: NftEdition[]
  value: string
  onChange: (id: string) => void
}) {
  const name = useId()
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-xs font-bold">Edição:</legend>
      <div className="flex flex-wrap gap-2">
        {editions.map((e) => {
          const soldOut = e.available === 0
          const id = `${name}-${e.id}`
          return (
            <label
              key={e.id}
              htmlFor={id}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs uppercase transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring',
                e.id === value ? 'border-primary text-primary' : 'border-input hover:border-primary',
                soldOut && 'cursor-not-allowed opacity-60 hover:border-input',
              )}
            >
              <input
                type="radio"
                id={id}
                name={name}
                value={e.id}
                checked={e.id === value}
                disabled={soldOut}
                onChange={() => onChange(e.id)}
                className="sr-only"
              />
              <span className="sr-only">
                {e.label}, {formatEth(e.priceEth)},{' '}
              </span>
              <span className={cn(soldOut && 'line-through')}>{editionChip(e)}</span>
              {soldOut && <span className="text-[10px] font-bold text-destructive normal-case">Esgotada</span>}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function FavoriteButton({ nft, variant = 'button', className }: { nft: Nft; variant?: 'button' | 'icon'; className?: string }) {
  const session = useSession()
  const navigate = useNavigate()
  const { data: favorites } = useFavorites()
  const toggle = useToggleFavorite()
  const isFavorite = favorites?.has(nft.id) ?? false
  const label = isFavorite ? 'Favoritado' : 'Favoritar'
  return (
    <Button
      variant={variant === 'icon' ? 'secondary' : 'outline'}
      size={variant === 'icon' ? 'icon-sm' : 'xs'}
      className={cn(
        variant === 'icon' ? 'size-8 rounded-full bg-background/70 text-primary hover:bg-background' : 'h-9 px-3',
        className,
      )}
      aria-pressed={isFavorite}
      data-testid="favorite-toggle"
      onClick={() => {
        if (session.status !== 'authenticated') {
          toast.info('Entre para salvar favoritos.')
          void navigate({ to: '/entrar', search: { redirect: `/nft/${nft.id}` } })
          return
        }
        toggle.mutate({ nftId: nft.id, favorite: !isFavorite, name: nft.name })
      }}
    >
      <Heart className={cn(isFavorite && 'fill-primary text-primary')} aria-hidden="true" />
      {variant === 'icon' ? <span className="sr-only">{label}</span> : label}
    </Button>
  )
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true" fill="currentColor">
      <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />
    </svg>
  )
}

function ShareLinks({ nft }: { nft: Nft }) {
  const url = typeof window === 'undefined' ? '' : window.location.href
  const text = `Veja "${nft.name}" na Kurio`
  const iconLink = 'flex size-7 items-center justify-center rounded-sm hover:bg-accent hover:text-primary'
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiado.')
    } catch {
      toast.error('Não foi possível copiar o link.')
    }
  }
  return (
    <div className="flex items-center gap-1 text-xs font-bold">
      <span className="mr-1">Compartilhar este NFT:</span>
      <button type="button" onClick={() => void copy()} className={iconLink}>
        <Link2 className="size-3.5" aria-hidden="true" />
        <span className="sr-only">Copiar link</span>
      </button>
      <a href={`mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`} className={iconLink}>
        <Mail className="size-3.5" aria-hidden="true" />
        <span className="sr-only">Compartilhar por e-mail</span>
      </a>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={iconLink}
      >
        <XIcon />
        <span className="sr-only">Compartilhar no X (abre em nova aba)</span>
      </a>
    </div>
  )
}

/** Título, preço, edição, quantidade e compra (coluna direita do layout). */
function DetailInfo({ nft, editionId }: { nft: Nft; editionId?: string }) {
  const navigate = useNavigate({ from: '/nft/$nftId' })
  const firstAvailable = nft.editions.find((e) => e.available > 0) ?? nft.editions[0]
  const edition = nft.editions.find((e) => e.id === editionId) ?? firstAvailable
  const { data: cart } = useCart()
  const add = useAddToCart()
  const [requestedQuantity, setQuantity] = useState(1)
  const [feedback, setFeedback] = useState<string | null>(null)
  const isMobile = useIsMobile()

  const inCart = cart?.lines.find((l) => l.editionId === edition.id)?.quantity ?? 0
  const limit = Math.max(0, Math.min(edition.available, edition.maxPerOrder) - inCart)
  const soldOut = edition.available === 0
  // O limite pode cair por evento em tempo real ou ao trocar a edição.
  const quantity = Math.max(1, Math.min(requestedQuantity, limit || 1))

  // Anuncia mudanças de preço recebidas enquanto a página está aberta (mesma edição).
  const [seenPrice, setSeenPrice] = useState({ id: edition.id, price: edition.priceEth })
  const [liveMessage, setLiveMessage] = useState('')
  if (seenPrice.id !== edition.id || seenPrice.price !== edition.priceEth) {
    if (seenPrice.id === edition.id) setLiveMessage(`Preço atualizado para ${formatEth(edition.priceEth)}.`)
    setSeenPrice({ id: edition.id, price: edition.priceEth })
  }

  /** "Comprar NFT" (mobile) adiciona e segue para o carrinho; o botão de carrinho só adiciona. */
  const onAdd = (goToCart = false) => {
    setFeedback(null)
    add.mutate(
      { nftId: nft.id, editionId: edition.id, quantity },
      {
        onSuccess: () => {
          toast.success('Adicionado ao carrinho', {
            description: `${quantity}× ${nft.name} (${edition.label})`,
            action: { label: 'Ver carrinho', onClick: () => void navigate({ to: '/carrinho' }) },
          })
          if (goToCart) void navigate({ to: '/carrinho' })
        },
        onError: (error) => setFeedback(isApiError(error) ? error.message : errorMessage(error)),
      },
    )
  }

  const price = (
    <p className="text-xl font-bold text-primary max-md:text-base" data-testid="detail-price">
      {formatEth(edition.priceEth)}
    </p>
  )
  const stepper = !soldOut && (
    <QuantityStepper
      value={quantity}
      max={Math.max(1, limit)}
      onChange={setQuantity}
      disabled={limit === 0 || add.isPending}
      label="Quantidade"
    />
  )
  const blocked = soldOut || limit === 0 || add.isPending

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl leading-tight font-medium max-md:text-lg md:text-[28px]">{nft.name}</h1>
          {isMobile && (
            <span className="mt-0.5 flex shrink-0 items-center gap-1 rounded-full border border-primary px-2 py-0.5 text-[11px] text-primary">
              <Heart className="size-3 fill-primary" aria-hidden="true" />
              {nft.likes}
              <span className="sr-only"> colecionadores curtiram</span>
            </span>
          )}
        </div>
        {!isMobile && (
          <>
            {price}
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Heart className="size-3.5 fill-primary text-primary" aria-hidden="true" />
              {nft.likes} colecionadores curtiram
            </p>
          </>
        )}
      </header>

      <div className="flex flex-col gap-1.5">
        <h2 className="text-xs font-bold max-md:sr-only">Sobre este NFT:</h2>
        <p className="text-xs leading-relaxed">{nft.description}</p>
      </div>

      <EditionPicker
        editions={nft.editions}
        value={edition.id}
        onChange={(id) => void navigate({ search: { edition: id }, replace: true, resetScroll: false })}
      />

      <div className="flex flex-col gap-2">
        {isMobile ? (
          // Barra de compra fixa (frame mobile): quantidade, preço, "Comprar NFT" e adicionar ao carrinho.
          <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-3 rounded-t-2xl border-t border-border bg-surface px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                {stepper ? (
                  <>
                    <span aria-hidden="true">Qtd.</span>
                    {stepper}
                  </>
                ) : (
                  <span className="text-destructive">Esgotado</span>
                )}
              </div>
              {price}
            </div>
            <div className="flex gap-3">
              <Button className="h-11 flex-1 rounded-full font-bold" onClick={() => onAdd(true)} disabled={blocked}>
                {add.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                {soldOut ? 'Edição esgotada' : 'Comprar NFT'}
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="size-11 rounded-full bg-background text-primary hover:bg-accent"
                onClick={() => onAdd()}
                disabled={blocked}
                aria-label="Adicionar ao carrinho"
              >
                <ShoppingCart aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {stepper || <span />}
          <div className="flex gap-2">
            <Button
              size="xs"
              className="h-9 px-5 font-bold uppercase"
              onClick={() => onAdd()}
              disabled={blocked}
            >
              {add.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {soldOut ? (
                'Edição esgotada'
              ) : add.isPending ? (
                'Adicionando…'
              ) : (
                <>
                  Comprar<span className="sr-only"> — adicionar ao carrinho</span>
                </>
              )}
            </Button>
            <FavoriteButton nft={nft} />
          </div>
        </div>
        )}
        <p className="text-[11px] text-muted-foreground" data-testid="limit-hint">
          {soldOut
            ? 'Esta edição está esgotada. Escolha outra edição.'
            : limit === 0
              ? `Você já tem o máximo permitido desta edição no carrinho (${inCart}).`
              : `${edition.label} · Máximo de ${edition.maxPerOrder} por pedido · ${edition.available} de ${edition.supply} disponíveis${inCart ? ` · ${inCart} no carrinho` : ''}.`}
        </p>
        {!soldOut && limit > 0 && quantity > 1 && (
          <p className="text-xs">
            Total: <strong className="text-primary">{formatEth(mulEth(edition.priceEth, quantity))}</strong>
          </p>
        )}
        {feedback && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {feedback}
          </p>
        )}
        <p className="sr-only" aria-live="polite">
          {liveMessage}
        </p>
      </div>

      <dl className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        <div className="flex gap-1.5">
          <dt>ID do token:</dt>
          <dd>{tokenId(nft.id)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Coleção:</dt>
          <dd>{nft.collection.name}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Atributos:</dt>
          <dd>{nft.tags.join(', ')}</dd>
        </div>
      </dl>

      <ShareLinks nft={nft} />
    </div>
  )
}

function DetailTabs({ nft }: { nft: Nft }) {
  const category = CATEGORIES.find((c) => c.id === nft.category)?.label
  const rows: [string, string][] = [
    ['Criador', nft.creator.name],
    ['Rede', nft.blockchain],
    ['Categoria', category ?? '—'],
    ['Criado em', new Date(nft.createdAt).toLocaleDateString('pt-BR', { dateStyle: 'long' })],
    ['Edições', nft.editions.map((e) => `${e.label} (${e.supply} unidades)`).join(' · ')],
  ]
  return (
    <Tabs defaultValue="details" className="mt-10 md:mt-12">
      <TabsList aria-label="Informações do NFT">
        <TabsTrigger value="details">Detalhes do NFT</TabsTrigger>
        <TabsTrigger value="reviews">Avaliações de colecionadores</TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="flex flex-col gap-4 text-xs leading-relaxed">
        <p>{nft.description}</p>
        <dl className="flex flex-col gap-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="font-bold">{label}:</dt>
              <dd className="text-muted-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </TabsContent>
      <TabsContent value="reviews" className="text-xs text-muted-foreground">
        As avaliações de colecionadores ainda não estão disponíveis nesta demonstração.
      </TabsContent>
    </Tabs>
  )
}

const MORE_LIMIT = 10

/** "Mais desta coleção": mesma coleção, sem o NFT atual, em faixa horizontal com indicadores. */
function MoreFromCollection({ nft }: { nft: Nft }) {
  const { data, isPending } = useCatalog({
    collection: nft.collection.id,
    status: 'all',
    sort: 'recent',
    page: 1,
    pageSize: MORE_LIMIT + 1,
  })
  const listRef = useRef<HTMLUListElement>(null)
  const [page, setPage] = useState(0)
  const [pages, setPages] = useState(1)
  const items = data?.items.filter((n) => n.id !== nft.id).slice(0, MORE_LIMIT) ?? []

  const measure = () => {
    const el = listRef.current
    if (!el) return
    setPages(Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth - 0.05)))
    setPage(Math.round(el.scrollLeft / el.clientWidth))
  }
  const goTo = (p: number) => listRef.current?.scrollTo({ left: p * listRef.current.clientWidth, behavior: 'smooth' })

  if (!isPending && items.length === 0) return null
  return (
    <section aria-labelledby="more-title" className="mt-12 md:mt-16">
      <h2 id="more-title" className="mb-5 border-b border-border pb-2 text-sm font-medium text-primary">
        Mais desta coleção
      </h2>
      <ul
        ref={(el) => {
          listRef.current = el
          if (el) requestAnimationFrame(measure)
        }}
        onScroll={measure}
        className="grid snap-x snap-mandatory auto-cols-[calc((100%-12px)/2)] grid-flow-col gap-3 overflow-x-auto pb-2 [scrollbar-width:none] md:auto-cols-[calc((100%-48px)/4)] md:gap-4 lg:auto-cols-[calc((100%-64px)/5)]"
        aria-busy={isPending}
      >
        {isPending
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="snap-start">
                <NftCardSkeleton />
              </li>
            ))
          : items.map((n) => (
              <li key={n.id} className="snap-start">
                <NftCard nft={n} />
              </li>
            ))}
      </ul>
      {pages > 1 && (
        <div role="group" aria-label="Páginas de NFTs da coleção" className="mt-3 flex justify-center gap-1">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Página ${i + 1} de ${pages}`}
              aria-pressed={i === page}
              className="flex size-6 items-center justify-center rounded-full"
            >
              <span
                aria-hidden="true"
                className={cn('size-1.5 rounded-full', i === page ? 'bg-primary' : 'bg-primary/40 hover:bg-primary/70')}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function DetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-10" aria-busy="true" aria-label="Carregando NFT">
      <div className="grid gap-3 lg:grid-cols-[64px_1fr] lg:gap-4">
        <div className="order-2 grid grid-cols-3 gap-3 lg:order-1 lg:flex lg:flex-col">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-sm lg:size-16" />
          ))}
        </div>
        <Skeleton className="order-1 aspect-square rounded-md lg:order-2" />
      </div>
      <div className="flex flex-col gap-5">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-2/3" />
      </div>
    </div>
  )
}

export function NftDetailPage() {
  const { nftId } = route.useParams()
  const { edition } = route.useSearch()
  const { data: nft, isPending, isError, error, refetch, isRefetching } = useNft(nftId)
  const notFound = isApiError(error) && error.status === 404

  return (
    <div className="container-page py-5 max-md:pt-2 max-md:pb-40 md:py-6">
      <Breadcrumb />

      {isPending ? (
        <DetailSkeleton />
      ) : notFound ? (
        <EmptyState
          title="NFT não encontrado"
          description="Este NFT não existe ou foi removido do marketplace."
          action={
            <Button asChild size="sm">
              <Link to="/">Explorar catálogo</Link>
            </Button>
          }
        />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} title="Não foi possível carregar o NFT" />
      ) : (
        <article key={nft.id}>
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
            <Gallery nft={nft} />
            <DetailInfo nft={nft} editionId={edition} />
          </div>
          <DetailTabs nft={nft} />
          <MoreFromCollection nft={nft} />
        </article>
      )}
    </div>
  )
}
