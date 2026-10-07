import { Link } from '@tanstack/react-router'
import { useQueries } from '@tanstack/react-query'
import { Heart } from 'lucide-react'
import type { Nft, NftSummary } from '@/contracts'
import { Button } from '@/components/ui/button'
import { NftCard, NftCardSkeleton } from '@/components/NftCard'
import { EmptyState, ErrorState } from '@/components/states'
import { useFavorites } from '@/features/favorites/hooks'
import { api } from '@/api/endpoints'
import { qk } from '@/api/query-keys'
import { AccountLayout } from './AccountLayout'

const toSummary = (nft: Nft): NftSummary => ({ ...nft, coverImage: nft.images[0] })

export function FavoritesPage() {
  const favorites = useFavorites()
  const ids = favorites.data ? [...favorites.data] : []
  const details = useQueries({
    queries: ids.map((id) => ({
      queryKey: qk.nft(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => api.catalog.detail(id, signal),
    })),
  })

  return (
    <AccountLayout title="Favoritos">
      {favorites.isPending ? (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <NftCardSkeleton />
            </li>
          ))}
        </ul>
      ) : favorites.isError ? (
        <ErrorState error={favorites.error} onRetry={() => void favorites.refetch()} retrying={favorites.isRefetching} />
      ) : ids.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-10 text-brand" aria-hidden="true" />}
          title="Nenhum favorito ainda"
          description="Toque em “Favoritar” na página de um NFT para salvá-lo aqui."
          action={
            <Button asChild size="sm">
              <Link to="/">Explorar catálogo</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 xl:gap-[30px]" data-testid="favorites-grid">
          {details.map((q, i) => (
            <li key={ids[i]}>{q.data ? <NftCard nft={toSummary(q.data)} /> : <NftCardSkeleton />}</li>
          ))}
        </ul>
      )}
    </AccountLayout>
  )
}
