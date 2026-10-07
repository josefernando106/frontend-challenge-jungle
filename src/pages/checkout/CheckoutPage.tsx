import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, ArrowLeft, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import type { Order, Quote, QuoteIssue, WalletConnection } from '@/contracts'
import { NETWORKS } from '@/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/form/Field'
import { EmptyState, ErrorState } from '@/components/states'
import { errorMessage } from '@/lib/errors'
import { PriceSummaryList, PriceSummarySkeleton } from '@/features/cart/components/PriceSummary'
import { useCart } from '@/features/cart/hooks'
import { usePendingOrders } from '@/features/orders/hooks'
import { useSession } from '@/features/auth/session-store'
import { buyerSchema, type BuyerForm } from '@/features/checkout/schema'
import { usePlaceOrder } from '@/features/checkout/use-place-order'
import { realtimeStore } from '@/realtime/realtime-store'
import { api } from '@/api/endpoints'
import { isApiError } from '@/api/http'
import { formatEth, compareEth } from '@/lib/eth'
import { readJson, removeKey, STORAGE_KEYS, writeJson } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { WalletSection } from './WalletSection'

type Step = 'details' | 'review'

function Steps({ step }: { step: Step }) {
  const items = [
    { id: 'details', label: 'Dados e carteira' },
    { id: 'review', label: 'Revisão' },
    { id: 'done', label: 'Confirmação' },
  ]
  const current = items.findIndex((i) => i.id === step)
  return (
    <ol className="mb-8 flex flex-wrap gap-2 text-xs max-md:sr-only" aria-label="Etapas do pagamento">
      {items.map((item, i) => (
        <li
          key={item.id}
          aria-current={i === current ? 'step' : undefined}
          className={cn(
            'flex items-center gap-2 rounded-full px-4 py-2',
            i === current ? 'bg-primary text-primary-foreground' : i < current ? 'bg-card' : 'bg-card text-muted-foreground',
          )}
        >
          <span aria-hidden="true">{i + 1}.</span> {item.label}
          {i < current && <span className="sr-only"> (concluída)</span>}
        </li>
      ))}
    </ol>
  )
}

function issueText(issue: QuoteIssue) {
  switch (issue.type) {
    case 'unavailable':
      return `"${issue.nftName}" está esgotado.`
    case 'insufficient':
      return `"${issue.nftName}": apenas ${issue.available} disponível(is), você pediu ${issue.requested}.`
    case 'coupon_invalid':
      return `O cupom ${issue.code} ${issue.reason === 'expired' ? 'expirou' : 'é inválido'} e não foi aplicado.`
    case 'price_changed':
      return `O preço de "${issue.nftName}" mudou de ${formatEth(issue.previousPriceEth)} para ${formatEth(issue.currentPriceEth)}.`
  }
}

const networkLabel = (id: string) => NETWORKS.find((n) => n.id === id)?.label ?? id

/** No mobile, a ação principal fica numa barra fixa no rodapé (frame "Pagamento"). */
const mobileBar =
  'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:rounded-t-2xl max-md:border-t max-md:border-border max-md:bg-surface max-md:px-4 max-md:pt-3 max-md:pb-[max(1rem,env(safe-area-inset-bottom))] md:self-end'

export function CheckoutPage() {
  const session = useSession()
  const navigate = useNavigate()
  if (session.status !== 'authenticated') return null
  const { user } = session
  return <Checkout key={user.id} userId={user.id} defaultName={user.name} defaultEmail={user.email} navigate={navigate} />
}

