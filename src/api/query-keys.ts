import type { CatalogQuery, OrderStatus } from '@/contracts'

/**
 * Chaves de cache. Dados privados ficam sob ['user', userId, ...] para que
 * logout/troca de usuário removam tudo de uma vez e nunca haja colisão entre usuários.
 * O carrinho é isolado pelo dono (usuário ou id do carrinho de visitante).
 */
export const qk = {
  catalog: {
    all: ['catalog'] as const,
    list: (query: CatalogQuery) => ['catalog', 'list', query] as const,
    highlights: () => ['catalog', 'highlights'] as const,
    facets: () => ['catalog', 'facets'] as const,
  },
  nft: (id: string) => ['nft', id] as const,
  cart: (owner: string) => ['cart', owner] as const,
  user: {
    all: (userId: string) => ['user', userId] as const,
    session: (userId: string) => ['user', userId, 'session'] as const,
    favorites: (userId: string) => ['user', userId, 'favorites'] as const,
    profile: (userId: string) => ['user', userId, 'profile'] as const,
    wallets: (userId: string) => ['user', userId, 'wallets'] as const,
    order: (userId: string, orderId: string) => ['user', userId, 'orders', orderId] as const,
    orders: (userId: string, status?: OrderStatus) => ['user', userId, 'orders', 'list', status ?? 'all'] as const,
  },
}
