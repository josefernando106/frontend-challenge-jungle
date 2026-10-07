import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { artworkSrcSet } from '@/lib/image'
import { useIsMobile } from '@/lib/use-is-mobile'
import { useHighlights } from '../hooks'

const MAX_SLIDES = 3

/** Destaques em carrossel manual (sem autoplay: evita movimento não solicitado — WCAG 2.2.2). */
function HeroCarousel() {
  const { data, isPending, isError } = useHighlights()
  const [index, setIndex] = useState(0)
  const slides = data?.slice(0, MAX_SLIDES) ?? []

  if (isPending) {
    return <Skeleton className="aspect-square w-full rounded-2xl md:aspect-[234/233]" />
  }
  if (isError || !slides.length) return null
  const current = slides[Math.min(index, slides.length - 1)]

  return (
    <div className="flex flex-col gap-4 md:contents">
      <Link
        to="/nft/$nftId"
        params={{ nftId: current.id }}
        className="group block overflow-hidden rounded-2xl md:col-start-2 md:row-span-2 md:row-start-1"
        aria-label={`Ver destaque: ${current.name}`}
      >
        <img
          key={current.id}
          src={current.coverImage.url}
          srcSet={artworkSrcSet(current.coverImage.url)}
          sizes="(min-width: 768px) 468px, 100vw"
          alt={current.coverImage.alt}
          width={468}
          height={466}
          fetchPriority={index === 0 ? 'high' : 'auto'}
          loading="eager"
          decoding="async"
          className="aspect-square size-full object-cover transition-transform duration-300 group-hover:scale-[1.03] md:aspect-[234/233]"
        />
      </Link>
      {slides.length > 1 && (
        <div
          role="group"
          aria-label="Destaques"
          className="flex justify-center gap-2 md:col-start-1 md:row-start-2 md:self-end md:justify-end md:pb-1"
        >
          {slides.map((nft, i) => (
            <button
              key={nft.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Destaque ${i + 1} de ${slides.length}: ${nft.name}`}
              aria-pressed={i === index}
              className="flex size-6 items-center justify-center rounded-full"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'size-1.5 rounded-full transition-colors',
                  i === index ? 'bg-primary' : 'bg-primary/40 hover:bg-primary/70',
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Hero do frame mobile: cartão compacto com texto à esquerda e destaque à direita. */
function MobileHero() {
  const { data, isPending } = useHighlights()
  const [index, setIndex] = useState(0)
  const slides = data?.slice(0, MAX_SLIDES) ?? []
  const current = slides[Math.min(index, slides.length - 1)]
  const next = slides.length > 1 ? slides[(index + 1) % slides.length] : undefined
  return (
    <section aria-labelledby="hero-title" className="container-page pt-4 pb-2">
      <div className="grid grid-cols-[1fr_42%] items-center gap-3 rounded-xl bg-surface p-3">
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px]">Bem-vindo à Kurio</p>
          <h1 id="hero-title" className="text-[15px] leading-snug font-medium uppercase">
            Seja dono da cultura digital
          </h1>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Descubra NFTs selecionados de criadores do mundo todo.
          </p>
          <a href="#catalogo" className="flex items-center gap-1 self-start rounded-sm text-[11px] font-medium text-primary uppercase">
            Explorar <ArrowRight className="size-3" aria-hidden="true" />
          </a>
        </div>
        {isPending ? (
          <Skeleton className="aspect-square w-full rounded-lg" />
        ) : current ? (
          <Link
            to="/nft/$nftId"
            params={{ nftId: current.id }}
            className="relative block"
            aria-label={`Ver destaque: ${current.name}`}
          >
            <img
              src={current.coverImage.url}
              srcSet={artworkSrcSet(current.coverImage.url)}
              sizes="40vw"
              alt={current.coverImage.alt}
              width={160}
              height={160}
              fetchPriority="high"
              loading="eager"
              decoding="async"
              className="aspect-square w-full rounded-lg object-cover"
            />
            {next && (
              <img
                src={next.coverImage.url.replace(/-960.webp$/, '-480.webp')}
                alt=""
                width={44}
                height={44}
                loading="lazy"
                className="absolute bottom-1.5 left-1.5 size-11 rounded-sm border-2 border-warning object-cover"
              />
            )}
          </Link>
        ) : null}
      </div>
      {slides.length > 1 && (
        <div role="group" aria-label="Destaques" className="mt-1 flex justify-center gap-1">
          {slides.map((nft, i) => (
            <button
              key={nft.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Destaque ${i + 1} de ${slides.length}: ${nft.name}`}
              aria-pressed={i === index}
              className="flex size-6 items-center justify-center rounded-full"
            >
              <span aria-hidden="true" className={cn('size-1.5 rounded-full', i === index ? 'bg-primary' : 'bg-primary/40')} />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

export function Hero() {
  const isMobile = useIsMobile()
  if (isMobile) return <MobileHero />
  return (
    <section aria-labelledby="hero-title" className="container-page pt-4 pb-10 md:pt-4 md:pb-16">
      <div className="grid gap-6 md:grid-cols-[1fr_minmax(0,468px)] md:grid-rows-[1fr_auto] md:gap-x-10 md:pl-10">
        <div className="flex flex-col gap-4 md:col-start-1 md:row-start-1 md:self-center md:py-10">
          <p className="text-xs md:text-sm">Bem-vindo à Kurio</p>
          <h1
            id="hero-title"
            className="text-[28px] leading-[1.35] font-medium uppercase md:text-[34px] lg:text-[44px] lg:leading-[1.45]"
          >
            Seja dono do futuro da arte digital
          </h1>
          <p className="max-w-[460px] text-xs leading-[1.8] text-primary md:text-sm">
            Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e
            tenha uma parte da cultura da internet.
          </p>
          <Button asChild size="sm" className="mt-4 w-full uppercase md:w-fit">
            <a href="#catalogo">Explorar</a>
          </Button>
        </div>
        <HeroCarousel />
      </div>
    </section>
  )
}