function Checkout({
  userId,
  defaultName,
  defaultEmail,
  navigate,
}: {
  userId: string
  defaultName: string
  defaultEmail: string
  navigate: ReturnType<typeof useNavigate>
}) {
  const cart = useCart()
  const pendingOrders = usePendingOrders()
  const draftKey = STORAGE_KEYS.checkoutDraft(userId)
  const connectionKey = STORAGE_KEYS.walletConnection(userId)

  const form = useForm<BuyerForm>({
    resolver: zodResolver(buyerSchema),
    mode: 'onTouched',
    defaultValues: readJson<BuyerForm>(draftKey, 'session') ?? {
      fullName: defaultName,
      email: defaultEmail,
      phone: '',
      country: 'Brasil',
    },
  })
  const {
    register,
    formState: { errors },
  } = form

  // Rascunho persistido: sobrevive a refresh e à expiração da sessão durante o checkout.
  const draft = useWatch({ control: form.control })
  useEffect(() => {
    writeJson(draftKey, draft, 'session')
  }, [draft, draftKey])

  const [step, setStep] = useState<Step>('details')
  const [connection, setConnection] = useState<WalletConnection | null>(() =>
    readJson<WalletConnection>(connectionKey, 'session'),
  )
  const [walletError, setWalletError] = useState<string | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [stale, setStale] = useState<string | null>(null)
  const [changeNotice, setChangeNotice] = useState<string | null>(null)
  const reviewHeading = useRef<HTMLHeadingElement>(null)

  const quoteMutation = useMutation({ mutationFn: api.checkout.quote })

  const onOrderCreated = (order: Order) => {
    removeKey(draftKey, 'session')
    void navigate({ to: '/pedidos/$orderId', params: { orderId: order.id }, replace: true })
  }
  const place = usePlaceOrder(userId, onOrderCreated)

  // Retoma envio interrompido (refresh/queda durante a confirmação) com a mesma chave.
  // Avaliado só na montagem: durante um envio normal a tentativa salva não deve disparar a retomada.
  const [interruptedAttempt] = useState(() => place.pendingAttempt)
  const [resuming, setResuming] = useState(!!interruptedAttempt)
  const resumeRef = useRef(place.resume)
  const resumeStarted = useRef(false)
  useEffect(() => {
    if (!interruptedAttempt || resumeStarted.current) return
    resumeStarted.current = true
    void resumeRef.current().finally(() => setResuming(false))
  }, [interruptedAttempt])

  // Cotação desatualizada por evento em tempo real ou reconexão.
  // Durante o envio, a própria compra reserva estoque e emite nft.updated; o servidor
  // revalida a cotação na confirmação, então esses eventos não invalidam a revisão.
  const submittingRef = useRef(false)
  useEffect(() => {
    submittingRef.current = place.status === 'submitting' || place.status === 'retrying'
  })
  useEffect(() => {
    return realtimeStore.onEvent((e) => {
      if (!quote || step !== 'review' || submittingRef.current) return
      if (e.type === 'nft.updated' && quote.lines.some((l) => l.nftId === e.event.data.nftId)) {
        setStale(`"${e.event.data.name}" teve preço ou disponibilidade alterados. Atualize a cotação para continuar.`)
      }
      if (e.type === 'reconnected') {
        setStale('A conexão foi restabelecida. Atualize a cotação para confirmar com valores atuais.')
      }
    })
  }, [quote, step])

  const setConn = (c: WalletConnection | null) => {
    setConnection(c)
    if (c) writeJson(connectionKey, c, 'session')
    else removeKey(connectionKey, 'session')
    setWalletError(null)
    if (!c && step === 'review') setStep('details')
  }

  const requestQuote = async (previous?: Quote | null) => {
    if (!connection) return
    const next = await quoteMutation.mutateAsync({ network: connection.network })
    setQuote(next)
    setStale(null)
    if (previous && compareEth(previous.totalEth, next.totalEth) !== 0) {
      setChangeNotice(`O total foi atualizado de ${formatEth(previous.totalEth)} para ${formatEth(next.totalEth)}.`)
    }
    return next
  }

  const onReview = (event: React.FormEvent) =>
    form.handleSubmit(
      async () => {
        if (!connection) {
          setWalletError('Conecte uma carteira para continuar.')
          document.getElementById('wallet-title')?.scrollIntoView({ block: 'center' })
          return
        }
        setChangeNotice(null)
        try {
          await requestQuote()
          setStep('review')
          requestAnimationFrame(() => reviewHeading.current?.focus())
        } catch {
          /* erro exibido abaixo */
        }
      },
      () => {
        if (!connection) setWalletError('Conecte uma carteira para continuar.')
      },
    )(event)

  const onConfirm = async () => {
    if (!quote || !connection) return
    setChangeNotice(null)
    try {
      await place.submit({
        quoteId: quote.id,
        walletId: connection.walletId,
        network: connection.network,
        buyer: form.getValues(),
      })
    } catch (e) {
      if (!isApiError(e)) return
      const details = e.details as { quote?: Quote } | undefined
      if ((e.code === 'QUOTE_STALE' || e.code === 'AVAILABILITY_CONFLICT') && details?.quote) {
        const prev = quote
        setQuote(details.quote)
        setStale(null)
        setChangeNotice(
          e.code === 'QUOTE_STALE'
            ? `Os valores mudaram antes da confirmação (total de ${formatEth(prev.totalEth)} para ${formatEth(details.quote.totalEth)}). Revise e confirme novamente.`
            : 'Alguns itens deixaram de estar disponíveis. Ajuste o carrinho para continuar.',
        )
        reviewHeading.current?.focus()
      } else if (e.code === 'VALIDATION_ERROR' && Object.keys(e.fieldErrors).some((k) => k.startsWith('buyer.'))) {
        setStep('details')
        for (const [k, msg] of Object.entries(e.fieldErrors)) {
          if (k.startsWith('buyer.')) form.setError(k.slice(6) as keyof BuyerForm, { type: 'server', message: msg })
        }
      }
    }
  }

  const blocking = quote?.issues.filter((i) => i.type !== 'price_changed') ?? []
  const informative = quote?.issues.filter((i) => i.type === 'price_changed') ?? []
  const busy = place.status === 'submitting' || place.status === 'retrying'
  const pending = pendingOrders.data?.[0]

  if (resuming) {
    return (
      <div className="container-page flex flex-col items-center gap-4 py-24 text-center" role="status">
        <Loader2 className="size-10 animate-spin text-brand" aria-hidden="true" />
        <h1 className="text-2xl font-semibold">Recuperando seu pedido…</h1>
        <p className="text-muted-foreground">Retomamos a confirmação interrompida sem criar uma nova compra.</p>
      </div>
    )
  }

  return (
    <div className="container-page py-2 max-md:pb-28 md:py-10">
      <Link
        to="/carrinho"
        className="mb-6 inline-flex items-center gap-2 rounded-sm py-2 text-sm text-muted-foreground hover:text-foreground max-md:hidden"
      >
        <ArrowLeft className="size-5" aria-hidden="true" /> Voltar ao carrinho
      </Link>
      <h1 className="mb-6 text-2xl font-medium max-md:sr-only md:text-[28px]">Pagamento com carteira</h1>
      <Steps step={step} />

      {pending && (
        <div role="status" className="mb-6 rounded-xl border-2 border-primary/60 bg-primary/10 px-4 py-3">
          Você tem um pedido aguardando confirmação.{' '}
          <Link to="/pedidos/$orderId" params={{ orderId: pending.id }} className="font-semibold underline">
            Ver status do pedido {pending.id}
          </Link>
        </div>
      )}

      {cart.isPending ? (
        <div className="rounded-md bg-card p-6">
          <PriceSummarySkeleton />
        </div>
      ) : cart.isError && !cart.data ? (
        <ErrorState error={cart.error} onRetry={() => void cart.refetch()} retrying={cart.isRefetching} />
      ) : cart.data.lines.length === 0 && step !== 'review' ? (
        // Na revisão o snapshot é a cotação: o carrinho pode esvaziar quando o pedido é liquidado
        // antes de a resposta do envio chegar (ex.: timeout), sem desmontar a confirmação.
        <EmptyState
          title="Seu carrinho está vazio"
          description="Adicione NFTs para continuar com o pagamento."
          action={
            <Button asChild size="sm">
              <Link to="/">Explorar catálogo</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          <div className="flex min-w-0 flex-col gap-6">
            {step === 'details' ? (
              <>
                <form
                  id="buyer-form"
                  onSubmit={onReview}
                  noValidate
                  className="flex flex-col gap-4 rounded-xl bg-surface p-4 md:rounded-md md:p-6"
                  aria-labelledby="buyer-title"
                >
                  <h2 id="buyer-title" className="text-sm font-medium md:text-base">
                    1. Dados do colecionador
                  </h2>
                  <div className="grid gap-5 md:grid-cols-2">
                    <Field label="Nome completo" error={errors.fullName?.message} required className="md:col-span-2">
                      <Input autoComplete="name" {...register('fullName')} />
                    </Field>
                    <Field label="E-mail" error={errors.email?.message} required>
                      <Input type="email" autoComplete="email" {...register('email')} />
                    </Field>
                    <Field label="Telefone" error={errors.phone?.message} hint="Com DDD, ex.: (11) 91234-5678" required>
                      <Input type="tel" autoComplete="tel" {...register('phone')} />
                    </Field>
                    <Field label="País" error={errors.country?.message} required className="md:col-span-2">
                      <Input autoComplete="country-name" {...register('country')} />
                    </Field>
                  </div>
                </form>
                <WalletSection connection={connection} onConnected={setConn} onDisconnect={() => setConn(null)} error={walletError} />
                {quoteMutation.isError && (
                  <p role="alert" className="text-sm font-medium text-destructive">
                    Não foi possível calcular a cotação: {errorMessage(quoteMutation.error)}
                  </p>
                )}
                <div className={mobileBar}>
                  <Button
                    type="submit"
                    form="buyer-form"
                    disabled={quoteMutation.isPending}
                    className="h-11 w-full rounded-full font-bold md:w-auto md:rounded-md"
                    data-testid="review-order"
                  >
                    {quoteMutation.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                    Revisar pedido
                  </Button>
                </div>
              </>
            ) : (
              quote && (
                <section aria-labelledby="review-title" className="flex flex-col gap-5 rounded-xl bg-surface p-4 md:rounded-md md:p-6">
                  <h2 id="review-title" ref={reviewHeading} tabIndex={-1} className="text-sm font-medium outline-none md:text-base">
                    3. Revise seu pedido
                  </h2>

                  {changeNotice && (
                    <div role="alert" className="flex gap-2 rounded-xl border-2 border-warning/60 bg-warning/10 p-4" data-testid="quote-changed">
                      <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden="true" />
                      <p>{changeNotice}</p>
                    </div>
                  )}
                  {stale && (
                    <div role="alert" className="flex flex-col gap-3 rounded-xl border-2 border-warning/60 bg-warning/10 p-4" data-testid="quote-stale">
                      <p className="flex gap-2">
                        <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden="true" />
                        {stale}
                      </p>
                      <Button
                        size="xs"
                        variant="outline"
                        className="self-start"
                        disabled={quoteMutation.isPending}
                        onClick={() => void requestQuote(quote).catch(() => undefined)}
                      >
                        <RefreshCw className={cn(quoteMutation.isPending && 'animate-spin')} aria-hidden="true" />
                        Atualizar cotação
                      </Button>
                    </div>
                  )}
                  {blocking.length > 0 && (
                    <div role="alert" className="flex flex-col gap-2 rounded-xl border-2 border-destructive/60 bg-destructive/10 p-4">
                      <ul className="list-disc pl-5">
                        {blocking.map((i, idx) => (
                          <li key={idx}>{issueText(i)}</li>
                        ))}
                      </ul>
                      <Link to="/carrinho" className="font-semibold underline">
                        Ajustar carrinho
                      </Link>
                    </div>
                  )}
                  {informative.length > 0 && (
                    <ul className="list-disc pl-5 text-sm text-warning">
                      {informative.map((i, idx) => (
                        <li key={idx}>{issueText(i)}</li>
                      ))}
                    </ul>
                  )}

                  <ul className="flex flex-col divide-y divide-border" aria-label="Itens do pedido">
                    {quote.lines.map((l) => (
                      <li key={l.lineId} className="flex items-center gap-4 py-3">
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

                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">Colecionador</dt>
                      <dd>
                        {form.getValues('fullName')} · {form.getValues('email')}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Carteira / rede</dt>
                      <dd className="font-mono">
                        {connection && `${connection.address.slice(0, 6)}…${connection.address.slice(-4)}`} ·{' '}
                        {networkLabel(quote.network)}
                      </dd>
                    </div>
                  </dl>

                  {place.status === 'retrying' && (
                    <p role="status" className="text-sm text-warning">
                      O servidor demorou a responder. Tentando novamente com a mesma solicitação…
                    </p>
                  )}
                  {place.status === 'failed' && place.error && !['QUOTE_STALE', 'AVAILABILITY_CONFLICT'].includes(place.error.code) && (
                    <p role="alert" className="text-sm font-medium text-destructive">
                      {place.error.isRetryable
                        ? 'Não conseguimos confirmar o envio. Tente novamente — seu pedido não será duplicado.'
                        : place.error.message}
                    </p>
                  )}

                  <div className={cn(mobileBar, 'flex flex-col-reverse gap-2 sm:flex-row sm:justify-between')}>
                    <Button variant="ghost" size="sm" onClick={() => setStep('details')} disabled={busy}>
                      Editar dados
                    </Button>
                    <Button
                      onClick={() => void onConfirm()}
                      disabled={busy || !!stale || blocking.length > 0 || quoteMutation.isPending}
                      aria-disabled={busy || undefined}
                      className="h-11 rounded-full font-bold md:rounded-md"
                      data-testid="confirm-order"
                    >
                      {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
                      {busy ? 'Confirmando…' : place.status === 'failed' && place.error?.isRetryable ? 'Tentar novamente' : 'Confirmar compra'}
                    </Button>
                  </div>
                </section>
              )
            )}
          </div>

          <aside
            aria-labelledby="checkout-summary"
            className="flex h-fit flex-col gap-4 rounded-xl bg-surface p-4 md:rounded-md md:p-6 lg:sticky lg:top-24"
          >
            <h2 id="checkout-summary" className="text-sm font-medium md:text-base">
              {step === 'review' ? 'Total da cotação' : 'Resumo do carrinho'}
            </h2>
            {step === 'review' && quote ? (
              <>
                <PriceSummaryList summary={quote} coupon={quote.coupon} feeLabel={`Taxa de rede (${networkLabel(quote.network)})`} />
                <p className="text-xs text-muted-foreground">
                  Cotação válida até {new Date(quote.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.
                  Preço, disponibilidade, cupom e taxas são revalidados na confirmação.
                </p>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">
                  {cart.data.itemCount} {cart.data.itemCount === 1 ? 'item' : 'itens'}
                </p>
                <PriceSummaryList summary={cart.data.summary} coupon={cart.data.coupon} feeLabel="Taxa de rede (estimada)" />
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
