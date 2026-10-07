import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Loader2, ShoppingBag, Tag, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Cart, CartLine } from '@/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { QuantityStepper } from '@/components/QuantityStepper'
import { EmptyState, ErrorState } from '@/components/states'
import { errorMessage } from '@/lib/errors'
import {
  useAcknowledgeCart,
  useApplyCoupon,
  useCart,
  useRemoveCartItem,
  useRemoveCoupon,
  useUpdateCartItem,
} from '@/features/cart/hooks'
import { PriceSummaryList, PriceSummarySkeleton } from '@/features/cart/components/PriceSummary'
import { useRealtimeState, realtimeStore } from '@/realtime/realtime-store'
import { isApiError } from '@/api/http'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

function LineStatus({ line }: { line: CartLine }) {
  if (line.status === 'ok') return null
  const text =
    line.status === 'unavailable'
      ? 'Esgotado — remova para continuar'
      : line.status === 'insufficient'
        ? `Apenas ${line.available} disponível(is) — ajuste a quantidade`
        : `Preço alterado: era ${formatEth(line.acknowledgedPriceEth)}`
  return (
    <p
      className={cn(
        'flex items-center gap-1.5 text-sm font-semibold',
        line.status === 'price_changed' ? 'text-warning' : 'text-destructive',
      )}
      data-testid="line-status"
    >
      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      {text}
    </p>
  )
}

function CartLineItem({ line }: { line: CartLine }) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const max = Math.max(1, Math.min(line.available, line.maxPerOrder))
  const busy = update.isPending || remove.isPending

  return (
    <li
      className="grid grid-cols-[64px_1fr_auto] items-center gap-3 rounded-xl bg-surface p-2.5 md:grid-cols-[112px_1fr_auto] md:gap-5 md:rounded-md md:p-4"
      data-testid="cart-line"
      aria-busy={busy}
    >
      <img
        src={line.image.url}
        alt={line.image.alt}
        width={112}
        height={112}
        className="aspect-square w-full rounded-sm object-cover"
        loading="lazy"
      />
      <div className="flex min-w-0 flex-col gap-1.5">
        <h2 className="truncate text-sm font-medium md:text-base">
          <Link to="/nft/$nftId" params={{ nftId: line.nftId }} search={{ edition: line.editionId }} className="hover:underline">
            {line.nftName}
          </Link>
        </h2>
        <p className="text-[11px] text-muted-foreground md:text-xs">
          Edição: {line.editionLabel.replace(/^Edição /, '')} · {formatEth(line.unitPriceEth)} / un.
        </p>
        <p className="text-sm font-bold text-primary md:text-base" data-testid="line-total">
          {formatEth(line.lineTotalEth)}
        </p>
        <LineStatus line={line} />
      </div>
      <div className="flex flex-col items-end gap-1.5 self-stretch justify-between">
        {line.status === 'unavailable' ? (
          <span className="text-xs text-muted-foreground">Indisponível</span>
        ) : (
          <QuantityStepper
            value={line.quantity}
            max={max}
            label={`Quantidade de ${line.nftName}`}
            disabled={busy}
            onChange={(quantity) =>
              update.mutate(
                { lineId: line.id, quantity },
                { onError: (e) => toast.error('Não foi possível alterar a quantidade', { description: errorMessage(e) }) },
              )
            }
          />
        )}
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-8 text-muted-foreground hover:text-destructive"
            aria-label={`Remover ${line.nftName} (${line.editionLabel}) do carrinho`}
            disabled={busy}
            onClick={() =>
              remove.mutate(line.id, {
                onSuccess: () => toast.success(`"${line.nftName}" removido do carrinho`),
                onError: (e) => toast.error('Não foi possível remover', { description: errorMessage(e) }),
              })
            }
          >
            {remove.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
          </Button>
        </div>
      </div>
    </li>
  )
}

