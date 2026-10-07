import { useState } from 'react'
import { getRouteApi, Link } from '@tanstack/react-router'
import { CheckCircle2, Copy, Loader2, XCircle } from 'lucide-react'
import type { Order } from '@/contracts'
import { NETWORKS } from '@/contracts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/states'
import { PriceSummaryList } from '@/features/cart/components/PriceSummary'
import { useOrder } from '@/features/orders/hooks'
import { useRealtimeState } from '@/realtime/realtime-store'
import { isApiError } from '@/api/http'
import { formatEth } from '@/lib/eth'

const route = getRouteApi('/auth/pedidos/$orderId')
const networkLabel = (id: string) => NETWORKS.find((n) => n.id === id)?.label ?? id

function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2">
        <code className="min-w-0 truncate font-mono text-sm" title={value}>
          {value}
        </code>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Copiar ${label.toLowerCase()}`}
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => setCopied(true))
          }}
        >
          <Copy aria-hidden="true" />
        </Button>
        <span className="sr-only" aria-live="polite">
          {copied ? 'Copiado' : ''}
        </span>
      </dd>
    </div>
  )
}

function Receipt({ order }: { order: Order }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-6 rounded-[20px] bg-card p-5 md:p-[30px]">
        <dl className="grid gap-5 sm:grid-cols-2">
          <CopyValue label="Pedido" value={order.id} />
          <CopyValue label="Hash da transação" value={order.transactionHash} />
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">Data</dt>
            <dd>{new Date(order.createdAt).toLocaleString('pt-BR')}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">Carteira / rede</dt>
            <dd className="font-mono text-sm">
              {order.wallet.label} · {networkLabel(order.network)}
            </dd>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <dt className="text-sm text-muted-foreground">Explorador (simulado)</dt>
            <dd className="font-mono text-sm break-all text-muted-foreground">{order.explorerUrl}</dd>
          </div>
        </dl>
        <h2 className="font-mono text-[22px] font-bold">Itens</h2>
        <ul className="flex flex-col divide-y divide-border" aria-label="Itens comprados">
          {order.lines.map((l) => (
            <li key={l.editionId} className="flex items-center gap-4 py-3" data-testid="receipt-line">
              <img src={l.image.url} alt="" width={56} height={56} className="size-14 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{l.nftName}</p>
                <p className="text-sm text-muted-foreground">
                  {l.editionLabel} · {l.quantity} × {formatEth(l.unitPriceEth)}
                </p>
              </div>
              <p className="font-mono">{formatEth(l.lineTotalEth)}</p>
            </li>
          ))}
        </ul>
      </div>
      <aside aria-labelledby="receipt-total" className="flex h-fit flex-col gap-5 rounded-[20px] bg-card p-6">
        <h2 id="receipt-total" className="font-mono text-[22px] font-bold">
          Valores
        </h2>
        <PriceSummaryList summary={order} coupon={order.coupon} feeLabel={`Taxa de rede (${networkLabel(order.network)})`} />
      </aside>
    </div>
  )
}

export function OrderPage() {
  const { orderId } = route.useParams()
  const { data: order, isPending, isError, error, refetch, isRefetching } = useOrder(orderId)
  const { status: socketStatus } = useRealtimeState()

  if (isPending) {
    return (
      <div className="container-page flex flex-col gap-6 py-8 md:py-14" aria-busy="true">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-64 w-full rounded-[20px]" />
      </div>
    )
  }
  if (isError) {
    return (
      <div className="container-page py-8 md:py-14">
        {isApiError(error) && error.status === 404 ? (
          <EmptyState
            title="Pedido não encontrado"
            description="Verifique o endereço ou acesse seus pedidos pela conta."
            action={
              <Button asChild size="sm">
                <Link to="/">Ir para o início</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} />
        )}
      </div>
    )
  }

  return (
    <div className="container-page py-8 md:py-14" data-testid="order-page" data-status={order.status}>
      <div aria-live="polite" className="mb-8">
        {order.status === 'pending' && (
          <div className="flex flex-col gap-3" role="status">
            <h1 className="flex items-center gap-3 text-[28px] font-semibold md:text-[38px]">
              <Loader2 className="size-8 animate-spin text-brand" aria-hidden="true" />
              Aguardando confirmação
            </h1>
            <p className="text-muted-foreground">
              Seu pedido <span className="font-mono">{order.id}</span> foi enviado e está sendo processado na rede{' '}
              {networkLabel(order.network)}. Você pode sair desta página: o status é atualizado automaticamente.
            </p>
            {socketStatus !== 'connected' && (
              <p className="text-sm text-warning">Reconectando ao tempo real… o status será sincronizado ao reconectar.</p>
            )}
          </div>
        )}
        {order.status === 'confirmed' && (
          <div className="flex flex-col gap-3">
            <h1 className="flex items-center gap-3 text-[28px] font-semibold md:text-[38px]">
              <CheckCircle2 className="size-9 text-success" aria-hidden="true" />
              Pedido confirmado!
            </h1>
            <p className="text-muted-foreground">
              Total pago: <strong className="font-mono text-foreground">{formatEth(order.totalEth)}</strong>. Os NFTs já
              estão na sua carteira {order.wallet.label}.
            </p>
          </div>
        )}
        {order.status === 'declined' && (
          <div className="flex flex-col gap-4">
            <h1 className="flex items-center gap-3 text-[28px] font-semibold md:text-[38px]">
              <XCircle className="size-9 text-destructive" aria-hidden="true" />
              Pagamento recusado
            </h1>
            <p className="text-muted-foreground">{order.declineReason}</p>
            <p>Nenhum valor foi cobrado e seus itens continuam no carrinho.</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="sm">
                <Link to="/checkout">Tentar novamente</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/carrinho">Ver carrinho</Link>
              </Button>
            </div>
          </div>
        )}
      </div>

      {order.status === 'confirmed' ? (
        <>
          <Receipt order={order} />
          <div className="mt-8">
            <Button asChild size="sm" variant="outline">
              <Link to="/">Continuar explorando</Link>
            </Button>
          </div>
        </>
      ) : (
        order.status === 'pending' && (
          <dl className="grid gap-4 rounded-[20px] bg-card p-5 sm:grid-cols-2 md:p-[30px]">
            <CopyValue label="Hash da transação" value={order.transactionHash} />
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">Total</dt>
              <dd className="font-mono">{formatEth(order.totalEth)}</dd>
            </div>
          </dl>
        )
      )}
    </div>
  )
}
