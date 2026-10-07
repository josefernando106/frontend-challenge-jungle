import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { FavoritesResponse } from '@/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/api/query-keys'
import { useSession } from '@/features/auth/session-store'

export function useFavorites() {
  const session = useSession()
  const userId = session.status === 'authenticated' ? session.user.id : null
  return useQuery({
    queryKey: qk.user.favorites(userId ?? 'anonymous'),
    queryFn: ({ signal }) => api.favorites.list(signal),
    enabled: !!userId,
    select: (data) => new Set(data.nftIds),
  })
}

/**
 * Atualização otimista com rollback: o coração muda na hora; em falha, o cache volta ao
 * snapshot anterior e o usuário é avisado. Ao final, sincroniza com a API.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient()
  const session = useSession()
  const userId = session.status === 'authenticated' ? session.user.id : 'anonymous'
  const key = qk.user.favorites(userId)

  return useMutation({
    mutationKey: ['favorite-toggle', userId],
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; name: string }) =>
      favorite ? api.favorites.add(nftId) : api.favorites.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<FavoritesResponse>(key)
      queryClient.setQueryData<FavoritesResponse>(key, (old) => {
        const ids = new Set(old?.nftIds ?? [])
        if (favorite) ids.add(nftId)
        else ids.delete(nftId)
        return { nftIds: [...ids] }
      })
      return { previous }
    },
    onError: (_error, { favorite, name }, context) => {
      queryClient.setQueryData(key, context?.previous)
      toast.error(favorite ? 'Não foi possível favoritar' : 'Não foi possível remover dos favoritos', {
        description: `"${name}" voltou ao estado anterior. Tente novamente.`,
      })
    },
    onSuccess: (data, { favorite, name }) => {
      queryClient.setQueryData(key, data)
      toast.success(favorite ? `"${name}" adicionado aos favoritos` : `"${name}" removido dos favoritos`)
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: ['favorite-toggle', userId] }) === 1) {
        void queryClient.invalidateQueries({ queryKey: key })
      }
    },
  })
}
