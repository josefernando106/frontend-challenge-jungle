import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/api/http'

/**
 * Política de cache (ver ARCHITECTURE.md › Estratégia de cache):
 * - staleTime padrão 30 s; catálogo/detalhe recebem atualizações por Socket.IO.
 * - Retries apenas para falhas transitórias (rede, timeout, 5xx), até 2 vezes com backoff.
 * - 4xx nunca é repetido. Mutations não repetem automaticamente (idempotência é tratada no checkout).
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache(),
  mutationCache: new MutationCache(),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => isApiError(error) && error.isRetryable && failureCount < 2,
      retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 4000),
    },
    mutations: {
      retry: false,
    },
  },
})
