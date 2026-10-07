import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AddCartItemRequest, Cart } from '@/contracts'
import { api } from '@/api/endpoints'
import { getGuestCartId } from '@/api/http'
import { qk } from '@/api/query-keys'
import { useSession } from '@/features/auth/session-store'

/** Dono do carrinho: usuário autenticado ou id do carrinho de visitante. */
export function useCartOwner() {
  const session = useSession()
  return session.status === 'authenticated' ? session.user.id : getGuestCartId()
}

export function useCart() {
  const owner = useCartOwner()
  return useQuery({
    queryKey: qk.cart(owner),
    queryFn: ({ signal }) => api.cart.get(signal),
    staleTime: 10_000,
  })
}

/** Mutations do carrinho: a resposta da API (carrinho recalculado) substitui o cache. */
function useCartMutation<TVars>(mutationFn: (vars: TVars) => Promise<Cart>) {
  const queryClient = useQueryClient()
  const owner = useCartOwner()
  return useMutation({
    mutationFn,
    onSuccess: (cart) => queryClient.setQueryData(qk.cart(owner), cart),
    onError: () => void queryClient.invalidateQueries({ queryKey: qk.cart(owner) }),
  })
}

export const useAddToCart = () => useCartMutation((body: AddCartItemRequest) => api.cart.addItem(body))
export const useUpdateCartItem = () =>
  useCartMutation(({ lineId, quantity }: { lineId: string; quantity: number }) => api.cart.updateItem(lineId, quantity))
export const useRemoveCartItem = () => useCartMutation((lineId: string) => api.cart.removeItem(lineId))
export const useApplyCoupon = () => useCartMutation((code: string) => api.cart.applyCoupon(code))
export const useRemoveCoupon = () => useCartMutation(() => api.cart.removeCoupon())
export const useAcknowledgeCart = () => useCartMutation(() => api.cart.acknowledge())
