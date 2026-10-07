import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { CatalogQuery } from '@/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/api/query-keys'

/**
 * Listagem: a chave inclui todos os parâmetros enviados. Ao trocar filtros, a requisição
 * anterior é abortada via AbortSignal (respostas obsoletas são descartadas) e o resultado
 * anterior permanece visível com indicador de atualização (keepPreviousData).
 */
export function useCatalog(query: CatalogQuery) {
  return useQuery({
    queryKey: qk.catalog.list(query),
    queryFn: ({ signal }) => api.catalog.list(query, signal),
    placeholderData: keepPreviousData,
  })
}

export function useHighlights() {
  return useQuery({
    queryKey: qk.catalog.highlights(),
    queryFn: ({ signal }) => api.catalog.highlights(signal),
  })
}

export function useFacets() {
  return useQuery({
    queryKey: qk.catalog.facets(),
    queryFn: ({ signal }) => api.catalog.facets(signal),
    staleTime: 5 * 60_000,
  })
}

export function useNft(id: string) {
  return useQuery({
    queryKey: qk.nft(id),
    queryFn: ({ signal }) => api.catalog.detail(id, signal),
  })
}
