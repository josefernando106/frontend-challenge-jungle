import { useId, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CheckCircle2, Loader2, Plug, Wallet as WalletIcon } from 'lucide-react'
import type { NetworkId, Wallet, WalletConnection } from '@/contracts'
import { NETWORKS, WALLET_PROVIDERS } from '@/contracts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/states'
import { useConnectWallet, useWallets } from '@/features/account/hooks'
import { isApiError } from '@/api/http'
import { cn } from '@/lib/utils'
import { shortAddress } from '@/lib/format'

const providerLabel = (id: Wallet['provider']) => WALLET_PROVIDERS.find((p) => p.id === id)?.label ?? id
const networkLabel = (id: NetworkId) => NETWORKS.find((n) => n.id === id)?.label ?? id

interface WalletSectionProps {
  connection: WalletConnection | null
  onConnected: (connection: WalletConnection) => void
  onDisconnect: () => void
  error?: string | null
  disabled?: boolean
}

/** Cartão selecionável (rádio nativo visualmente oculto) no estilo do layout. */
const optionCard =
  'flex cursor-pointer items-center gap-3 rounded-lg border bg-background p-3 transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60'

function RadioDot({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-full border',
        checked ? 'border-primary' : 'border-input',
      )}
    >
      {checked && <span className="size-2 rounded-full bg-primary" />}
    </span>
  )
}

export function WalletSection({ connection, onConnected, onDisconnect, error, disabled }: WalletSectionProps) {
  const { data: wallets, isPending, isError, error: loadError, refetch, isRefetching } = useWallets()
  const connect = useConnectWallet()
  const groupName = useId()
  const networkGroup = useId()
  const [walletId, setWalletId] = useState<string | null>(connection?.walletId ?? null)
  const [network, setNetwork] = useState<NetworkId | null>(connection?.network ?? null)
  const [connectError, setConnectError] = useState<string | null>(null)

  const selected = wallets?.find((w) => w.id === (walletId ?? wallets.find((x) => x.role === 'primary')?.id)) ?? wallets?.[0]
  const selectedNetwork = network && selected?.networks.includes(network) ? network : selected?.networks[0]

  const change = (fn: () => void) => {
    if (connection) onDisconnect()
    setConnectError(null)
    fn()
  }

  const doConnect = () => {
    if (!selected || !selectedNetwork) return
    setConnectError(null)
    connect.mutate(
      { walletId: selected.id, network: selectedNetwork },
      {
        onSuccess: onConnected,
        onError: (e) =>
          setConnectError(
            isApiError(e) && e.code === 'WALLET_REJECTED'
              ? 'A conexão foi recusada na carteira. Aprove a solicitação e tente novamente.'
              : isApiError(e)
                ? e.message
                : 'Não foi possível conectar.',
          ),
      },
    )
  }

  return (
    <section aria-labelledby="wallet-title" className="flex flex-col gap-4 rounded-xl bg-surface p-4 md:rounded-md md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="wallet-title" className="text-sm font-medium md:text-base">
          {connection ? 'Carteira conectada' : '2. Carteira e rede'}
        </h2>
        {connection && (
          <button
            type="button"
            onClick={onDisconnect}
            disabled={disabled}
            className="rounded-sm text-xs text-primary underline-offset-4 hover:underline disabled:opacity-50"
          >
            Trocar carteira
          </button>
        )}
      </div>
      {isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : isError ? (
        <ErrorState error={loadError} onRetry={() => void refetch()} retrying={isRefetching} title="Erro ao carregar carteiras" />
      ) : !wallets.length ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">Você ainda não cadastrou carteiras.</p>
          <Button asChild size="sm">
            <Link to="/conta/carteiras">
              <WalletIcon aria-hidden="true" /> Cadastrar carteira
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <fieldset className="flex flex-col gap-2.5" disabled={disabled}>
            <legend className="sr-only">Carteira de pagamento</legend>
            {wallets.map((w) => {
              const id = `${groupName}-${w.id}`
              const checked = selected?.id === w.id
              return (
                <label
                  key={w.id}
                  htmlFor={id}
                  className={cn(optionCard, checked ? 'border-primary' : 'border-transparent hover:border-input')}
                >
                  <input
                    type="radio"
                    id={id}
                    name={groupName}
                    className="sr-only"
                    checked={checked}
                    onChange={() => change(() => setWalletId(w.id))}
                  />
                  <RadioDot checked={checked} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs">
                    <span className="font-medium">
                      {w.label}{' '}
                      <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-normal">
                        {w.role === 'primary' ? 'Principal' : 'Secundária'}
                      </span>
                    </span>
                    <span className="text-primary">
                      {providerLabel(w.provider)} · {shortAddress(w.address)}
                    </span>
                    <span className="text-muted-foreground">
                      Rede{w.networks.length > 1 ? 's' : ''} {w.networks.map(networkLabel).join(', ')}
                    </span>
                  </span>
                </label>
              )
            })}
          </fieldset>

          <fieldset className="flex flex-col gap-2.5" disabled={disabled}>
            <legend className="mb-2.5 text-sm font-medium">Rede</legend>
            {selected?.networks.map((n) => {
              const id = `${networkGroup}-${n}`
              const checked = selectedNetwork === n
              return (
                <label
                  key={n}
                  htmlFor={id}
                  className={cn(optionCard, checked ? 'border-primary' : 'border-transparent hover:border-input')}
                >
                  <input
                    type="radio"
                    id={id}
                    name={networkGroup}
                    className="sr-only"
                    checked={checked}
                    onChange={() => change(() => setNetwork(n))}
                  />
                  <span
                    aria-hidden="true"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-primary"
                  >
                    {networkLabel(n).charAt(0)}
                  </span>
                  <span className="flex-1 text-xs">{networkLabel(n)}</span>
                  <RadioDot checked={checked} />
                </label>
              )
            })}
          </fieldset>

          <div aria-live="polite" className="flex flex-col gap-3">
            {connection ? (
              <p className="flex items-center gap-2 text-xs" data-testid="wallet-connected">
                <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                Conectada: {shortAddress(connection.address)} em {networkLabel(connection.network)}
              </p>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={doConnect}
                disabled={disabled || connect.isPending || !selected}
              >
                {connect.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plug aria-hidden="true" />}
                {connect.isPending ? 'Aguardando aprovação na carteira…' : 'Conectar carteira'}
              </Button>
            )}
            {(connectError || error) && (
              <p role="alert" className="text-xs font-medium text-destructive" id="wallet-error">
                {connectError ?? error}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  )
}
