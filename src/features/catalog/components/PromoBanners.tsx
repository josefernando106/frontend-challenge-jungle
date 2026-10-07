import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { HomeSearch } from '@/routes/search'
import { artworkSrcSet } from '@/lib/image'
import { useHighlights } from '../hooks'

const BANNERS: { title: string; description: string; search: HomeSearch; imageIndex: number }[] = [
  {
    title: 'Lançamentos gênesis de edição limitada',
    description: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    search: { tab: 'new' },
    imageIndex: 0,
  },
  {
    title: 'Arte digital selecionada e muito mais',
    description: 'Explore novos artistas, coleções verificadas e drops digitais que definem a cultura.',
    search: { sort: 'popular' },
    imageIndex: 2,
  },
]

/** Chamadas editoriais no fim da página: levam a recortes reais do catálogo. */
export function PromoBanners() {
  const { data, isPending } = useHighlights()
  return (
    <section aria-label="Coleções em destaque" className="container-page pb-12 md:pb-20">
      <ul className="grid gap-5 md:grid-cols-2">
        {BANNERS.map((b) => {
          const nft = data?.[b.imageIndex % (data.length || 1)]
          return (
            <li key={b.title} className="grid grid-cols-[minmax(0,45%)_1fr] items-center gap-4 rounded-md bg-surface p-3 md:gap-5">
              {isPending ? (
                <Skeleton className="aspect-square w-full rounded-sm" />
              ) : nft ? (
                <img
                  src={nft.coverImage.url}
                  srcSet={artworkSrcSet(nft.coverImage.url)}
                  sizes="(min-width: 768px) 260px, 45vw"
                  alt=""
                  width={240}
                  height={240}
                  loading="lazy"
                  decoding="async"
                  className="aspect-square w-full rounded-sm object-cover"
                />
              ) : (
                <div className="aspect-square w-full rounded-sm bg-accent" aria-hidden="true" />
              )}
              <div className="flex flex-col items-start gap-3 py-2 pr-2">
                <h2 className="text-sm leading-snug font-medium md:text-base">{b.title}</h2>
                <p className="text-[11px] leading-relaxed text-primary md:text-xs">{b.description}</p>
                <Button asChild size="xs" className="mt-1 rounded-sm text-xs">
                  <Link to="/" search={b.search} hash="catalogo">
                    Explorar <ArrowRight aria-hidden="true" />
                    <span className="sr-only">: {b.title}</span>
                  </Link>
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
