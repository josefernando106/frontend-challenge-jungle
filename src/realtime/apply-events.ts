import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Cart, Nft, NftSummary, NftUpdatedEvent, Order, OrderUpdatedEvent, Paginated } from '@/contracts'
import { qk } from '@/api/query-keys'
import { compareEth, formatEth } from '@/lib/eth'
import { realtimeStore } from './realtime-store'

/** Aplica `nft.updated` em detalhe, catálogo, destaques e carrinho — sem regredir versões. */
export function applyNftUpdated(queryClient: QueryClient, event: NftUpdatedEvent) {
  const { data, version } = event

  queryClient.setQueryData<Nft>(qk.nft(data.nftId), (old) => {
    if (!old || old.version >= version) return old
    return {
      ...old,
      version,
      fromPriceEth: data.fromPriceEth,
      available: data.available,
      editions: old.editions.map((e) => {
        const next = data.editions.find((x) => x.id === e.id)
        return next ? { ...e, priceEth: next.priceEth, available: next.available } : e
      }),
    }
  })

  const patchSummary = (item: NftSummary): NftSummary =>
    item.id === data.nftId && item.version < version
      ? { ...item, version, fromPriceEth: data.fromPriceEth, available: data.available }
      : item

  queryClient.setQueriesData<Paginated<NftSummary>>({ queryKey: ['catalog', 'list'] }, (old) =>
    old ? { ...old, items: old.items.map(patchSummary) } : old,
  )
  queryClient.setQueriesData<NftSummary[]>({ queryKey: qk.catalog.highlights() }, (old) => old?.map(patchSummary))

  // Carrinho: avisa a mudança e busca o resumo recalculado pela API (fonte da verdade dos valores).
  const carts = queryClient.getQueriesData<Cart>({ queryKey: ['cart'] })
  let affectsCart = false
  for (const [, cart] of carts) {
    for (const line of cart?.lines ?? []) {
      if (line.nftId !== data.nftId) continue
      const edition = data.editions.find((e) => e.id === line.editionId)
      if (!edition) continue
      affectsCart = true
      let message: string | null = null
      if (edition.available === 0 && line.available > 0) {
        message = `"${data.name}" (${line.editionLabel}) esgotou.`
      } else if (edition.available < line.quantity && edition.available !== line.available) {
        message = `"${data.name}" (${line.editionLabel}): restam apenas ${edition.available} unidade(s).`
      } else if (compareEth(edition.priceEth, line.unitPriceEth) !== 0) {
        message = `O preço de "${data.name}" (${line.editionLabel}) mudou de ${formatEth(line.unitPriceEth)} para ${formatEth(edition.priceEth)}.`
      }
      if (message) {
        realtimeStore.pushNotice({ id: event.eventId, nftId: data.nftId, message, at: Date.now() })
        toast.warning('Item do carrinho atualizado', { description: message, id: `nft-${data.nftId}` })
      }
    }
  }
  if (affectsCart) void queryClient.invalidateQueries({ queryKey: ['cart'] })

  realtimeStore.emit({ type: 'nft.updated', event })
}

/** Aplica `order.updated` somente para o dono do pedido da sessão atual. */
export function applyOrderUpdated(queryClient: QueryClient, event: OrderUpdatedEvent, currentUserId: string | null) {
  if (!currentUserId || event.userId !== currentUserId || event.data.order.userId !== currentUserId) return
  const order = event.data.order
  let applied = false
  queryClient.setQueryData<Order>(qk.user.order(currentUserId, order.id), (old) => {
    if (old && old.version >= event.version) return old
    // Estados terminais nunca voltam para pendente.
    if (old && old.status !== 'pending' && order.status === 'pending') return old
    applied = true
    return order
  })
  void queryClient.invalidateQueries({ queryKey: ['user', currentUserId, 'orders', 'list'] })
  if (!applied) return

  if (order.status === 'confirmed') {
    void queryClient.invalidateQueries({ queryKey: ['cart'] })
    toast.success('Pedido confirmado', { description: `Pedido ${order.id} confirmado na rede.`, id: `order-${order.id}` })
  } else if (order.status === 'declined') {
    toast.error('Pagamento recusado', { description: order.declineReason ?? undefined, id: `order-${order.id}` })
  }
  realtimeStore.emit({ type: 'order.updated', event })
}

/** Após reconectar: reconcilia recursos ativos com a API REST. */
export function reconcileAfterReconnect(queryClient: QueryClient, currentUserId: string | null) {
  void queryClient.invalidateQueries({ queryKey: qk.catalog.all, refetchType: 'active' })
  void queryClient.invalidateQueries({ queryKey: ['nft'], refetchType: 'active' })
  void queryClient.invalidateQueries({ queryKey: ['cart'], refetchType: 'active' })
  if (currentUserId) {
    void queryClient.invalidateQueries({ queryKey: ['user', currentUserId, 'orders'], refetchType: 'active' })
  }
  realtimeStore.emit({ type: 'reconnected' })
}
