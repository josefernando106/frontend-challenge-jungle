import { Link } from '@tanstack/react-router'
import type { NftSummary } from '@/contracts'
import { formatEth } from '@/lib/eth'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { artworkSrcSet } from '@/lib/image'

interface NftCardProps {
  nft: NftSummary
  priority?: boolean
  className?: string
}

export function NftCard({ nft, priority, className }: NftCardProps) {
  const soldOut = nft.available === 0
  return (
    <article
      className={cn(
        'group relative flex flex-col gap-3 rounded-md bg-card p-2.5 pb-4 transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-accent',
        className,
      )}
      data-testid="nft-card"
    >
      <div className="relative aspect-square overflow-hidden rounded-sm">
        <img
          src={nft.coverImage.url}
          srcSet={artworkSrcSet(nft.coverImage.url)}
          sizes="(min-width: 1024px) 300px, (min-width: 768px) 33vw, 50vw"
          alt={nft.coverImage.alt}
          width={300}
          height={300}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {soldOut && (
          <span className="absolute top-2 left-2 rounded-sm bg-background/90 px-2 py-1 text-[10px] font-bold tracking-wide uppercase">
            Esgotado
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5 px-1">
        <h3 className="truncate text-xs leading-5 md:text-sm">
          <Link
            to="/nft/$nftId"
            params={{ nftId: nft.id }}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {nft.name}
          </Link>
        </h3>
        <p className="sr-only">Artista: {nft.creator.name}</p>
        <dl className="flex items-baseline justify-between gap-2">
          <dt className="sr-only">Preço</dt>
          <dd className="text-sm font-bold text-primary" data-testid="nft-price">
            {formatEth(nft.fromPriceEth)}
          </dd>
          <dt className="sr-only">Disponíveis</dt>
          <dd className="text-[11px] text-muted-foreground max-md:sr-only">{soldOut ? 'Esgotado' : `${nft.available} disp.`}</dd>
        </dl>
      </div>
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-md bg-card p-2.5 pb-4" aria-hidden="true">
      <Skeleton className="aspect-square rounded-sm" />
      <div className="flex flex-col gap-1.5 px-1">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-1/3" />
      </div>
    </div>
  )
}
