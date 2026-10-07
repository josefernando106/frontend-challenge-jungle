import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/endpoints'
import { qk } from '@/api/query-keys'
import { useSession } from '@/features/auth/session-store'

/**
 * Pedido por id. Atualizado por `order.updated` e reconciliado via REST ao reconectar.
 * Enquanto pendente, mantém um polling de segurança lento (20 s) caso um evento se perca.
 */
export function useOrder(orderId: string) {
  const session = useSession()
  const userId = session.status === 'authenticated' ? session.user.id : 'anonymous'
  return useQuery({
    queryKey: qk.user.order(userId, orderId),
    queryFn: ({ signal }) => api.orders.get(orderId, signal),
    enabled: userId !== 'anonymous',
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 20_000 : false),
  })
}

export function usePendingOrders() {
  const session = useSession()
  const userId = session.status === 'authenticated' ? session.user.id : 'anonymous'
  return useQuery({
    queryKey: qk.user.orders(userId, 'pending'),
    queryFn: ({ signal }) => api.orders.list('pending', signal),
    enabled: userId !== 'anonymous',
  })
}
