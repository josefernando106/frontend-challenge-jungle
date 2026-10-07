import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

/**
 * Painel da camada de simulação. Não altera a UI diretamente: toda ação passa pela
 * API `window.__mock`, que modifica o banco simulado e emite eventos via Socket.IO.
 */
export default function MockPanel() {
  const control = window.__mock
  const [scenario, setScenario] = useState(() => control?.getScenario() ?? 'default')
  const [nftId, setNftId] = useState('nft-001')
  const [price, setPrice] = useState('')
  const [available, setAvailable] = useState('')
  const [log, setLog] = useState<string>('')
  if (!control) return null

  const run = (label: string, fn: () => unknown) => {
    try {
      const result = fn()
      setLog(`${label}: ${result === undefined ? 'ok' : JSON.stringify(result)}`)
    } catch (e) {
      setLog(`${label}: erro — ${(e as Error).message}`)
    }
  }

  const current = control.scenarios().find((s) => s.id === scenario)
  const section = 'flex flex-col gap-3 rounded-xl bg-card p-4'

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold shadow-lg hover:bg-accent max-md:top-16 max-md:right-2 max-md:bottom-auto max-md:left-auto max-md:px-2.5 max-md:py-1 max-md:text-[10px] max-md:opacity-80"
          data-testid="mock-panel-trigger"
        >
          <FlaskConical className="size-4 text-brand" aria-hidden="true" />
          Mocks: {scenario}
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[92vw] max-w-md overflow-y-auto bg-background p-5">
        <SheetHeader className="p-0">
          <SheetTitle className="font-mono text-xl">Simulação (MSW)</SheetTitle>
          <SheetDescription>Cenários de rede e eventos Socket.IO. Ações afetam REST e tempo real.</SheetDescription>
        </SheetHeader>

        <div className={section}>
          <label htmlFor="mock-scenario" className="font-semibold">
            Cenário
          </label>
          <select
            id="mock-scenario"
            className="h-11 rounded-xl border border-border bg-background px-3"
            value={scenario}
            onChange={(e) => {
              const id = control.setScenario(e.target.value)
              setScenario(id)
              document.documentElement.dataset.mockScenario = id
              setLog(`cenário: ${id}`)
            }}
          >
            {control.scenarios().map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="text-sm text-muted-foreground">{current?.description}</p>
        </div>

        <div className={section}>
          <h3 className="font-semibold">Catálogo em tempo real</h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3 flex flex-col gap-1">
              <label htmlFor="mock-nft" className="text-sm">
                NFT (id)
              </label>
              <Input id="mock-nft" value={nftId} onChange={(e) => setNftId(e.target.value)} className="h-10" />
            </div>
            <div className="col-span-3 flex flex-col gap-1 sm:col-span-1">
              <label htmlFor="mock-price" className="text-sm">
                Preço
              </label>
              <Input id="mock-price" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.5" className="h-10" />
            </div>
            <div className="col-span-3 flex flex-col gap-1 sm:col-span-1">
              <label htmlFor="mock-available" className="text-sm">
                Estoque
              </label>
              <Input
                id="mock-available"
                value={available}
                onChange={(e) => setAvailable(e.target.value)}
                placeholder="0"
                className="h-10"
              />
            </div>
            <Button
              size="xs"
              className="col-span-3 h-10 self-end sm:col-span-1"
              onClick={() =>
                run('updateNft', () =>
                  control.updateNft(nftId, {
                    priceEth: price || undefined,
                    available: available === '' ? undefined : Number(available),
                  }),
                )
              }
            >
              Aplicar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Altera a 1ª edição. Emite nft.updated.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="xs" variant="outline" onClick={() => run('replayLastEvent', () => control.replayLastEvent())}>
              Reenviar último evento
            </Button>
            <Button size="xs" variant="outline" onClick={() => run('replayStaleEvent', () => control.replayStaleEvent())}>
              Reenviar evento antigo
            </Button>
          </div>
        </div>

        <div className={section}>
          <h3 className="font-semibold">Conexão e sessão</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              size="xs"
              variant="outline"
              onClick={() =>
                run('disconnect', () => {
                  control.disconnectSockets({ block: true })
                  window.setTimeout(() => control.unblockSockets(), 5000)
                })
              }
            >
              Derrubar socket (5 s)
            </Button>
            <Button size="xs" variant="outline" onClick={() => run('expireSessions', () => control.expireSessions())}>
              Expirar sessões
            </Button>
            <Button size="xs" variant="outline" onClick={() => run('settleOrders', () => control.settleOrders())}>
              Liquidar pedidos
            </Button>
          </div>
        </div>

        <div className={section}>
          <h3 className="font-semibold">Dados</h3>
          <Button size="xs" variant="destructive" className="self-start" onClick={() => control.reset()}>
            Resetar tudo (seed + cenário padrão)
          </Button>
        </div>

        <p role="status" className="min-h-6 font-mono text-xs break-all text-muted-foreground">
          {log}
        </p>
      </SheetContent>
    </Sheet>
  )
}