function CouponForm({ cart }: { cart: Cart }) {
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) {
      setError('Informe um cupom.')
      return
    }
    setError(null)
    apply.mutate(code.trim(), {
      onSuccess: () => {
        setCode('')
        toast.success('Cupom aplicado')
      },
      onError: (err) => setError(isApiError(err) ? (err.fieldErrors.code ?? err.message) : errorMessage(err)),
    })
  }

  if (cart.coupon) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-dashed border-primary px-4 py-3">
        <p className="flex items-center gap-2">
          <Tag className="size-4 text-brand" aria-hidden="true" />
          <span>
            <strong className="font-mono">{cart.coupon.code}</strong> — {cart.coupon.description}
          </span>
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remover cupom ${cart.coupon.code}`}
          disabled={remove.isPending}
          onClick={() => remove.mutate(undefined, { onSuccess: () => toast.success('Cupom removido') })}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
      <label htmlFor="coupon" className="text-sm font-medium max-md:sr-only">
        Cupom de desconto
      </label>
      <div className="relative flex">
        <Input
          className="h-11 rounded-full bg-background pr-24 text-xs"
          id="coupon"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Digite o código promocional..."
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'coupon-error' : undefined}
        />
        <Button
          type="submit"
          size="xs"
          className="absolute top-1 right-1 h-9 rounded-full px-4"
          disabled={apply.isPending}
        >
          {apply.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : 'Aplicar'}
        </Button>
      </div>
      {error && (
        <p id="coupon-error" role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}

function RealtimeNotices() {
  const { notices } = useRealtimeState()
  if (!notices.length) return null
  return (
    <section aria-label="Alterações recentes nos itens" className="flex flex-col gap-2" data-testid="cart-notices">
      {notices.map((n) => (
        <div key={n.id} className="flex items-start justify-between gap-3 rounded-xl border-2 border-warning/60 bg-warning/10 px-4 py-3">
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            {n.message}
          </p>
          <button
            type="button"
            className="rounded-md p-1 hover:bg-accent"
            aria-label="Dispensar aviso"
            onClick={() => realtimeStore.dismissNotice(n.id)}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ))}
    </section>
  )
}

function CartSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]" aria-busy="true" aria-label="Carregando carrinho">
      <ul className="flex flex-col gap-4">
        {[0, 1].map((i) => (
          <li key={i} className="grid grid-cols-[80px_1fr] gap-4 rounded-md bg-card p-4 sm:grid-cols-[112px_1fr_auto] md:p-5">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-5 w-1/4" />
            </div>
            <Skeleton className="col-span-2 h-11 w-36 sm:col-span-1" />
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-5 rounded-md bg-card p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-[46px] w-full rounded-md" />
        <PriceSummarySkeleton />
        <Skeleton className="h-[60px] w-full rounded-md" />
      </div>
    </div>
  )
}

export function CartPage() {
  const { data: cart, isPending, isError, error, refetch, isRefetching, isFetching } = useCart()
  const acknowledge = useAcknowledgeCart()
  const navigate = useNavigate()

  const blocking = cart?.lines.filter((l) => l.status === 'unavailable' || l.status === 'insufficient') ?? []
  const priceChanged = cart?.lines.some((l) => l.status === 'price_changed') ?? false

  return (
    <div className="container-page py-2 md:py-10">
      <h1 className="mb-8 text-2xl font-medium max-md:sr-only md:text-[28px]">Carrinho de NFTs</h1>
      {isPending ? (
        <CartSkeleton />
      ) : isError && !cart ? (
        <ErrorState error={error} onRetry={() => void refetch()} retrying={isRefetching} title="Não foi possível carregar o carrinho" />
      ) : cart.lines.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="size-10 text-brand" aria-hidden="true" />}
          title="Seu carrinho está vazio"
          description="Explore o catálogo e adicione NFTs."
          action={
            <Button asChild size="sm">
              <Link to="/" hash="catalogo">
                Explorar catálogo
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="flex min-w-0 flex-col gap-4">
            <RealtimeNotices />
            {priceChanged && (
              <div
                role="status"
                className="flex flex-col gap-3 rounded-xl border-2 border-warning/60 bg-warning/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <p>Alguns preços mudaram desde que você adicionou os itens. O resumo já reflete os novos valores.</p>
                <Button size="xs" variant="outline" onClick={() => acknowledge.mutate()} disabled={acknowledge.isPending}>
                  Entendi
                </Button>
              </div>
            )}
            <ul className="flex flex-col gap-3" aria-label="Itens do carrinho">
              {cart.lines.map((line) => (
                <CartLineItem key={line.id} line={line} />
              ))}
            </ul>
          </div>

          <aside
            aria-labelledby="summary-title"
            className="flex h-fit flex-col gap-5 rounded-2xl bg-surface p-4 max-md:-mx-4 max-md:rounded-b-none md:rounded-md md:p-6 lg:sticky lg:top-24"
          >
            <h2 id="summary-title" className="flex items-center justify-between text-base font-medium max-md:sr-only">
              Resumo
              {isFetching && <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Atualizando resumo" />}
            </h2>
            <CouponForm cart={cart} />
            <PriceSummaryList summary={cart.summary} coupon={cart.coupon} feeLabel="Taxa de rede (estimada)" />
            {blocking.length > 0 && (
              <p role="alert" className="text-sm font-medium text-destructive">
                Ajuste os itens indisponíveis antes de finalizar.
              </p>
            )}
            <Button
              className="h-11 rounded-full font-bold max-md:text-sm md:rounded-md"
              onClick={() => void navigate({ to: '/checkout' })}
              disabled={blocking.length > 0}
              data-testid="go-checkout"
            >
              <span className="md:hidden">Conectar e finalizar</span>
              <span className="max-md:hidden">Finalizar compra</span>
            </Button>
            <p className="text-xs text-muted-foreground">
              A taxa final depende da rede escolhida no pagamento. Os valores são confirmados na revisão do pedido.
            </p>
          </aside>
        </div>
      )}
    </div>
  )
}
